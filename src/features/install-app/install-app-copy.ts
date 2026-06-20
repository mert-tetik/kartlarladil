import type { LocaleCode } from "@/types/domain";

type InstallGuide = {
  browser: string;
  instruction: string;
  note?: string;
};

type InstallSection = {
  title: string;
  guides: InstallGuide[];
};

type InstallAppCopy = {
  cta: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  description: string;
  note: string;
  fallback: string;
  sections: InstallSection[];
};

const INSTALL_APP_COPY: Record<LocaleCode, InstallAppCopy> = {
  tr: {
    cta: "Uygulamayı Al",
    metaTitle: "Uygulamayı Al",
    metaDescription: "FoxiesDeck'i telefonunun ana ekranına eklemek için tarayıcına uygun kısa adımları gör.",
    title: "FoxiesDeck'i ana ekrana ekle",
    description: "Bu sayfayı telefonunda açık bırak ve kullandığın tarayıcıya göre aşağıdaki kısa adımları uygula.",
    note: "Tarayıcı sürümüne göre menü isimleri biraz değişebilir.",
    fallback: "Seçenek görünmüyorsa iPhone veya iPad'de Safari'yi, Android'de Chrome'u dene.",
    sections: [
      {
        title: "iPhone ve iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Bu sayfayı Safari'de aç, Paylaş'a dokun, Ana Ekrana Ekle'yi seç, Web Uygulaması Olarak Aç açık kalsın ve Ekle'ye bas.",
          },
          {
            browser: "Chrome",
            instruction: "Bu sayfayı Chrome'da aç, adres çubuğunun yanındaki Paylaş'a dokun, Ana Ekrana Ekle'yi seç ve Ekle'ye bas.",
          },
          {
            browser: "Firefox",
            instruction: "Bu sayfayı Firefox'ta aç, adres çubuğundaki Paylaş'a dokun, Ana Ekrana Ekle'yi seç, istersen adını düzenle ve Ekle'ye bas.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Bu sayfayı Chrome'da aç, menüyü aç, Ana ekrana ekle'yi seç, Kısayol oluştur de ve ardından Ekle'ye bas.",
          },
          {
            browser: "Firefox",
            instruction: "Bu sayfayı Firefox'ta aç, üç noktalı menüyü aç, Ana ekrana ekle'yi seç ve istenirse iki kez Ekle'ye bas.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Bu sayfayı Samsung Internet'te aç, tarayıcı menüsünü aç, Sayfayı şuraya ekle veya Ana ekrana ekle seçeneğini bul ve onayla.",
          },
          {
            browser: "Edge",
            instruction: "Bu sayfayı Edge'de aç, menüyü aç, Telefona ekle veya Ana ekrana ekle seçeneğini bul ve kısayolu onayla.",
            note: "Bazı Edge Android sürümleri doğrudan sayfa kısayolu yerine Uygulamayı yükle akışını gösterebilir.",
          },
        ],
      },
    ],
  },
  en: {
    cta: "Get The App",
    metaTitle: "Get The App",
    metaDescription: "See the short browser-specific steps to add FoxiesDeck to your phone's home screen.",
    title: "Add FoxiesDeck to your home screen",
    description: "Keep this page open on your phone and follow the short steps for the browser you use.",
    note: "Menu labels can vary slightly by browser version.",
    fallback: "If you do not see the option, try Safari on iPhone or iPad, or Chrome on Android.",
    sections: [
      {
        title: "iPhone & iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Open this page in Safari, tap Share, choose Add to Home Screen, leave Open as Web App on, then tap Add.",
          },
          {
            browser: "Chrome",
            instruction: "Open this page in Chrome, tap Share next to the address bar, choose Add to Home Screen, then tap Add.",
          },
          {
            browser: "Firefox",
            instruction: "Open this page in Firefox, tap Share in the address bar, choose Add to Home Screen, rename it if you want, then tap Add.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Open this page in Chrome, open the menu, choose Add to home screen, choose Create shortcut, then tap Add.",
          },
          {
            browser: "Firefox",
            instruction: "Open this page in Firefox, open the three-dot menu, choose Add to Home screen, then tap Add twice if asked.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Open this page in Samsung Internet, open the browser menu, find Add page to or Add to Home screen, and confirm it.",
          },
          {
            browser: "Edge",
            instruction: "Open this page in Edge, open the menu, find Add to Phone or Add to Home screen, and confirm the shortcut.",
            note: "Some Edge Android versions may show an Install app flow instead of a direct page shortcut.",
          },
        ],
      },
    ],
  },
  de: {
    cta: "App holen",
    metaTitle: "App holen",
    metaDescription: "Sieh dir die kurzen browserspezifischen Schritte an, um FoxiesDeck zum Startbildschirm deines Telefons hinzuzufügen.",
    title: "FoxiesDeck zum Startbildschirm hinzufügen",
    description: "Lass diese Seite auf deinem Handy geöffnet und folge den kurzen Schritten für den Browser, den du verwendest.",
    note: "Je nach Browserversion können die Menünamen leicht abweichen.",
    fallback: "Wenn die Option nicht erscheint, versuche Safari auf iPhone oder iPad oder Chrome auf Android.",
    sections: [
      {
        title: "iPhone und iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Öffne diese Seite in Safari, tippe auf Teilen, wähle Zum Home-Bildschirm, lasse Als Web-App öffnen aktiviert und tippe dann auf Hinzufügen.",
          },
          {
            browser: "Chrome",
            instruction: "Öffne diese Seite in Chrome, tippe neben der Adressleiste auf Teilen, wähle Zum Home-Bildschirm und tippe dann auf Hinzufügen.",
          },
          {
            browser: "Firefox",
            instruction: "Öffne diese Seite in Firefox, tippe in der Adressleiste auf Teilen, wähle Zum Home-Bildschirm, benenne sie bei Bedarf um und tippe dann auf Hinzufügen.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Öffne diese Seite in Chrome, öffne das Menü, wähle Zum Startbildschirm hinzufügen, dann Verknüpfung erstellen und tippe danach auf Hinzufügen.",
          },
          {
            browser: "Firefox",
            instruction: "Öffne diese Seite in Firefox, öffne das Drei-Punkte-Menü, wähle Zum Startbildschirm hinzufügen und tippe bei Bedarf zweimal auf Hinzufügen.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Öffne diese Seite in Samsung Internet, öffne das Browsermenü, suche Nach Seite hinzufügen zu oder Zum Startbildschirm hinzufügen und bestätige es.",
          },
          {
            browser: "Edge",
            instruction: "Öffne diese Seite in Edge, öffne das Menü, suche Nach Zum Telefon hinzufügen oder Zum Startbildschirm hinzufügen und bestätige die Verknüpfung.",
            note: "Einige Edge-Versionen auf Android zeigen statt einer direkten Seitenverknüpfung einen App-installieren-Ablauf an.",
          },
        ],
      },
    ],
  },
  ru: {
    cta: "Установить",
    metaTitle: "Установить",
    metaDescription: "Посмотри короткие инструкции для каждого браузера, чтобы добавить FoxiesDeck на главный экран телефона.",
    title: "Добавь FoxiesDeck на главный экран",
    description: "Оставь эту страницу открытой на телефоне и выполни короткие шаги для своего браузера.",
    note: "Названия пунктов меню могут немного отличаться в зависимости от версии браузера.",
    fallback: "Если опции нет, попробуй Safari на iPhone или iPad либо Chrome на Android.",
    sections: [
      {
        title: "iPhone и iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Открой эту страницу в Safari, нажми Поделиться, выбери На экран Домой, оставь Открывать как веб‑приложение включённым и нажми Добавить.",
          },
          {
            browser: "Chrome",
            instruction: "Открой эту страницу в Chrome, нажми Поделиться рядом с адресной строкой, выбери На экран Домой и нажми Добавить.",
          },
          {
            browser: "Firefox",
            instruction: "Открой эту страницу в Firefox, нажми Поделиться в адресной строке, выбери На экран Домой, при желании переименуй и нажми Добавить.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Открой эту страницу в Chrome, открой меню, выбери Добавить на главный экран, затем Создать ярлык и нажми Добавить.",
          },
          {
            browser: "Firefox",
            instruction: "Открой эту страницу в Firefox, открой меню с тремя точками, выбери Добавить на главный экран и при необходимости нажми Добавить два раза.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Открой эту страницу в Samsung Internet, открой меню браузера, найди Добавить страницу в или Добавить на главный экран и подтверди действие.",
          },
          {
            browser: "Edge",
            instruction: "Открой эту страницу в Edge, открой меню, найди Добавить на телефон или Добавить на главный экран и подтверди ярлык.",
            note: "В некоторых версиях Edge на Android вместо прямого ярлыка страницы может открываться сценарий установки приложения.",
          },
        ],
      },
    ],
  },
  fr: {
    cta: "Obtenir l'app",
    metaTitle: "Obtenir l'app",
    metaDescription: "Consulte les étapes courtes selon le navigateur pour ajouter FoxiesDeck à l'écran d'accueil de ton téléphone.",
    title: "Ajouter FoxiesDeck à l'écran d'accueil",
    description: "Garde cette page ouverte sur ton téléphone et suis les étapes courtes pour le navigateur que tu utilises.",
    note: "Les intitulés du menu peuvent varier légèrement selon la version du navigateur.",
    fallback: "Si l'option n'apparaît pas, essaie Safari sur iPhone ou iPad, ou Chrome sur Android.",
    sections: [
      {
        title: "iPhone et iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Ouvre cette page dans Safari, touche Partager, choisis Sur l'écran d'accueil, laisse Ouvrir comme app web activé, puis touche Ajouter.",
          },
          {
            browser: "Chrome",
            instruction: "Ouvre cette page dans Chrome, touche Partager à côté de la barre d'adresse, choisis Sur l'écran d'accueil, puis touche Ajouter.",
          },
          {
            browser: "Firefox",
            instruction: "Ouvre cette page dans Firefox, touche Partager dans la barre d'adresse, choisis Sur l'écran d'accueil, renomme si besoin, puis touche Ajouter.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Ouvre cette page dans Chrome, ouvre le menu, choisis Ajouter à l'écran d'accueil, puis Créer un raccourci, puis touche Ajouter.",
          },
          {
            browser: "Firefox",
            instruction: "Ouvre cette page dans Firefox, ouvre le menu à trois points, choisis Ajouter à l'écran d'accueil, puis touche Ajouter deux fois si demandé.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Ouvre cette page dans Samsung Internet, ouvre le menu du navigateur, cherche Ajouter la page à ou Ajouter à l'écran d'accueil, puis confirme.",
          },
          {
            browser: "Edge",
            instruction: "Ouvre cette page dans Edge, ouvre le menu, cherche Ajouter au téléphone ou Ajouter à l'écran d'accueil, puis confirme le raccourci.",
            note: "Certaines versions d'Edge sur Android peuvent afficher un flux Installer l'application au lieu d'un raccourci direct vers la page.",
          },
        ],
      },
    ],
  },
  es: {
    cta: "Obtener la app",
    metaTitle: "Obtener la app",
    metaDescription: "Mira los pasos cortos según el navegador para añadir FoxiesDeck a la pantalla de inicio de tu teléfono.",
    title: "Añade FoxiesDeck a tu pantalla de inicio",
    description: "Mantén esta página abierta en tu teléfono y sigue los pasos cortos del navegador que usas.",
    note: "Los nombres del menú pueden variar un poco según la versión del navegador.",
    fallback: "Si no ves la opción, prueba Safari en iPhone o iPad, o Chrome en Android.",
    sections: [
      {
        title: "iPhone y iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Abre esta página en Safari, toca Compartir, elige Añadir a pantalla de inicio, deja activado Abrir como app web y luego toca Añadir.",
          },
          {
            browser: "Chrome",
            instruction: "Abre esta página en Chrome, toca Compartir junto a la barra de direcciones, elige Añadir a pantalla de inicio y luego toca Añadir.",
          },
          {
            browser: "Firefox",
            instruction: "Abre esta página en Firefox, toca Compartir en la barra de direcciones, elige Añadir a pantalla de inicio, cambia el nombre si quieres y luego toca Añadir.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Abre esta página en Chrome, abre el menú, elige Añadir a pantalla de inicio, luego Crear acceso directo y después toca Añadir.",
          },
          {
            browser: "Firefox",
            instruction: "Abre esta página en Firefox, abre el menú de tres puntos, elige Añadir a pantalla de inicio y toca Añadir dos veces si te lo pide.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Abre esta página en Samsung Internet, abre el menú del navegador, busca Añadir página a o Añadir a pantalla de inicio y confirma.",
          },
          {
            browser: "Edge",
            instruction: "Abre esta página en Edge, abre el menú, busca Añadir al teléfono o Añadir a pantalla de inicio y confirma el acceso directo.",
            note: "Algunas versiones de Edge en Android pueden mostrar un flujo de Instalar aplicación en lugar de un acceso directo directo a la página.",
          },
        ],
      },
    ],
  },
  it: {
    cta: "Ottieni l'app",
    metaTitle: "Ottieni l'app",
    metaDescription: "Guarda i passaggi brevi per browser per aggiungere FoxiesDeck alla schermata Home del telefono.",
    title: "Aggiungi FoxiesDeck alla schermata Home",
    description: "Tieni aperta questa pagina sul telefono e segui i passaggi brevi per il browser che usi.",
    note: "Le voci del menu possono cambiare leggermente in base alla versione del browser.",
    fallback: "Se non vedi l'opzione, prova Safari su iPhone o iPad oppure Chrome su Android.",
    sections: [
      {
        title: "iPhone e iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Apri questa pagina in Safari, tocca Condividi, scegli Aggiungi a Home, lascia attivo Apri come app web e poi tocca Aggiungi.",
          },
          {
            browser: "Chrome",
            instruction: "Apri questa pagina in Chrome, tocca Condividi accanto alla barra degli indirizzi, scegli Aggiungi a Home e poi tocca Aggiungi.",
          },
          {
            browser: "Firefox",
            instruction: "Apri questa pagina in Firefox, tocca Condividi nella barra degli indirizzi, scegli Aggiungi a Home, rinomina se vuoi e poi tocca Aggiungi.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Apri questa pagina in Chrome, apri il menu, scegli Aggiungi alla schermata Home, poi Crea collegamento e infine tocca Aggiungi.",
          },
          {
            browser: "Firefox",
            instruction: "Apri questa pagina in Firefox, apri il menu con tre puntini, scegli Aggiungi alla schermata Home e tocca Aggiungi due volte se richiesto.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Apri questa pagina in Samsung Internet, apri il menu del browser, cerca Aggiungi pagina a o Aggiungi alla schermata Home e conferma.",
          },
          {
            browser: "Edge",
            instruction: "Apri questa pagina in Edge, apri il menu, cerca Aggiungi al telefono o Aggiungi alla schermata Home e conferma il collegamento.",
            note: "Alcune versioni di Edge su Android possono mostrare il flusso Installa app invece di un collegamento diretto alla pagina.",
          },
        ],
      },
    ],
  },
  pt: {
    cta: "Obter o app",
    metaTitle: "Obter o app",
    metaDescription: "Veja os passos curtos por navegador para adicionar o FoxiesDeck à tela inicial do seu telefone.",
    title: "Adicione o FoxiesDeck à tela inicial",
    description: "Mantenha esta página aberta no seu celular e siga os passos curtos do navegador que você usa.",
    note: "Os nomes do menu podem variar um pouco conforme a versão do navegador.",
    fallback: "Se a opção não aparecer, tente Safari no iPhone ou iPad, ou Chrome no Android.",
    sections: [
      {
        title: "iPhone e iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Abra esta página no Safari, toque em Compartilhar, escolha Adicionar à Tela de Início, deixe Abrir como App da Web ligado e depois toque em Adicionar.",
          },
          {
            browser: "Chrome",
            instruction: "Abra esta página no Chrome, toque em Compartilhar ao lado da barra de endereço, escolha Adicionar à Tela de Início e depois toque em Adicionar.",
          },
          {
            browser: "Firefox",
            instruction: "Abra esta página no Firefox, toque em Compartilhar na barra de endereço, escolha Adicionar à Tela de Início, renomeie se quiser e depois toque em Adicionar.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Abra esta página no Chrome, abra o menu, escolha Adicionar à tela inicial, depois Criar atalho e então toque em Adicionar.",
          },
          {
            browser: "Firefox",
            instruction: "Abra esta página no Firefox, abra o menu de três pontos, escolha Adicionar à tela inicial e toque em Adicionar duas vezes se for solicitado.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Abra esta página no Samsung Internet, abra o menu do navegador, procure Adicionar página a ou Adicionar à tela inicial e confirme.",
          },
          {
            browser: "Edge",
            instruction: "Abra esta página no Edge, abra o menu, procure Adicionar ao telefone ou Adicionar à tela inicial e confirme o atalho.",
            note: "Algumas versões do Edge no Android podem mostrar o fluxo Instalar aplicativo em vez de um atalho direto para a página.",
          },
        ],
      },
    ],
  },
  nl: {
    cta: "Download de app",
    metaTitle: "Download de app",
    metaDescription: "Bekijk de korte browserspecifieke stappen om FoxiesDeck aan het startscherm van je telefoon toe te voegen.",
    title: "Voeg FoxiesDeck toe aan je startscherm",
    description: "Laat deze pagina open op je telefoon en volg de korte stappen voor de browser die je gebruikt.",
    note: "Menunamen kunnen per browserversie iets verschillen.",
    fallback: "Zie je de optie niet, probeer dan Safari op iPhone of iPad, of Chrome op Android.",
    sections: [
      {
        title: "iPhone en iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Open deze pagina in Safari, tik op Deel, kies Zet op beginscherm, laat Open als webapp aan staan en tik daarna op Voeg toe.",
          },
          {
            browser: "Chrome",
            instruction: "Open deze pagina in Chrome, tik op Deel naast de adresbalk, kies Zet op beginscherm en tik daarna op Voeg toe.",
          },
          {
            browser: "Firefox",
            instruction: "Open deze pagina in Firefox, tik op Deel in de adresbalk, kies Zet op beginscherm, hernoem desgewenst en tik daarna op Voeg toe.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Open deze pagina in Chrome, open het menu, kies Toevoegen aan startscherm, kies Snelkoppeling maken en tik daarna op Voeg toe.",
          },
          {
            browser: "Firefox",
            instruction: "Open deze pagina in Firefox, open het menu met drie stippen, kies Toevoegen aan startscherm en tik twee keer op Voeg toe als daarom wordt gevraagd.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Open deze pagina in Samsung Internet, open het browsermenu, zoek Naar Pagina toevoegen aan of Toevoegen aan startscherm en bevestig.",
          },
          {
            browser: "Edge",
            instruction: "Open deze pagina in Edge, open het menu, zoek Naar Toevoegen aan telefoon of Toevoegen aan startscherm en bevestig de snelkoppeling.",
            note: "Sommige Edge-versies op Android tonen mogelijk een App installeren-stroom in plaats van een directe paginasnelkoppeling.",
          },
        ],
      },
    ],
  },
  pl: {
    cta: "Pobierz aplikację",
    metaTitle: "Pobierz aplikację",
    metaDescription: "Zobacz krótkie kroki dla każdej przeglądarki, aby dodać FoxiesDeck do ekranu głównego telefonu.",
    title: "Dodaj FoxiesDeck do ekranu głównego",
    description: "Zostaw tę stronę otwartą w telefonie i wykonaj krótkie kroki dla przeglądarki, której używasz.",
    note: "Nazwy pozycji menu mogą się lekko różnić w zależności od wersji przeglądarki.",
    fallback: "Jeśli nie widzisz tej opcji, spróbuj Safari na iPhonie lub iPadzie albo Chrome na Androidzie.",
    sections: [
      {
        title: "iPhone i iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Otwórz tę stronę w Safari, stuknij Udostępnij, wybierz Dodaj do ekranu początkowego, zostaw Otwórz jako aplikację internetową włączone i stuknij Dodaj.",
          },
          {
            browser: "Chrome",
            instruction: "Otwórz tę stronę w Chrome, stuknij Udostępnij obok paska adresu, wybierz Dodaj do ekranu początkowego i stuknij Dodaj.",
          },
          {
            browser: "Firefox",
            instruction: "Otwórz tę stronę w Firefoxie, stuknij Udostępnij w pasku adresu, wybierz Dodaj do ekranu początkowego, zmień nazwę jeśli chcesz i stuknij Dodaj.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Otwórz tę stronę w Chrome, otwórz menu, wybierz Dodaj do ekranu głównego, potem Utwórz skrót i na końcu stuknij Dodaj.",
          },
          {
            browser: "Firefox",
            instruction: "Otwórz tę stronę w Firefoxie, otwórz menu z trzema kropkami, wybierz Dodaj do ekranu głównego i stuknij Dodaj dwa razy, jeśli pojawi się prośba.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Otwórz tę stronę w Samsung Internet, otwórz menu przeglądarki, znajdź Dodaj stronę do lub Dodaj do ekranu głównego i potwierdź.",
          },
          {
            browser: "Edge",
            instruction: "Otwórz tę stronę w Edge, otwórz menu, znajdź Dodaj do telefonu lub Dodaj do ekranu głównego i potwierdź skrót.",
            note: "Niektóre wersje Edge na Androidzie mogą pokazywać przepływ Zainstaluj aplikację zamiast bezpośredniego skrótu do strony.",
          },
        ],
      },
    ],
  },
  ar: {
    cta: "احصل على التطبيق",
    metaTitle: "احصل على التطبيق",
    metaDescription: "اطلع على الخطوات القصيرة الخاصة بكل متصفح لإضافة FoxiesDeck إلى الشاشة الرئيسية لهاتفك.",
    title: "أضف FoxiesDeck إلى الشاشة الرئيسية",
    description: "اترك هذه الصفحة مفتوحة على هاتفك واتبع الخطوات القصيرة الخاصة بالمتصفح الذي تستخدمه.",
    note: "قد تختلف أسماء عناصر القائمة قليلًا حسب إصدار المتصفح.",
    fallback: "إذا لم يظهر الخيار، جرّب Safari على iPhone أو iPad أو Chrome على Android.",
    sections: [
      {
        title: "iPhone و iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "افتح هذه الصفحة في Safari، واضغط مشاركة، ثم اختر إضافة إلى الشاشة الرئيسية، واترك فتح كتطبيق ويب مفعّلًا، ثم اضغط إضافة.",
          },
          {
            browser: "Chrome",
            instruction: "افتح هذه الصفحة في Chrome، واضغط مشاركة بجانب شريط العنوان، ثم اختر إضافة إلى الشاشة الرئيسية، ثم اضغط إضافة.",
          },
          {
            browser: "Firefox",
            instruction: "افتح هذه الصفحة في Firefox، واضغط مشاركة في شريط العنوان، ثم اختر إضافة إلى الشاشة الرئيسية، ويمكنك تغيير الاسم إذا أردت، ثم اضغط إضافة.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "افتح هذه الصفحة في Chrome، وافتح القائمة، ثم اختر إضافة إلى الشاشة الرئيسية، ثم إنشاء اختصار، وبعد ذلك اضغط إضافة.",
          },
          {
            browser: "Firefox",
            instruction: "افتح هذه الصفحة في Firefox، وافتح قائمة الثلاث نقاط، ثم اختر إضافة إلى الشاشة الرئيسية، ثم اضغط إضافة مرتين إذا طُلب ذلك.",
          },
          {
            browser: "Samsung Internet",
            instruction: "افتح هذه الصفحة في Samsung Internet، وافتح قائمة المتصفح، ثم ابحث عن إضافة الصفحة إلى أو إضافة إلى الشاشة الرئيسية، ثم أكّد العملية.",
          },
          {
            browser: "Edge",
            instruction: "افتح هذه الصفحة في Edge، وافتح القائمة، ثم ابحث عن إضافة إلى الهاتف أو إضافة إلى الشاشة الرئيسية، ثم أكّد الاختصار.",
            note: "قد تعرض بعض إصدارات Edge على Android مسار تثبيت التطبيق بدلًا من إنشاء اختصار مباشر للصفحة.",
          },
        ],
      },
    ],
  },
  ja: {
    cta: "アプリを入手",
    metaTitle: "アプリを入手",
    metaDescription: "FoxiesDeck をスマートフォンのホーム画面に追加するための、ブラウザ別の短い手順を確認できます。",
    title: "FoxiesDeck をホーム画面に追加",
    description: "このページをスマートフォンで開いたまま、使っているブラウザの短い手順に従ってください。",
    note: "メニュー名はブラウザのバージョンによって少し異なる場合があります。",
    fallback: "項目が表示されない場合は、iPhone / iPad では Safari、Android では Chrome を試してください。",
    sections: [
      {
        title: "iPhone・iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Safari でこのページを開き、共有をタップし、ホーム画面に追加を選び、Web アプリとして開くをオンのままにして、追加をタップしてください。",
          },
          {
            browser: "Chrome",
            instruction: "Chrome でこのページを開き、アドレスバー横の共有をタップし、ホーム画面に追加を選んで、追加をタップしてください。",
          },
          {
            browser: "Firefox",
            instruction: "Firefox でこのページを開き、アドレスバーの共有をタップし、ホーム画面に追加を選び、必要なら名前を変更して、追加をタップしてください。",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Chrome でこのページを開き、メニューを開き、ホーム画面に追加を選び、ショートカットを作成を選んでから、追加をタップしてください。",
          },
          {
            browser: "Firefox",
            instruction: "Firefox でこのページを開き、3 点メニューを開き、ホーム画面に追加を選び、求められたら追加を 2 回タップしてください。",
          },
          {
            browser: "Samsung Internet",
            instruction: "Samsung Internet でこのページを開き、ブラウザメニューを開き、ページを追加 または ホーム画面に追加 を見つけて確認してください。",
          },
          {
            browser: "Edge",
            instruction: "Edge でこのページを開き、メニューを開き、電話に追加 または ホーム画面に追加 を見つけて、ショートカットを確認してください。",
            note: "Android 版 Edge の一部バージョンでは、ページの直接ショートカットではなく、アプリをインストールする流れが表示されることがあります。",
          },
        ],
      },
    ],
  },
  ko: {
    cta: "앱 받기",
    metaTitle: "앱 받기",
    metaDescription: "FoxiesDeck를 휴대폰 홈 화면에 추가하는 브라우저별 짧은 안내를 확인하세요.",
    title: "FoxiesDeck를 홈 화면에 추가하기",
    description: "이 페이지를 휴대폰에서 연 상태로 두고, 사용하는 브라우저에 맞는 짧은 안내를 따라가세요.",
    note: "메뉴 이름은 브라우저 버전에 따라 조금 다를 수 있습니다.",
    fallback: "옵션이 보이지 않으면 iPhone 또는 iPad에서는 Safari를, Android에서는 Chrome을 사용해 보세요.",
    sections: [
      {
        title: "iPhone 및 iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "Safari에서 이 페이지를 열고 공유를 누른 다음 홈 화면에 추가를 선택하고, 웹 앱으로 열기를 켠 상태로 두고 추가를 누르세요.",
          },
          {
            browser: "Chrome",
            instruction: "Chrome에서 이 페이지를 열고 주소 표시줄 옆의 공유를 누른 다음 홈 화면에 추가를 선택하고 추가를 누르세요.",
          },
          {
            browser: "Firefox",
            instruction: "Firefox에서 이 페이지를 열고 주소 표시줄의 공유를 누른 다음 홈 화면에 추가를 선택하고, 원하면 이름을 바꾼 뒤 추가를 누르세요.",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "Chrome에서 이 페이지를 열고 메뉴를 연 다음 홈 화면에 추가를 선택하고 바로가기 만들기를 선택한 뒤 추가를 누르세요.",
          },
          {
            browser: "Firefox",
            instruction: "Firefox에서 이 페이지를 열고 점 3개 메뉴를 연 다음 홈 화면에 추가를 선택하고, 요청되면 추가를 두 번 누르세요.",
          },
          {
            browser: "Samsung Internet",
            instruction: "Samsung Internet에서 이 페이지를 열고 브라우저 메뉴를 연 다음 페이지 추가 또는 홈 화면에 추가를 찾아 확인하세요.",
          },
          {
            browser: "Edge",
            instruction: "Edge에서 이 페이지를 열고 메뉴를 연 다음 휴대폰에 추가 또는 홈 화면에 추가를 찾아 바로가기를 확인하세요.",
            note: "일부 Android용 Edge 버전에서는 직접 페이지 바로가기 대신 앱 설치 흐름이 표시될 수 있습니다.",
          },
        ],
      },
    ],
  },
  "zh-CN": {
    cta: "获取应用",
    metaTitle: "获取应用",
    metaDescription: "查看按浏览器区分的简短步骤，把 FoxiesDeck 添加到你的手机主屏幕。",
    title: "将 FoxiesDeck 添加到主屏幕",
    description: "请在手机上保持此页面打开，并按照你正在使用的浏览器对应的简短步骤操作。",
    note: "菜单名称会因浏览器版本不同而略有变化。",
    fallback: "如果看不到该选项，请在 iPhone 或 iPad 上尝试 Safari，在 Android 上尝试 Chrome。",
    sections: [
      {
        title: "iPhone 和 iPad",
        guides: [
          {
            browser: "Safari",
            instruction: "在 Safari 中打开此页面，点按共享，选择添加到主屏幕，保持“作为网页应用打开”为开启状态，然后点按添加。",
          },
          {
            browser: "Chrome",
            instruction: "在 Chrome 中打开此页面，点按地址栏旁边的共享，选择添加到主屏幕，然后点按添加。",
          },
          {
            browser: "Firefox",
            instruction: "在 Firefox 中打开此页面，点按地址栏中的共享，选择添加到主屏幕，如有需要可重命名，然后点按添加。",
          },
        ],
      },
      {
        title: "Android",
        guides: [
          {
            browser: "Chrome",
            instruction: "在 Chrome 中打开此页面，打开菜单，选择添加到主屏幕，再选择创建快捷方式，然后点按添加。",
          },
          {
            browser: "Firefox",
            instruction: "在 Firefox 中打开此页面，打开三点菜单，选择添加到主屏幕，如有提示请点按两次添加。",
          },
          {
            browser: "Samsung Internet",
            instruction: "在 Samsung Internet 中打开此页面，打开浏览器菜单，找到添加页面到或添加到主屏幕，然后确认。",
          },
          {
            browser: "Edge",
            instruction: "在 Edge 中打开此页面，打开菜单，找到添加到手机或添加到主屏幕，然后确认该快捷方式。",
            note: "某些 Android 版 Edge 版本可能会显示安装应用流程，而不是直接创建页面快捷方式。",
          },
        ],
      },
    ],
  },
};

export function getInstallAppCopy(locale: LocaleCode) {
  return INSTALL_APP_COPY[locale] ?? INSTALL_APP_COPY.en;
}
