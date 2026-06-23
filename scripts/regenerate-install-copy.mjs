import fs from "node:fs";
import OpenAI from "openai";

const INPUT_PATH = "src/features/install-app/install-app-copy.ts";
const OUTPUT_PATH = "src/features/install-app/install-app-copy.ts";

const LOCALES = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const SOURCE = {
  tr: {
    title: "FoxiesDeck'i ana ekranına uygulama olarak ekle",
    description: "FoxiesDeck'i ana ekranına eklemek için bu iki adımı takip et.",
    note: "Tarayıcı sürümüne göre menü isimleri biraz değişebilir.",
    steps: [
      {
        instruction:
          "FoxiesDeck açıkken tarayıcınızdaki üç nokta simgesine basın ve Ana ekrana ekle butonunu bulup basın. Eğer Ana ekrana ekle butonu gözükmüyorsa paylaş simgesine basıp bulun.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Tarayıcı menüsünde Ana ekrana ekle seçeneği",
      },
      {
        instruction:
          "Ana ekrana ekle butonunu bulup bastıktan sonra FoxiesDeck bir uygulama olarak ana ekranınıza eklenecek.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Ana ekrana eklenmiş FoxiesDeck uygulaması simgesi",
      },
    ],
  },
  en: {
    title: "Add FoxiesDeck as an app to your home screen",
    description: "Follow these two steps to add FoxiesDeck to your home screen.",
    note: "Menu labels may vary slightly depending on your browser version.",
    steps: [
      {
        instruction:
          "While FoxiesDeck is open, tap the three-dot menu in your browser and find the Add to Home Screen button. If you don't see it, tap the share icon and look there.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Add to Home Screen option in the browser menu",
      },
      {
        instruction:
          "After tapping Add to Home Screen, FoxiesDeck will be added to your home screen as an app.",
        image: "/install/home-screen-icon.png",
        imageAlt: "FoxiesDeck app icon on the home screen",
      },
    ],
  },
};

loadEnv(".env.local");

const openai = new OpenAI();

function extractExistingMeta(input) {
  const locales = [...LOCALES, "tr", "en"];
  const meta = {};

  for (const locale of locales) {
    const localeBlock = input.match(new RegExp(`${locale}: \\{([\\s\\S]*?)\\n  \\},`, "m"));
    if (!localeBlock) continue;

    const block = localeBlock[1];
    const cta = block.match(/cta: "([^"]+)"/)?.[1] ?? "";
    const metaTitle = block.match(/metaTitle: "([^"]+)"/)?.[1] ?? "";
    const metaDescription = block.match(/metaDescription: "([^"]+)"/)?.[1] ?? "";
    meta[locale] = { cta, metaTitle, metaDescription };
  }

  return meta;
}

function serializeStep(step, indent) {
  return [
    `${indent}{`,
    `${indent}  instruction: "${escape(step.instruction)}",`,
    `${indent}  image: "${step.image}",`,
    `${indent}  imageAlt: "${escape(step.imageAlt)}",`,
    `${indent}},`,
  ].join("\n");
}

function escape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function serializeLocale(locale, meta, copy) {
  const steps = copy.steps.map((step) => serializeStep(step, "      ")).join("\n");

  return [
    `  ${locale}: {`,
    `    cta: "${escape(meta.cta)}",`,
    `    metaTitle: "${escape(meta.metaTitle)}",`,
    `    metaDescription: "${escape(meta.metaDescription)}",`,
    `    title: "${escape(copy.title)}",`,
    `    description: "${escape(copy.description)}",`,
    `    note: "${escape(copy.note)}",`,
    `    steps: [`,
    steps,
    `    ],`,
    `  },`,
  ].join("\n");
}

async function translate() {
  const prompt = [
    "Translate the following UI strings for a PWA install page from English into each target locale.",
    "Target locales: " + LOCALES.map((l) => `"${l}"`).join(", ") + ".",
    "Return a JSON object where top-level keys are locale codes and values are objects with: title, description, note, steps (array of 2 objects each with instruction and imageAlt).",
    "For the 'Add to Home Screen' button name, use the official localized label that iOS Safari and Android Chrome actually show in each locale (e.g. Turkish 'Ana ekrana ekle', German 'Zum Startbildschirm hinzufügen', etc.).",
    "Keep the tone concise, friendly, and clear. These are short in-app instructions.",
    "\nSource strings:\n" +
      JSON.stringify(
        {
          title: SOURCE.en.title,
          description: SOURCE.en.description,
          note: SOURCE.en.note,
          steps: SOURCE.en.steps.map(({ instruction, imageAlt }) => ({ instruction, imageAlt })),
        },
        null,
        2,
      ),
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert UI localization assistant. Return only valid JSON matching the requested structure. Do not include markdown or explanations.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content);
}

async function main() {
  const input = fs.readFileSync(INPUT_PATH, "utf8");
  const meta = extractExistingMeta(input);

  const translations = await translate();

  const locales = ["tr", "en", ...LOCALES];
  const blocks = [];

  for (const locale of locales) {
    const metaValues = meta[locale] ?? meta.en;
    let copy = SOURCE[locale];

    if (!copy) {
      const translated = translations[locale];
      if (!translated) {
        console.warn(`No translation for ${locale}, falling back to English`);
        copy = SOURCE.en;
      } else {
        copy = {
          title: translated.title,
          description: translated.description,
          note: translated.note,
          steps: translated.steps.map((step, index) => ({
            instruction: step.instruction,
            image: SOURCE.en.steps[index].image,
            imageAlt: step.imageAlt,
          })),
        };
      }
    }

    blocks.push(serializeLocale(locale, metaValues, copy));
  }

  const output = [
    'import type { LocaleCode } from "@/types/domain";',
    "",
    "type InstallStep = {",
    "  instruction: string;",
    "  image: string;",
    "  imageAlt: string;",
    "};",
    "",
    "type InstallAppCopy = {",
    "  cta: string;",
    "  metaTitle: string;",
    "  metaDescription: string;",
    "  title: string;",
    "  description: string;",
    "  note: string;",
    "  steps: InstallStep[];",
    "};",
    "",
    "const INSTALL_APP_COPY: Record<LocaleCode, InstallAppCopy> = {",
    blocks.join("\n"),
    "};",
    "",
    "export function getInstallAppCopy(locale: LocaleCode) {",
    "  return INSTALL_APP_COPY[locale] ?? INSTALL_APP_COPY.en;",
    "}",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_PATH, output, "utf8");
  console.log(`Updated ${OUTPUT_PATH}`);
}

function loadEnv(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim().replace(/^\uFEFF/, "");
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
