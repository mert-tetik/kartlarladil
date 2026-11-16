import fs from "node:fs";
import path from "node:path";

export const META_ANDROID_SDK_VERSION = "19.0.1";

function parseEnvFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function readEnvFile(envFilePath) {
  try {
    return parseEnvFile(fs.readFileSync(envFilePath, "utf8"));
  } catch {
    return {};
  }
}

function getValue(environment, fileValues, key) {
  const environmentValue = environment[key];
  if (typeof environmentValue === "string" && environmentValue.trim()) {
    return environmentValue.trim();
  }

  const fileValue = fileValues[key];
  return typeof fileValue === "string" && fileValue.trim() ? fileValue.trim() : "";
}

export function getMetaAndroidConfig({
  environment = process.env,
  envFilePath = path.resolve(process.cwd(), ".env.local"),
} = {}) {
  const fileValues = readEnvFile(envFilePath);
  const appId = getValue(environment, fileValues, "META_APP_ID");
  const clientToken = getValue(environment, fileValues, "META_CLIENT_TOKEN");

  if ((appId && !clientToken) || (!appId && clientToken)) {
    throw new Error(
      "META_APP_ID and META_CLIENT_TOKEN must be configured together for the Android Meta App Events SDK.",
    );
  }

  if (appId && !/^\d+$/u.test(appId)) {
    throw new Error("META_APP_ID must contain only digits for the Android Meta App Events SDK.");
  }

  return {
    enabled: Boolean(appId && clientToken),
    appId,
    clientToken,
  };
}
