import type { LocaleCode } from "@/types/domain";

type InstallAppCopy = {
  cta: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  description: string;
  buttonLabel: string;
};

const INSTALL_APP_COPY: Record<LocaleCode, InstallAppCopy> = {
  tr: {
    cta: "Uygulamayı İndir",
    metaTitle: "APK İndir",
    metaDescription:
      "FoxiesDeck Android uygulamasını APK olarak indir ve doğrudan cihazına kur.",
    title: "FoxiesDeck APK İndir",
    description:
      "Android cihazına FoxiesDeck'i doğrudan yüklemek için APK dosyasını indir.",
    buttonLabel: "APK İndir",
  },
  en: {
    cta: "Download the App",
    metaTitle: "Download APK",
    metaDescription:
      "Download the FoxiesDeck Android app as an APK and install it directly on your device.",
    title: "Download FoxiesDeck APK",
    description:
      "Download the APK file to install FoxiesDeck directly on your Android device.",
    buttonLabel: "Download APK",
  },
  de: {
    cta: "App herunterladen",
    metaTitle: "APK herunterladen",
    metaDescription:
      "Lade die FoxiesDeck Android-App als APK herunter und installiere sie direkt auf deinem Gerät.",
    title: "FoxiesDeck APK herunterladen",
    description:
      "Lade die APK-Datei herunter, um FoxiesDeck direkt auf deinem Android-Gerät zu installieren.",
    buttonLabel: "APK herunterladen",
  },
  ru: {
    cta: "Скачать приложение",
    metaTitle: "Скачать APK",
    metaDescription:
      "Скачай Android-приложение FoxiesDeck в виде APK и установи его прямо на устройство.",
    title: "Скачать APK FoxiesDeck",
    description:
      "Скачай APK-файл, чтобы установить FoxiesDeck прямо на своё Android-устройство.",
    buttonLabel: "Скачать APK",
  },
  fr: {
    cta: "Télécharger l'app",
    metaTitle: "Télécharger l'APK",
    metaDescription:
      "Télécharge l'application Android FoxiesDeck au format APK et installe-la directement sur ton appareil.",
    title: "Télécharger l'APK FoxiesDeck",
    description:
      "Télécharge le fichier APK pour installer FoxiesDeck directement sur ton appareil Android.",
    buttonLabel: "Télécharger l'APK",
  },
  es: {
    cta: "Descargar la app",
    metaTitle: "Descargar APK",
    metaDescription:
      "Descarga la aplicación Android de FoxiesDeck como APK e instálala directamente en tu dispositivo.",
    title: "Descargar APK de FoxiesDeck",
    description:
      "Descarga el archivo APK para instalar FoxiesDeck directamente en tu dispositivo Android.",
    buttonLabel: "Descargar APK",
  },
  it: {
    cta: "Scarica l'app",
    metaTitle: "Scarica APK",
    metaDescription:
      "Scarica l'app Android FoxiesDeck come APK e installala direttamente sul tuo dispositivo.",
    title: "Scarica APK FoxiesDeck",
    description:
      "Scarica il file APK per installare FoxiesDeck direttamente sul tuo dispositivo Android.",
    buttonLabel: "Scarica APK",
  },
  pt: {
    cta: "Baixar o app",
    metaTitle: "Baixar APK",
    metaDescription:
      "Baixe o aplicativo Android FoxiesDeck como APK e instale-o diretamente no seu dispositivo.",
    title: "Baixar APK do FoxiesDeck",
    description:
      "Baixe o arquivo APK para instalar o FoxiesDeck diretamente no seu dispositivo Android.",
    buttonLabel: "Baixar APK",
  },
  nl: {
    cta: "Download de app",
    metaTitle: "APK downloaden",
    metaDescription:
      "Download de FoxiesDeck Android-app als APK en installeer deze direct op je apparaat.",
    title: "FoxiesDeck APK downloaden",
    description:
      "Download het APK-bestand om FoxiesDeck direct op je Android-apparaat te installeren.",
    buttonLabel: "APK downloaden",
  },
  pl: {
    cta: "Pobierz aplikację",
    metaTitle: "Pobierz APK",
    metaDescription:
      "Pobierz aplikację FoxiesDeck na Androida jako APK i zainstaluj ją bezpośrednio na swoim urządzeniu.",
    title: "Pobierz APK FoxiesDeck",
    description:
      "Pobierz plik APK, aby zainstalować FoxiesDeck bezpośrednio na swoim urządzeniu z Androidem.",
    buttonLabel: "Pobierz APK",
  },
  ar: {
    cta: "حمّل التطبيق",
    metaTitle: "تحميل APK",
    metaDescription:
      "حمّل تطبيق FoxiesDeck لأندرويد كملف APK وثبّته مباشرة على جهازك.",
    title: "تحميل APK FoxiesDeck",
    description:
      "حمّل ملف APK لتثبيت FoxiesDeck مباشرة على جهازك الذي يعمل بنظام Android.",
    buttonLabel: "تحميل APK",
  },
  ja: {
    cta: "アプリをダウンロード",
    metaTitle: "APKをダウンロード",
    metaDescription:
      "FoxiesDeck AndroidアプリをAPKとしてダウンロードし、デバイスに直接インストールしてください。",
    title: "FoxiesDeck APKをダウンロード",
    description:
      "APKファイルをダウンロードして、AndroidデバイスにFoxiesDeckを直接インストールします。",
    buttonLabel: "APKをダウンロード",
  },
  ko: {
    cta: "앱 다운로드",
    metaTitle: "APK 다운로드",
    metaDescription:
      "FoxiesDeck Android 앱을 APK로 다운로드하여 기기에 직접 설치하세요.",
    title: "FoxiesDeck APK 다운로드",
    description:
      "APK 파일을 다운로드하여 Android 기기에 FoxiesDeck을 직접 설치하세요.",
    buttonLabel: "APK 다운로드",
  },
  "zh-CN": {
    cta: "下载应用",
    metaTitle: "下载 APK",
    metaDescription: "下载 FoxiesDeck Android 应用 APK 并直接安装到你的设备上。",
    title: "下载 FoxiesDeck APK",
    description: "下载 APK 文件以直接在 Android 设备上安装 FoxiesDeck。",
    buttonLabel: "下载 APK",
  },
};

export function getInstallAppCopy(locale: LocaleCode) {
  return INSTALL_APP_COPY[locale] ?? INSTALL_APP_COPY.en;
}
