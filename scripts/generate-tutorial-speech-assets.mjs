import fs from "node:fs";
import path from "node:path";

const rootDirectory = process.cwd();
const localeDirectory = path.join(rootDirectory, "src", "i18n", "locales");
const outputDirectory = path.join(rootDirectory, "public", "tutorial-speech");
const locales = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const speechItems = [
  ["welcome", "tutorial.welcome"],
  ["welcome-add-cards", "tutorial.welcomeAddCards"],
  ["card-collection-prompt", "tutorial.cardCollectionPrompt"],
  ["landing-cards-action", "tutorial.landingCardsAction"],
  ["landing-cards-message", "tutorial.landingCardsMessage"],
  ["landing-start-learning-action", "tutorial.landingStartLearningAction"],
];
const force = process.argv.includes("--force");
const localeArgument = process.argv.find((argument) => argument.startsWith("--locale="))?.slice("--locale=".length);
const assetArgument = process.argv.find((argument) => argument.startsWith("--asset="))?.slice("--asset=".length);
if (localeArgument && !locales.includes(localeArgument)) throw new Error(`Unknown tutorial speech locale: ${localeArgument}`);
if (assetArgument && !speechItems.some(([assetName]) => assetName === assetArgument)) throw new Error(`Unknown tutorial speech asset: ${assetArgument}`);
const selectedLocales = localeArgument ? locales.filter((locale) => locale === localeArgument) : locales;
const selectedSpeechItems = assetArgument ? speechItems.filter(([assetName]) => assetName === assetArgument) : speechItems;
const POYO_API_URL = "https://api.poyo.ai";
const POYO_SPEECH_MODEL = "elevenlabs-tts-turbo-2-5";
const FOXIESDECK_MASCOT_VOICE = "d8WcCpplp8meHt10UhL8";
const SPEECH_WAIT_TIMEOUT_MS = 150_000;
const SPEECH_POLL_INTERVAL_MS = 5_000;
const MAX_SPEECH_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const SPEECH_ATTEMPTS = 3;

function readEnvFile() {
  const envPath = path.join(rootDirectory, ".env.local");
  if (!fs.existsSync(envPath)) return {};

  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      try {
        values[key] = JSON.parse(rawValue);
      } catch {
        values[key] = rawValue.slice(1, -1);
      }
    } else {
      values[key] = rawValue.replace(/^'(.*)'$/u, "$1");
    }
  }
  return values;
}

function getPoyoApiKey() {
  const apiKey = process.env.POYO_API_KEY?.trim() || readEnvFile().POYO_API_KEY?.trim();
  if (!apiKey) throw new Error("POYO_API_KEY is not configured.");
  return apiKey;
}

function readTranslation(locale, translationKey) {
  const source = fs.readFileSync(path.join(localeDirectory, `${locale}.ts`), "utf8");
  const escapedKey = translationKey.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = source.match(new RegExp(`^\\s*"${escapedKey}":\\s*("(?:\\\\.|[^"\\\\])*")\\s*,?\\s*$`, "mu"));
  if (!match) throw new Error(`Missing translation ${translationKey} in ${locale}.ts`);
  return JSON.parse(match[1]);
}

function speechLanguageCode(locale) {
  return locale === "zh-CN" ? "zh" : locale;
}

async function submitSpeechTask(text, locale, apiKey) {
  const response = await fetch(`${POYO_API_URL}/api/generate/submit`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: POYO_SPEECH_MODEL,
      input: {
        text,
        voice: FOXIESDECK_MASCOT_VOICE,
        language_code: speechLanguageCode(locale),
        stability: 0.7,
        similarity_boost: 0.78,
        style: 0.12,
        speed: 1,
        timestamps: false,
        apply_text_normalization: "auto",
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || typeof payload?.data?.task_id !== "string") throw new Error("speech_submission_failed");
  return payload.data.task_id;
}

async function getSpeechTask(taskId, apiKey) {
  const response = await fetch(`${POYO_API_URL}/api/generate/status/${encodeURIComponent(taskId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 429) return { status: "running", audioUrl: null };
  if (!response.ok) throw new Error("speech_status_failed");
  const payload = await response.json().catch(() => null);
  const status = payload?.data?.status;
  if (!["not_started", "running", "finished", "failed"].includes(status)) throw new Error("speech_status_failed");
  const audio = payload?.data?.files?.find((file) => file.file_type === "audio" && typeof file.file_url === "string");
  return { status, audioUrl: audio?.file_url ?? null };
}

async function generateSpeech(text, locale, apiKey) {
  let lastError;
  for (let attempt = 1; attempt <= SPEECH_ATTEMPTS; attempt++) {
    try {
      const taskId = await submitSpeechTask(text, locale, apiKey);
      const deadline = Date.now() + SPEECH_WAIT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const task = await getSpeechTask(taskId, apiKey);
        if (task.status === "failed") throw new Error("speech_generation_failed");
        if (task.status === "finished" && task.audioUrl) {
          const response = await fetch(task.audioUrl, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
          if (!response.ok) throw new Error("speech_download_failed");
          const data = Buffer.from(await response.arrayBuffer());
          if (!data.length || data.length > MAX_SPEECH_BYTES) throw new Error("speech_too_large");
          return data;
        }
        await new Promise((resolve) => setTimeout(resolve, SPEECH_POLL_INTERVAL_MS));
      }
      throw new Error("speech_timeout");
    } catch (error) {
      lastError = error;
      if (attempt < SPEECH_ATTEMPTS) {
        console.log(`Retrying ${locale} speech task (${attempt + 1}/${SPEECH_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
  throw lastError;
}

async function main() {
  const apiKey = getPoyoApiKey();
  fs.mkdirSync(outputDirectory, { recursive: true });

  for (const locale of selectedLocales) {
    const localeOutputDirectory = path.join(outputDirectory, locale);
    fs.mkdirSync(localeOutputDirectory, { recursive: true });
    for (const [assetName, translationKey] of selectedSpeechItems) {
      const outputPath = path.join(localeOutputDirectory, `${assetName}.mp3`);
      if (!force && fs.existsSync(outputPath)) {
        console.log(`Skipping ${locale}/${assetName}.mp3`);
        continue;
      }

      const text = readTranslation(locale, translationKey);
      const audio = await generateSpeech(text, locale, apiKey);
      const temporaryPath = `${outputPath}.tmp`;
      fs.writeFileSync(temporaryPath, audio);
      fs.renameSync(temporaryPath, outputPath);
      console.log(`Generated ${locale}/${assetName}.mp3 (${Math.round(audio.length / 1024)} KB)`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "tutorial_speech_generation_failed");
  process.exitCode = 1;
});
