import type { LocaleCode } from "@/types/domain";

const NATIVE_LOADING_STATUS_COPY: Record<LocaleCode, readonly string[]> = {
  tr: [
    "Foxie'ler kuyruklarını esnetiyor...",
    "Kart mağarası uyanıyor...",
    "Kelime destesi karıştırılıyor...",
    "Kelime kapısı açılıyor...",
    "Rahat çevrimdışı yoluna geçiliyor...",
    "Kartlar oynamaya hazır!",
  ],
  en: [
    "Foxies are stretching their tails...",
    "Waking up the card cave...",
    "Shuffling the word deck...",
    "Opening the word door...",
    "Taking the cozy offline path...",
    "Cards are ready to play!",
  ],
  de: [
    "Die Foxies strecken ihre Schwänze...",
    "Die Kartenhöhle wacht auf...",
    "Das Wortdeck wird gemischt...",
    "Die Worttür wird geöffnet...",
    "Der gemütliche Offline-Weg beginnt...",
    "Die Karten sind spielbereit!",
  ],
  ru: [
    "Лисички потягивают хвостики...",
    "Карточная пещера просыпается...",
    "Словарная колода перемешивается...",
    "Словесная дверь открывается...",
    "Переходим на уютный офлайн-путь...",
    "Карточки готовы к игре!",
  ],
  fr: [
    "Les renards étirent leur queue...",
    "La grotte des cartes se réveille...",
    "Le paquet de mots est mélangé...",
    "La porte des mots s'ouvre...",
    "Le chemin hors ligne se prépare...",
    "Les cartes sont prêtes à jouer !",
  ],
  es: [
    "Los zorritos estiran sus colas...",
    "La cueva de cartas despierta...",
    "Barajando el mazo de palabras...",
    "Abriendo la puerta de palabras...",
    "Tomando el camino sin conexión...",
    "¡Las cartas están listas para jugar!",
  ],
  it: [
    "Le volpi stiracchiano le code...",
    "La grotta delle carte si sveglia...",
    "Mescolando il mazzo di parole...",
    "Aprendo la porta delle parole...",
    "Prendendo il percorso offline...",
    "Le carte sono pronte per giocare!",
  ],
  pt: [
    "As raposinhas esticam as caudas...",
    "A caverna das cartas está acordando...",
    "Embaralhando o baralho de palavras...",
    "Abrindo a porta das palavras...",
    "Seguindo o caminho offline aconchegante...",
    "As cartas estão prontas para jogar!",
  ],
  nl: [
    "De vosjes rekken hun staarten...",
    "De kaartengrot wordt wakker...",
    "De woordenstapel wordt geschud...",
    "De woorddeur gaat open...",
    "We nemen het gezellige offline pad...",
    "De kaarten zijn klaar om te spelen!",
  ],
  pl: [
    "Liski przeciągają ogonki...",
    "Jaskinia kart budzi się...",
    "Tasujemy talię słów...",
    "Otwieramy drzwi słów...",
    "Wybieramy przytulną drogę offline...",
    "Karty są gotowe do gry!",
  ],
  ar: [
    "الثعالب الصغيرة تتمدد بذيلها...",
    "كهف البطاقات يستيقظ...",
    "نخلط مجموعة الكلمات...",
    "نفتح باب الكلمات...",
    "نسلك الطريق المريح بلا إنترنت...",
    "البطاقات جاهزة للعب!",
  ],
  ja: [
    "キツネたちがしっぽを伸ばしています...",
    "カードの洞窟が目を覚まします...",
    "単語デッキをシャッフルしています...",
    "ことばの扉を開いています...",
    "心地よいオフラインの道へ進みます...",
    "カードの準備ができました！",
  ],
  ko: [
    "여우들이 꼬리를 쭉 펴고 있어요...",
    "카드 동굴이 깨어나고 있어요...",
    "단어 덱을 섞고 있어요...",
    "단어 문을 열고 있어요...",
    "편안한 오프라인 길로 가고 있어요...",
    "카드가 플레이할 준비를 마쳤어요!",
  ],
  "zh-CN": [
    "小狐狸正在伸展尾巴...",
    "卡片洞穴正在苏醒...",
    "正在洗牌单词卡组...",
    "正在打开单词之门...",
    "正在走上舒适的离线路...",
    "卡片已经准备好玩啦！",
  ],
};

const NATIVE_LOADING_GATE_COPY: Record<LocaleCode, readonly [string, string]> = {
  tr: ["Tilki misafir listesi kontrol ediliyor...", "Ho\u015f geldin kap\u0131s\u0131 a\u00e7\u0131l\u0131yor!"],
  en: ["Checking the foxie guest list...", "Opening the welcome gate!"],
  de: ["Die Foxie-G\u00e4steliste wird gepr\u00fcft...", "Das Willkommenstor \u00f6ffnet sich!"],
  ru: ["\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c \u0441\u043f\u0438\u0441\u043e\u043a \u043b\u0438\u0441\u044f\u0442...", "\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u043c \u0434\u0432\u0435\u0440\u044c \u0433\u043e\u0441\u0442\u0435\u0439!"],
  fr: ["On v\u00e9rifie la liste des renards...", "La porte de bienvenue s\u2019ouvre !"],
  es: ["Comprobando la lista de zorritos...", "\u00a1Abriendo la puerta de bienvenida!"],
  it: ["Controlliamo la lista delle volpi...", "Apriamo la porta di benvenuto!"],
  pt: ["Conferindo a lista das raposinhas...", "Abrindo a porta de boas-vindas!"],
  nl: ["De vossenlijst wordt gecontroleerd...", "De welkomstdeur gaat open!"],
  pl: ["Sprawdzamy list\u0119 lisk\u00f3w...", "Otwieramy drzwi powitalne!"],
  ar: ["\u0646\u062a\u0641\u0642\u062f \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062b\u0639\u0627\u0644\u0628...", "\u0646\u0641\u062a\u062d \u0628\u0627\u0628 \u0627\u0644\u062a\u0631\u062d\u064a\u0628!"],
  ja: ["\u30ad\u30c4\u30cd\u306e\u30b2\u30b9\u30c8\u30ea\u30b9\u30c8\u3092\u78ba\u8a8d\u4e2d...", "\u3088\u3046\u3053\u305d\u306e\u6249\u3092\u958b\u304d\u307e\u3059\uff01"],
  ko: ["\uc5ec\uc6b0 \uc190\ub2d8 \ubaa9\ub85d\uc744 \ud655\uc778\ud574\uc694...", "\ud658\uc601\uc758 \ubb38\uc744 \uc5f4\uc5b4\uc694!"],
  "zh-CN": ["\u6b63\u5728\u68c0\u67e5\u5c0f\u72d0\u72f8\u7684\u5ba2\u4eba\u540d\u5355...", "\u6b22\u8fce\u5927\u95e8\u6253\u5f00\u5566\uff01"],
};

export function getNativeLoadingStatuses(locale: LocaleCode) {
  const statuses = NATIVE_LOADING_STATUS_COPY[locale] ?? NATIVE_LOADING_STATUS_COPY.en;
  const gateCopy = NATIVE_LOADING_GATE_COPY[locale] ?? NATIVE_LOADING_GATE_COPY.en;
  return [...statuses.slice(0, 3), ...gateCopy, ...statuses.slice(3)];
}

const NATIVE_LOADING_TITLE_COPY: Record<LocaleCode, string> = {
  tr: "Günün Kelimeleri",
  en: "Words of the Day",
  de: "Wörter des Tages",
  ru: "Слова дня",
  fr: "Mots du jour",
  es: "Palabras del día",
  it: "Parole del giorno",
  pt: "Palavras do dia",
  nl: "Woorden van de dag",
  pl: "Słowa dnia",
  ar: "كلمات اليوم",
  ja: "今日の言葉",
  ko: "오늘의 단어",
  "zh-CN": "每日单词",
};

export function getNativeLoadingTitle(locale: LocaleCode) {
  return NATIVE_LOADING_TITLE_COPY[locale] ?? NATIVE_LOADING_TITLE_COPY.en;
}
