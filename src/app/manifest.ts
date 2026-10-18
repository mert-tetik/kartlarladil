import type { MetadataRoute } from "next";
import { APP_NAME, SITE_LOGO_PATH } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "A multilingual vocabulary learning app built around collectible cards.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#000000",
    lang: "en",
    dir: "ltr",
    categories: ["education", "lifestyle"],
    icons: [
      {
        // This is the website/PWA icon. AAB generation overrides its icon
        // sources explicitly with public/AppLogo2.png.
        src: SITE_LOGO_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: SITE_LOGO_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
