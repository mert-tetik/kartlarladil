export function validateGoogleServicesConfig(contents, expectedPackageName) {
  let config;
  try {
    config = JSON.parse(String(contents));
  } catch {
    throw new Error("Firebase google-services.json is not valid JSON.");
  }

  const client = Array.isArray(config?.client)
    ? config.client.find(
        (entry) => entry?.client_info?.android_client_info?.package_name === expectedPackageName,
      )
    : null;
  const appId = client?.client_info?.mobilesdk_app_id;
  const apiKey = client?.api_key?.find((entry) => typeof entry?.current_key === "string" && entry.current_key.trim());

  if (
    !config?.project_info?.project_id ||
    !client ||
    typeof appId !== "string" ||
    !appId.includes(":android:") ||
    !apiKey
  ) {
    throw new Error(
      `Firebase google-services.json is missing a valid Android app configuration for ${expectedPackageName}.`,
    );
  }

  return { projectId: config.project_info.project_id, packageName: expectedPackageName };
}
