import type { LocaleCode } from "@/types/domain";

type InstallStep = {
  instruction: string;
  image: string;
  imageAlt: string;
};

type InstallAppCopy = {
  cta: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  description: string;
  note: string;
  steps: InstallStep[];
};

const INSTALL_APP_COPY: Record<LocaleCode, InstallAppCopy> = {
  tr: {
    cta: "Uygulamayı İndir",
    metaTitle: "Uygulamayı İndir",
    metaDescription: "FoxiesDeck'i telefonunun ana ekranına eklemek için tarayıcına uygun kısa adımları gör.",
    title: "FoxiesDeck'i ana ekranına uygulama olarak ekle",
    description: "FoxiesDeck'i ana ekranına eklemek için bu iki adımı takip et.",
    note: "Tarayıcı sürümüne göre menü isimleri biraz değişebilir.",
    steps: [
      {
        instruction: "FoxiesDeck açıkken tarayıcınızdaki üç nokta simgesine basın ve Ana ekrana ekle butonunu bulup basın. Eğer Ana ekrana ekle butonu gözükmüyorsa paylaş simgesine basıp bulun.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Tarayıcı menüsünde Ana ekrana ekle seçeneği",
      },
      {
        instruction: "Ana ekrana ekle butonunu bulup bastıktan sonra FoxiesDeck bir uygulama olarak ana ekranınıza eklenecek.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Ana ekrana eklenmiş FoxiesDeck uygulaması simgesi",
      },
    ],
  },
  en: {
    cta: "Download the App",
    metaTitle: "Download the App",
    metaDescription: "See the short browser-specific steps to add FoxiesDeck to your phone's home screen.",
    title: "Add FoxiesDeck as an app to your home screen",
    description: "Follow these two steps to add FoxiesDeck to your home screen.",
    note: "Menu labels may vary slightly depending on your browser version.",
    steps: [
      {
        instruction: "While FoxiesDeck is open, tap the three-dot menu in your browser and find the Add to Home Screen button. If you don't see it, tap the share icon and look there.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Add to Home Screen option in the browser menu",
      },
      {
        instruction: "After tapping Add to Home Screen, FoxiesDeck will be added to your home screen as an app.",
        image: "/install/home-screen-icon.png",
        imageAlt: "FoxiesDeck app icon on the home screen",
      },
    ],
  },
  de: {
    cta: "App herunterladen",
    metaTitle: "App herunterladen",
    metaDescription: "Sieh dir die kurzen browserspezifischen Schritte an, um FoxiesDeck zum Startbildschirm deines Telefons hinzuzufügen.",
    title: "Füge FoxiesDeck als App zu deinem Startbildschirm hinzu",
    description: "Befolge diese beiden Schritte, um FoxiesDeck zu deinem Startbildschirm hinzuzufügen.",
    note: "Die Menübezeichnungen können je nach Browser-Version leicht variieren.",
    steps: [
      {
        instruction: "Während FoxiesDeck geöffnet ist, tippe auf das Drei-Punkte-Menü in deinem Browser und suche die Schaltfläche Zum Startbildschirm hinzufügen. Wenn du sie nicht siehst, tippe auf das Freigabesymbol und suche dort.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Option 'Zum Startbildschirm hinzufügen' im Browser-Menü",
      },
      {
        instruction: "Nachdem du auf Zum Startbildschirm hinzufügen getippt hast, wird FoxiesDeck als App zu deinem Startbildschirm hinzugefügt.",
        image: "/install/home-screen-icon.png",
        imageAlt: "FoxiesDeck-App-Symbol auf dem Startbildschirm",
      },
    ],
  },
  ru: {
    cta: "Скачать приложение",
    metaTitle: "Скачать приложение",
    metaDescription: "Посмотри короткие инструкции для каждого браузера, чтобы добавить FoxiesDeck на главный экран телефона.",
    title: "Добавь FoxiesDeck как приложение на главный экран",
    description: "Следуй этим двум шагам, чтобы добавить FoxiesDeck на главный экран.",
    note: "Названия меню могут немного отличаться в зависимости от версии твоего браузера.",
    steps: [
      {
        instruction: "Когда FoxiesDeck открыт, нажми на меню с тремя точками в твоём браузере и найди кнопку Добавить на главный экран. Если ты не видишь её, нажми на значок поделиться и посмотри там.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Опция 'Добавить на главный экран' в меню браузера",
      },
      {
        instruction: "После нажатия на Добавить на главный экран, FoxiesDeck будет добавлен на твой главный экран как приложение.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Иконка приложения FoxiesDeck на главном экране",
      },
    ],
  },
  fr: {
    cta: "Télécharger l'app",
    metaTitle: "Télécharger l'app",
    metaDescription: "Consulte les étapes courtes selon le navigateur pour ajouter FoxiesDeck à l'écran d'accueil de ton téléphone.",
    title: "Ajoute FoxiesDeck en tant qu'application sur ton écran d'accueil",
    description: "Suis ces deux étapes pour ajouter FoxiesDeck à ton écran d'accueil.",
    note: "Les étiquettes de menu peuvent légèrement varier selon la version de ton navigateur.",
    steps: [
      {
        instruction: "Lorsque FoxiesDeck est ouvert, appuie sur le menu à trois points dans ton navigateur et trouve le bouton Ajouter à l'écran d'accueil. Si tu ne le vois pas, appuie sur l'icône de partage et cherche là.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Option 'Ajouter à l'écran d'accueil' dans le menu du navigateur",
      },
      {
        instruction: "Après avoir appuyé sur Ajouter à l'écran d'accueil, FoxiesDeck sera ajouté à ton écran d'accueil en tant qu'application.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Icône de l'application FoxiesDeck sur l'écran d'accueil",
      },
    ],
  },
  es: {
    cta: "Descargar la app",
    metaTitle: "Descargar la app",
    metaDescription: "Mira los pasos cortos según el navegador para añadir FoxiesDeck a la pantalla de inicio de tu teléfono.",
    title: "Agrega FoxiesDeck como una aplicación a tu pantalla de inicio",
    description: "Sigue estos dos pasos para agregar FoxiesDeck a tu pantalla de inicio.",
    note: "Las etiquetas del menú pueden variar ligeramente según la versión de tu navegador.",
    steps: [
      {
        instruction: "Mientras FoxiesDeck está abierto, toca el menú de tres puntos en tu navegador y busca el botón Agregar a la pantalla de inicio. Si no lo ves, toca el ícono de compartir y búscalo allí.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Opción 'Agregar a la pantalla de inicio' en el menú del navegador",
      },
      {
        instruction: "Después de tocar Agregar a la pantalla de inicio, FoxiesDeck se añadirá a tu pantalla de inicio como una aplicación.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Ícono de la aplicación FoxiesDeck en la pantalla de inicio",
      },
    ],
  },
  it: {
    cta: "Scarica l'app",
    metaTitle: "Scarica l'app",
    metaDescription: "Guarda i passaggi brevi per browser per aggiungere FoxiesDeck alla schermata Home del telefono.",
    title: "Aggiungi FoxiesDeck come app alla tua schermata principale",
    description: "Segui questi due passaggi per aggiungere FoxiesDeck alla tua schermata principale.",
    note: "Le etichette dei menu possono variare leggermente a seconda della versione del tuo browser.",
    steps: [
      {
        instruction: "Con FoxiesDeck aperto, tocca il menu a tre punti nel tuo browser e trova il pulsante Aggiungi alla schermata principale. Se non lo vedi, tocca l'icona di condivisione e cerca lì.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Opzione 'Aggiungi alla schermata principale' nel menu del browser",
      },
      {
        instruction: "Dopo aver toccato Aggiungi alla schermata principale, FoxiesDeck verrà aggiunto alla tua schermata principale come app.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Icona dell'app FoxiesDeck sulla schermata principale",
      },
    ],
  },
  pt: {
    cta: "Baixar o app",
    metaTitle: "Baixar o app",
    metaDescription: "Veja os passos curtos por navegador para adicionar o FoxiesDeck à tela inicial do seu telefone.",
    title: "Adicione o FoxiesDeck como um aplicativo à sua tela inicial",
    description: "Siga estas duas etapas para adicionar o FoxiesDeck à sua tela inicial.",
    note: "Os rótulos do menu podem variar ligeiramente dependendo da versão do seu navegador.",
    steps: [
      {
        instruction: "Com o FoxiesDeck aberto, toque no menu de três pontos no seu navegador e encontre o botão Adicionar à tela inicial. Se você não o vê, toque no ícone de compartilhar e procure lá.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Opção 'Adicionar à tela inicial' no menu do navegador",
      },
      {
        instruction: "Após tocar em Adicionar à tela inicial, o FoxiesDeck será adicionado à sua tela inicial como um aplicativo.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Ícone do aplicativo FoxiesDeck na tela inicial",
      },
    ],
  },
  nl: {
    cta: "Download de app",
    metaTitle: "Download de app",
    metaDescription: "Bekijk de korte browserspecifieke stappen om FoxiesDeck aan het startscherm van je telefoon toe te voegen.",
    title: "Voeg FoxiesDeck toe als een app op je startscherm",
    description: "Volg deze twee stappen om FoxiesDeck aan je startscherm toe te voegen.",
    note: "Menu-labels kunnen iets variëren, afhankelijk van je browser versie.",
    steps: [
      {
        instruction: "Terwijl FoxiesDeck open is, tik op het menu met drie stippen in je browser en zoek de knop Toevoegen aan startscherm. Als je deze niet ziet, tik dan op het deelpictogram en kijk daar.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Optie 'Toevoegen aan startscherm' in het browser menu",
      },
      {
        instruction: "Nadat je op Toevoegen aan startscherm hebt getikt, wordt FoxiesDeck als app aan je startscherm toegevoegd.",
        image: "/install/home-screen-icon.png",
        imageAlt: "FoxiesDeck app-icoon op het startscherm",
      },
    ],
  },
  pl: {
    cta: "Pobierz aplikację",
    metaTitle: "Pobierz aplikację",
    metaDescription: "Zobacz krótkie kroki dla każdej przeglądarki, aby dodać FoxiesDeck do ekranu głównego telefonu.",
    title: "Dodaj FoxiesDeck jako aplikację na ekranie głównym",
    description: "Wykonaj te dwa kroki, aby dodać FoxiesDeck do ekranu głównego.",
    note: "Etykiety menu mogą się nieznacznie różnić w zależności od wersji przeglądarki.",
    steps: [
      {
        instruction: "Gdy FoxiesDeck jest otwarty, dotknij menu z trzema kropkami w swojej przeglądarce i znajdź przycisk Dodaj do ekranu głównego. Jeśli go nie widzisz, dotknij ikony udostępniania i poszukaj tam.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "Opcja 'Dodaj do ekranu głównego' w menu przeglądarki",
      },
      {
        instruction: "Po dotknięciu Dodaj do ekranu głównego, FoxiesDeck zostanie dodany do twojego ekranu głównego jako aplikacja.",
        image: "/install/home-screen-icon.png",
        imageAlt: "Ikona aplikacji FoxiesDeck na ekranie głównym",
      },
    ],
  },
  ar: {
    cta: "حمّل التطبيق",
    metaTitle: "حمّل التطبيق",
    metaDescription: "اطلع على الخطوات القصيرة الخاصة بكل متصفح لإضافة FoxiesDeck إلى الشاشة الرئيسية لهاتفك.",
    title: "أضف FoxiesDeck كتطبيق إلى الشاشة الرئيسية",
    description: "اتبع هذين الخطوتين لإضافة FoxiesDeck إلى شاشتك الرئيسية.",
    note: "قد تختلف تسميات القائمة قليلاً حسب إصدار المتصفح الخاص بك.",
    steps: [
      {
        instruction: "بينما FoxiesDeck مفتوح، اضغط على قائمة النقاط الثلاث في متصفحك وابحث عن زر إضافة إلى الشاشة الرئيسية. إذا لم تره، اضغط على أيقونة المشاركة وابحث هناك.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "خيار 'إضافة إلى الشاشة الرئيسية' في قائمة المتصفح",
      },
      {
        instruction: "بعد الضغط على إضافة إلى الشاشة الرئيسية، سيتم إضافة FoxiesDeck إلى شاشتك الرئيسية كتطبيق.",
        image: "/install/home-screen-icon.png",
        imageAlt: "أيقونة تطبيق FoxiesDeck على الشاشة الرئيسية",
      },
    ],
  },
  ja: {
    cta: "アプリをダウンロード",
    metaTitle: "アプリをダウンロード",
    metaDescription: "FoxiesDeck をスマートフォンのホーム画面に追加するための、ブラウザ別の短い手順を確認できます。",
    title: "FoxiesDeckをアプリとしてホーム画面に追加",
    description: "FoxiesDeckをホーム画面に追加するために、次の2つの手順に従ってください。",
    note: "メニューラベルはブラウザのバージョンによって若干異なる場合があります。",
    steps: [
      {
        instruction: "FoxiesDeckが開いている状態で、ブラウザの3点メニューをタップし、ホーム画面に追加ボタンを見つけます。見当たらない場合は、共有アイコンをタップしてそこを確認してください。",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "ブラウザメニューの'ホーム画面に追加'オプション",
      },
      {
        instruction: "ホーム画面に追加をタップすると、FoxiesDeckがアプリとしてホーム画面に追加されます。",
        image: "/install/home-screen-icon.png",
        imageAlt: "ホーム画面のFoxiesDeckアプリアイコン",
      },
    ],
  },
  ko: {
    cta: "앱 다운로드",
    metaTitle: "앱 다운로드",
    metaDescription: "FoxiesDeck를 휴대폰 홈 화면에 추가하는 브라우저별 짧은 안내를 확인하세요.",
    title: "FoxiesDeck를 앱으로 홈 화면에 추가",
    description: "FoxiesDeck을 홈 화면에 추가하려면 다음 두 단계를 따르세요.",
    note: "메뉴 레이블은 브라우저 버전에 따라 약간 다를 수 있습니다.",
    steps: [
      {
        instruction: "FoxiesDeck이 열려 있는 동안 브라우저의 세 점 메뉴를 탭하고 홈 화면에 추가 버튼을 찾습니다. 보이지 않으면 공유 아이콘을 탭하고 거기서 찾아보세요.",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "브라우저 메뉴의 '홈 화면에 추가' 옵션",
      },
      {
        instruction: "홈 화면에 추가를 탭하면 FoxiesDeck이 앱으로 홈 화면에 추가됩니다.",
        image: "/install/home-screen-icon.png",
        imageAlt: "홈 화면의 FoxiesDeck 앱 아이콘",
      },
    ],
  },
  "zh-CN": {
    cta: "下载应用",
    metaTitle: "下载应用",
    metaDescription: "按照两个简单步骤将 FoxiesDeck 添加到你的手机主屏幕。",
    title: "将 FoxiesDeck 添加为应用到您的主屏幕",
    description: "按照这两个步骤将 FoxiesDeck 添加到您的主屏幕。",
    note: "菜单标签可能会根据您的浏览器版本略有不同。",
    steps: [
      {
        instruction: "在 FoxiesDeck 打开时，点击浏览器中的三点菜单，找到添加到主屏幕按钮。如果没有看到，请点击分享图标并在那儿查找。",
        image: "/install/add-to-home-screen-menu.png",
        imageAlt: "浏览器菜单中的'添加到主屏幕'选项",
      },
      {
        instruction: "点击添加到主屏幕后，FoxiesDeck 将作为应用添加到您的主屏幕。",
        image: "/install/home-screen-icon.png",
        imageAlt: "主屏幕上的 FoxiesDeck 应用图标",
      },
    ],
  },
};

export function getInstallAppCopy(locale: LocaleCode) {
  return INSTALL_APP_COPY[locale] ?? INSTALL_APP_COPY.en;
}
