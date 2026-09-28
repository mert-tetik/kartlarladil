import { CARD_SEED_LOCALE_ORDER } from "./types";
import type { CardSeedRow } from "./types";
import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";

export type AdditionalExampleStyle =
  | "food"
  | "place"
  | "home"
  | "nature"
  | "health"
  | "people"
  | "transport"
  | "technology"
  | "abstract"
  | "verb";

type TranslationValues = Record<LocaleCode, string>;

interface AdditionalCardDefinition {
  englishKey: string;
  tier: Tier;
  partOfSpeech: string;
  pronunciation: string;
  style: AdditionalExampleStyle;
  translations: TranslationValues;
  nonLatinPronunciations?: Partial<Record<Extract<LocaleCode, "ru" | "ar" | "ja" | "ko" | "zh-CN">, string>>;
}

const locales = CARD_SEED_LOCALE_ORDER;

function translations(
  tr: string,
  en: string,
  de: string,
  ru: string,
  fr: string,
  es: string,
  it: string,
  pt: string,
  nl: string,
  pl: string,
  ar: string,
  ja: string,
  ko: string,
  zhCN: string,
): TranslationValues {
  return { tr, en, de, ru, fr, es, it, pt, nl, pl, ar, ja, ko, "zh-CN": zhCN };
}

function readerize(value: string, fallback: string) {
  const result = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ş", "sh")
    .replaceAll("x", "ks")
    .replaceAll("q", "k")
    .replaceAll("w", "v")
    .replace(/[^a-zı '-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return result || fallback;
}

function buildPronunciations(definition: AdditionalCardDefinition) {
  const fallback = readerize(definition.pronunciation, "kelime");
  const nonLatin = definition.nonLatinPronunciations ?? {};

  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      nonLatin[locale as keyof typeof nonLatin] ?? readerize(definition.translations[locale], fallback),
    ]),
  ) as Record<LocaleCode, string>;
}

const definitions = [
  {
    englishKey: "classmate", tier: "A1", partOfSpeech: "noun", pronunciation: "klasmeyt", style: "people",
    translations: translations("sınıf arkadaşı", "classmate", "Mitschüler", "odnoklassnik", "camarade de classe", "compañero de clase", "compagno di classe", "colega de turma", "klasgenoot", "kolega z klasy", "zamil dirasa", "kurasumeito", "ban chingu", "tongxue"),
    nonLatinPronunciations: { ru: "odnoklassnik", ar: "zamıl dirasa", ja: "kurasumeito", ko: "ban chingu", "zh-CN": "tung shye" },
  },
  {
    englishKey: "semester", tier: "A2", partOfSpeech: "noun", pronunciation: "simester", style: "abstract",
    translations: translations("yarıyıl", "semester", "Semester", "semestr", "semestre", "semestre", "semestre", "semestre", "semester", "semestr", "fasl dirasi", "gakki", "hakgi", "xueqi"),
    nonLatinPronunciations: { ru: "semestr", ar: "fasl dirasi", ja: "gakki", ko: "hakki", "zh-CN": "shweh chi" },
  },
  {
    englishKey: "invoice", tier: "B1", partOfSpeech: "noun", pronunciation: "invoys", style: "place",
    translations: translations("hesap belgesi", "invoice", "Rechnungsschein", "schet-faktura", "note de frais", "documento de factura", "documento fiscale", "fatura", "factuur", "faktura", "fatura", "seikyusho", "cheonggu seo", "fapiao"),
    nonLatinPronunciations: { ru: "schot faktura", ar: "fatoura", ja: "seikyusho", ko: "chongu so", "zh-CN": "fa pyao" },
  },
  {
    englishKey: "dessert", tier: "A1", partOfSpeech: "noun", pronunciation: "dizert", style: "food",
    translations: translations("şekerli tatlı", "dessert", "Dessert", "desert", "dessert", "postre", "dolce al cucchiaio", "sobremesa", "nagerecht", "deser", "halwa", "dezato", "diseoteu", "tian dian"),
    nonLatinPronunciations: { ru: "desert", ar: "halva", ja: "dezato", ko: "disoteu", "zh-CN": "tyen dyen" },
  },
  {
    englishKey: "napkin", tier: "A1", partOfSpeech: "noun", pronunciation: "nepkin", style: "food",
    translations: translations("peçete", "napkin", "Serviette", "salfetka", "serviette de table", "servilleta", "tovagliolo", "guardanapo", "servet", "serwetka", "mandil", "napukin", "hyujeji", "can jin"),
    nonLatinPronunciations: { ru: "salfetka", ar: "mandil", ja: "napukin", ko: "hyujeji", "zh-CN": "can jin" },
  },
  {
    englishKey: "refund", tier: "B1", partOfSpeech: "noun", pronunciation: "rifand", style: "place",
    translations: translations("geri ödeme", "refund", "Rückerstattung", "vozvrat", "remboursement", "reembolso", "rimborso", "reembolso", "terugbetaling", "zwrot", "istirdad", "henkin", "hwanbul", "tui kuan"),
    nonLatinPronunciations: { ru: "vozvrat", ar: "istirdad", ja: "henkin", ko: "hvanbul", "zh-CN": "tway kuan" },
  },
  {
    englishKey: "checkout", tier: "A2", partOfSpeech: "noun", pronunciation: "chekaût", style: "place",
    translations: translations("kasa", "checkout", "Kasse", "kassa", "caisse", "punto de pago", "cassa", "finalização da compra", "kassa", "kasa", "khashier", "reji", "kyeshi", "shouyin tai"),
    nonLatinPronunciations: { ru: "kassa", ar: "hashiya", ja: "reji", ko: "keshwi", "zh-CN": "show yin tai" },
  },
  {
    englishKey: "cashier", tier: "A2", partOfSpeech: "noun", pronunciation: "keshir", style: "people",
    translations: translations("kasiyer", "cashier", "Kassierer", "kassir", "caissier", "cajero", "cassiere", "atendente de caixa", "kassier", "kasjer", "amin sanduk", "reji tanto", "kaesiyeo", "shouyin yuan"),
    nonLatinPronunciations: { ru: "kassir", ar: "amin sanduk", ja: "reji tanto", ko: "keshieo", "zh-CN": "show yin yuen" },
  },
  {
    englishKey: "apricot", tier: "A2", partOfSpeech: "noun", pronunciation: "eyprikot", style: "food",
    translations: translations("kayısı", "apricot", "Aprikose", "abrikos", "abricot", "albaricoque", "albicocca", "damasco", "abrikoos", "morela", "mishmish", "anzu", "salgu", "xing"),
    nonLatinPronunciations: { ru: "abrikos", ar: "mishmish", ja: "anzu", ko: "salgu", "zh-CN": "shing" },
  },
  {
    englishKey: "fig", tier: "A2", partOfSpeech: "noun", pronunciation: "fig", style: "food",
    translations: translations("incir", "fig", "Feige", "inzhir", "figue", "higo", "fico", "figo", "vijg", "figa", "tin", "ichijiku", "muguava", "vu hua"),
    nonLatinPronunciations: { ru: "inzhir", ar: "tin", ja: "ichijiku", ko: "muguava", "zh-CN": "vu hua" },
  },
  {
    englishKey: "raspberry", tier: "B1", partOfSpeech: "noun", pronunciation: "razberi", style: "food",
    translations: translations("ahududu", "raspberry", "Himbeere", "malina", "framboise", "frambuesa", "lampone", "framboesa", "framboos", "malina", "tut", "razuberi", "bokbunja", "fumei"),
    nonLatinPronunciations: { ru: "malina", ar: "tut", ja: "razuberi", ko: "bokpunja", "zh-CN": "fu mei" },
  },
  {
    englishKey: "kiwi", tier: "A1", partOfSpeech: "noun", pronunciation: "kivi", style: "food",
    translations: translations("kivi", "kiwi", "Kiwi", "kivi", "kiwi", "kiwi", "kiwi", "kiwi", "kiwi", "kiwi", "kivi", "kiui", "kiwi", "mi hou tao"),
    nonLatinPronunciations: { ru: "kivi", ar: "kiwi", ja: "kiui", ko: "kiwi", "zh-CN": "mi hou tao" },
  },
  {
    englishKey: "calendar", tier: "A1", partOfSpeech: "noun", pronunciation: "kelendir", style: "abstract",
    translations: translations("takvim", "calendar", "Kalender", "kalendar", "calendrier", "calendario", "calendario", "calendario", "kalender", "kalendarz", "taqwim", "karenda", "dalryeok", "ri li"),
    nonLatinPronunciations: { ru: "kalendar", ar: "takvim", ja: "karenda", ko: "tallyok", "zh-CN": "rı lı" },
  },
  {
    englishKey: "luggage", tier: "A2", partOfSpeech: "noun", pronunciation: "lagıc", style: "transport",
    translations: translations("bagaj", "luggage", "Gepäck", "bagazh", "bagages", "equipaje", "bagaglio", "bagagem", "bagage", "bagaz", "amata", "nimotsu", "jimi", "xing li"),
    nonLatinPronunciations: { ru: "bagaj", ar: "amata", ja: "nimotsu", ko: "jimi", "zh-CN": "shing li" },
  },
  {
    englishKey: "suitcase", tier: "A2", partOfSpeech: "noun", pronunciation: "sutkeys", style: "transport",
    translations: translations("bavul", "suitcase", "Koffer", "chemodan", "valise", "maleta", "valigia", "mala", "koffer", "walizka", "haqiba", "sutsukesu", "kaebang", "xing li xiang"),
    nonLatinPronunciations: { ru: "chemodan", ar: "hakiba", ja: "sutsukesu", ko: "kebang", "zh-CN": "shing li shyang" },
  },
  {
    englishKey: "hostel", tier: "A2", partOfSpeech: "noun", pronunciation: "hostel", style: "place",
    translations: translations("pansiyon", "hostel", "Hostel", "hostel", "auberge", "albergue", "ostello", "albergue", "jeugdherberg", "hostel", "nas", "gesutohausu", "hosutel", "qing nian lushe"),
    nonLatinPronunciations: { ru: "hostel", ar: "nas", ja: "gesutohausu", ko: "hosutel", "zh-CN": "ching nyen loo she" },
  },
  {
    englishKey: "customs", tier: "B1", partOfSpeech: "noun", pronunciation: "kastımz", style: "place",
    translations: translations("gümrük", "customs", "Zollabfertigung", "tamozhnya", "douane", "aduana", "dogana", "alfândega", "douane", "clo", "jamarik", "zeikan", "sesgwan", "hai guan"),
    nonLatinPronunciations: { ru: "tamojnya", ar: "jamarik", ja: "zeykan", ko: "segvan", "zh-CN": "hay guan" },
  },
  {
    englishKey: "sofa", tier: "A1", partOfSpeech: "noun", pronunciation: "sofa", style: "home",
    translations: translations("kanepe", "sofa", "Sofa", "divan", "canapé", "sofá", "divano", "sofá", "zitbank", "sofa", "arika", "sofa", "sofa", "sha fa"),
    nonLatinPronunciations: { ru: "divan", ar: "arika", ja: "sofa", ko: "sofa", "zh-CN": "sha fa" },
  },
  {
    englishKey: "wardrobe", tier: "A2", partOfSpeech: "noun", pronunciation: "vordrob", style: "home",
    translations: translations("gardırop", "wardrobe", "Kleiderschrank", "shkaf", "penderie", "ropero", "guardaroba", "guarda-roupa", "kledingkast", "szafa", "khizana", "iodan tansu", "otjang", "yigui"),
    nonLatinPronunciations: { ru: "shkaf", ar: "hizana", ja: "iodan tansu", ko: "otjang", "zh-CN": "i gvey" },
  },
  {
    englishKey: "drawer", tier: "A2", partOfSpeech: "noun", pronunciation: "droır", style: "home",
    translations: translations("çekmece", "drawer", "Schublade", "yashchik", "tiroir", "cajón", "cassetto", "gaveta", "la", "szuflada", "durj", "hikidashi", "seorap", "chou ti"),
    nonLatinPronunciations: { ru: "yashik", ar: "durj", ja: "hikidashi", ko: "sorap", "zh-CN": "chow ti" },
  },
  {
    englishKey: "pillow", tier: "A1", partOfSpeech: "noun", pronunciation: "pilov", style: "home",
    translations: translations("yastık", "pillow", "Kissen", "podushka", "oreiller", "almohada", "cuscino", "travesseiro", "kussen", "poduszka", "wisada", "makura", "begae", "zhen tou"),
    nonLatinPronunciations: { ru: "podushka", ar: "visada", ja: "makura", ko: "pege", "zh-CN": "jen tow" },
  },
  {
    englishKey: "balcony", tier: "A2", partOfSpeech: "noun", pronunciation: "belkoni", style: "home",
    translations: translations("balkon", "balcony", "Balkon", "balkon", "balcon", "balcón", "balcone", "varanda", "balkon", "balkon", "shurfa", "beranda", "balconi", "yang tai"),
    nonLatinPronunciations: { ru: "balkon", ar: "shurfa", ja: "beranda", ko: "balkoni", "zh-CN": "yang tai" },
  },
  {
    englishKey: "allergy", tier: "B1", partOfSpeech: "noun", pronunciation: "elırci", style: "health",
    translations: translations("alerji", "allergy", "Allergie", "allergiya", "allergie", "alergia", "allergia", "alergia", "allergie", "alergia", "hasasiya", "arerugi", "allereugi", "guo min"),
    nonLatinPronunciations: { ru: "allergiya", ar: "hasasiya", ja: "arerugi", ko: "allereugi", "zh-CN": "guo min" },
  },
  {
    englishKey: "cough", tier: "A2", partOfSpeech: "noun", pronunciation: "kof", style: "health",
    translations: translations("öksürük", "cough", "Husten", "kashel", "toux", "tos", "tosse", "tosse", "hoest", "kaszel", "sual", "seki", "gichim", "ke sou"),
    nonLatinPronunciations: { ru: "kashel", ar: "sual", ja: "seki", ko: "gichim", "zh-CN": "ke sou" },
  },
  {
    englishKey: "bandage", tier: "A2", partOfSpeech: "noun", pronunciation: "bendıc", style: "health",
    translations: translations("bandaj", "bandage", "Verband", "povyazka", "pansement", "vendaje", "bendaggio", "curativo", "verband", "bandaż", "shash", "hokotai", "bandeeji", "bang dai"),
    nonLatinPronunciations: { ru: "povyazka", ar: "shash", ja: "hokotai", ko: "bandeeji", "zh-CN": "bang dai" },
  },
  {
    englishKey: "charger", tier: "A2", partOfSpeech: "noun", pronunciation: "charcır", style: "technology",
    translations: translations("şarj cihazı", "charger", "Ladegerät", "zaryadnoe ustroystvo", "chargeur", "cargador", "caricatore", "carregador", "oplader", "ladowarka", "shahin", "jucha ki", "chungjeongi", "chong dian qi"),
    nonLatinPronunciations: { ru: "zaryadnoye ustroystvo", ar: "shahin", ja: "jucha ki", ko: "chungjeongi", "zh-CN": "chong dyen chi" },
  },
  {
    englishKey: "microphone", tier: "A2", partOfSpeech: "noun", pronunciation: "maykrofon", style: "technology",
    translations: translations("mikrofon", "microphone", "Mikrofon", "mikrofon", "microphone", "micrófono", "microfono", "microfone", "microfoon", "mikrofon", "mikrofon", "maikurofon", "maikeuropone", "mai ke feng"),
    nonLatinPronunciations: { ru: "mikrofon", ar: "mikrofon", ja: "maikurofon", ko: "maikeuropone", "zh-CN": "mai ke feng" },
  },
  {
    englishKey: "folder", tier: "A1", partOfSpeech: "noun", pronunciation: "foulder", style: "technology",
    translations: translations("klasör", "folder", "Ordner", "papka", "dossier", "carpeta", "cartella", "pasta", "map", "folder", "milaf", "foruda", "poldeo", "wen jian jia"),
    nonLatinPronunciations: { ru: "papka", ar: "milaf", ja: "foruda", ko: "poldeo", "zh-CN": "ven jyen jya" },
  },
  {
    englishKey: "upload", tier: "B1", partOfSpeech: "verb", pronunciation: "apload", style: "verb",
    translations: translations("yüklemek", "upload", "hochladen", "zagruzhat", "téléverser", "subir", "caricare", "enviar arquivo", "uploaden", "przesyłać", "yarfa", "appurodo suru", "eopload hada", "shang chuan"),
    nonLatinPronunciations: { ru: "zagrujat", ar: "yarfa", ja: "appurodo suru", ko: "eopload hada", "zh-CN": "shang chvan" },
  },
  {
    englishKey: "sadness", tier: "A2", partOfSpeech: "noun", pronunciation: "sednis", style: "people",
    translations: translations("üzüntü", "sadness", "Traurigkeit", "grust", "tristesse", "tristeza", "tristezza", "sentimento triste", "verdriet", "smutek", "huzn", "kanashimi", "seulpeum", "bei shang"),
    nonLatinPronunciations: { ru: "grust", ar: "huzn", ja: "kanashimi", ko: "seulpeum", "zh-CN": "bay shang" },
  },
  {
    englishKey: "teeth", tier: "A1", partOfSpeech: "noun", pronunciation: "tiith", style: "health",
    translations: translations("dişler", "teeth", "Zähne", "zuby", "dents", "dientes", "denti", "dentes", "tanden", "zęby", "asnan", "ha", "i", "ya chi"),
    nonLatinPronunciations: { ru: "zubi", ar: "asnan", ja: "ha", ko: "i", "zh-CN": "ya chi" },
  },
  {
    englishKey: "scarf", tier: "A1", partOfSpeech: "noun", pronunciation: "skarf", style: "people",
    translations: translations("atkı", "scarf", "Schal", "sharf", "écharpe", "bufanda", "sciarpa", "cachecol", "sjaal", "szalik", "shal", "mafurā", "mokdori", "wei jin"),
    nonLatinPronunciations: { ru: "sharf", ar: "shal", ja: "mafura", ko: "mokdori", "zh-CN": "vey jin" },
  },
  {
    englishKey: "boots", tier: "A1", partOfSpeech: "noun", pronunciation: "buuts", style: "people",
    translations: translations("çizme", "boots", "Stiefelpaare", "sapogi", "paire de bottes", "botas", "stivali", "botas", "laarzen", "kozaki", "jizama", "butsu", "janghwa", "xue zi"),
    nonLatinPronunciations: { ru: "sapogi", ar: "jizama", ja: "butsu", ko: "jangva", "zh-CN": "shyue dzı" },
  },
  {
    englishKey: "nephew", tier: "A2", partOfSpeech: "noun", pronunciation: "nefyu", style: "people",
    translations: translations("yeğen", "nephew", "Neffe", "plemyannik", "neveu", "sobrino", "nipote", "sobrinho", "zoon van broer", "siostrzeniec", "ibn al-akh", "oi", "joka", "wai sheng"),
    nonLatinPronunciations: { ru: "plemyannik", ar: "ibn al ah", ja: "oi", ko: "joka", "zh-CN": "vay shung" },
  },
  {
    englishKey: "niece", tier: "A2", partOfSpeech: "noun", pronunciation: "niis", style: "people",
    translations: translations("kız yeğen", "niece", "Nichte", "plemyannitsa", "nièce", "sobrina", "nipote femmina", "sobrinha", "nicht", "siostrzenica", "bint al-akh", "mei", "joka ttal", "wai sheng nu"),
    nonLatinPronunciations: { ru: "plemyannitsa", ar: "bint al ah", ja: "mey", ko: "joka", "zh-CN": "vay shung nyu" },
  },
  {
    englishKey: "neighbor", tier: "A1", partOfSpeech: "noun", pronunciation: "neybır", style: "people",
    translations: translations("yakın komşu", "neighbor", "Nachbarschaftsmitglied", "sosed", "habitant voisin", "persona vecina", "persona vicina", "morador vizinho", "buurpersoon", "sasiad", "jar", "rinjin", "ijut", "lin ju"),
    nonLatinPronunciations: { ru: "sosed", ar: "jar", ja: "rinjin", ko: "ijut", "zh-CN": "lin ju" },
  },
  {
    englishKey: "fog", tier: "A2", partOfSpeech: "noun", pronunciation: "fog", style: "nature",
    translations: translations("sis", "fog", "Nebel", "tuman", "brouillard", "niebla", "nebbia", "nevoeiro", "mist", "mgła", "dabab", "kiri", "angae", "wu"),
    nonLatinPronunciations: { ru: "tuman", ar: "dabab", ja: "kiri", ko: "angae", "zh-CN": "vu" },
  },
  {
    englishKey: "sunny", tier: "A1", partOfSpeech: "adjective", pronunciation: "sani", style: "nature",
    translations: translations("güneşli", "sunny", "sonnig", "solnechni", "ensoleillé", "soleado", "soleggiato", "ensolarado", "zonnig", "sloneczny", "mushmis", "hareta", "haennal", "qing lang"),
    nonLatinPronunciations: { ru: "solnechni", ar: "mushmis", ja: "hareta", ko: "haennal", "zh-CN": "ching lang" },
  },
  {
    englishKey: "rainy", tier: "A1", partOfSpeech: "adjective", pronunciation: "reyni", style: "nature",
    translations: translations("yağmurlu", "rainy", "regnerisch", "dozhdlivi", "pluvieux", "lluvioso", "piovoso", "chuvoso", "regenachtig", "deszczowy", "matar", "ame no", "비오는", "xia yu"),
    nonLatinPronunciations: { ru: "dojdlivi", ar: "matar", ja: "ame no", ko: "pi o neun", "zh-CN": "shya yu" },
  },
  {
    englishKey: "windy", tier: "A1", partOfSpeech: "adjective", pronunciation: "vindi", style: "nature",
    translations: translations("rüzgarlı", "windy", "windig", "vetreni", "venteux", "ventoso", "ventoso", "ventoso", "winderig", "wietrzny", "asif", "kaze no", "baram bureuneun", "feng da"),
    nonLatinPronunciations: { ru: "vetreni", ar: "asif", ja: "kaze no", ko: "baram bureunun", "zh-CN": "feng da" },
  },
  {
    englishKey: "rabbit", tier: "A1", partOfSpeech: "noun", pronunciation: "rebit", style: "nature",
    translations: translations("tavşan", "rabbit", "Kaninchen", "krolik", "lapin", "conejo", "coniglio", "coelho", "konijn", "krolik", "arnab", "usagi", "tokki", "tu zi"),
    nonLatinPronunciations: { ru: "krolik", ar: "arnab", ja: "usagi", ko: "tokki", "zh-CN": "tu dzı" },
  },
  {
    englishKey: "duck", tier: "A1", partOfSpeech: "noun", pronunciation: "dak", style: "nature",
    translations: translations("ördek", "duck", "Ente", "utka", "canard", "pato", "anatra", "pato", "eend", "kaczka", "bata", "ahiru", "ori", "ya zi"),
    nonLatinPronunciations: { ru: "utka", ar: "bata", ja: "ahiru", ko: "ori", "zh-CN": "ya dzı" },
  },
  {
    englishKey: "goat", tier: "A1", partOfSpeech: "noun", pronunciation: "gout", style: "nature",
    translations: translations("keçi", "goat", "Ziege", "koza", "chèvre", "cabra", "capra", "cabra", "geit", "koza", "maiz", "yagi", "yeomso", "shan yang"),
    nonLatinPronunciations: { ru: "koza", ar: "maiz", ja: "yagi", ko: "yomso", "zh-CN": "shan yang" },
  },
  {
    englishKey: "wolf", tier: "A2", partOfSpeech: "noun", pronunciation: "vulf", style: "nature",
    translations: translations("kurt", "wolf", "Wolf", "volk", "loup", "lobo", "lupo", "lobo", "wolf", "wilk", "dhib", "ookami", "neukdae", "lang"),
    nonLatinPronunciations: { ru: "volk", ar: "dib", ja: "okami", ko: "nukde", "zh-CN": "lang" },
  },
  {
    englishKey: "tram", tier: "A2", partOfSpeech: "noun", pronunciation: "trem", style: "transport",
    translations: translations("tramvay", "tram", "Straßenbahn", "tramvay", "tramway", "tranvía", "tram", "bonde", "tram", "tramwaj", "tram", "romen densha", "teureom", "you gui dian che"),
    nonLatinPronunciations: { ru: "tramvay", ar: "tram", ja: "romen densha", ko: "teureom", "zh-CN": "yo gui dyen che" },
  },
  {
    englishKey: "subway", tier: "A1", partOfSpeech: "noun", pronunciation: "sabvey", style: "transport",
    translations: translations("metro", "subway", "U-Bahn", "metro", "métro", "ferrocarril subterráneo", "metropolitana", "metrô", "metro", "metro", "metro", "chikatetsu", "jihakcheol", "di tie"),
    nonLatinPronunciations: { ru: "metro", ar: "metro", ja: "chikatetsu", ko: "jihacheol", "zh-CN": "dı tye" },
  },
  {
    englishKey: "scooter", tier: "A2", partOfSpeech: "noun", pronunciation: "skuuter", style: "transport",
    translations: translations("scooter", "scooter", "Roller", "skuter", "scooter", "patinete", "monopattino", "patinete", "scooter", "hulajnoga", "daraja", "sukuta", "seukuteo", "dian dong che"),
    nonLatinPronunciations: { ru: "skuter", ar: "daraja", ja: "sukuta", ko: "seukuteo", "zh-CN": "dyen dong che" },
  },
  {
    englishKey: "ferry", tier: "A2", partOfSpeech: "noun", pronunciation: "feri", style: "transport",
    translations: translations("feribot", "ferry", "Fähre", "parom", "ferry", "transbordador", "traghetto", "balsa", "veerboot", "prom", "markab naql", "feri", "peori", "du lun"),
    nonLatinPronunciations: { ru: "parom", ar: "markab nakl", ja: "feri", ko: "peori", "zh-CN": "du lun" },
  },
  {
    englishKey: "center", tier: "A1", partOfSpeech: "noun", pronunciation: "sentır", style: "place",
    translations: translations("şehir merkez noktası", "center", "Stadtmitte", "tsentr", "milieu de ville", "parte central", "parte centrale", "parte central", "stadscentrum", "srodek miasta", "markaz", "senta", "jungsim", "zhong xin"),
    nonLatinPronunciations: { ru: "tsentr", ar: "markaz", ja: "senta", ko: "jungsim", "zh-CN": "jong shin" },
  },
  {
    englishKey: "commute", tier: "B1", partOfSpeech: "verb", pronunciation: "kemyut", style: "verb",
    translations: translations("işe gidip gelmek", "commute", "pendeln", "ezdit na rabotu", "faire la navette", "desplazarse", "pendolare", "deslocar-se", "pendelen", "dojeżdżać", "yantakil", "tsukin suru", "tonggeun hada", "tong qin"),
    nonLatinPronunciations: { ru: "yezdit na rabotu", ar: "yantakil", ja: "tsukin suru", ko: "tongin hada", "zh-CN": "tong chin" },
  },
  {
    englishKey: "volleyball", tier: "A1", partOfSpeech: "noun", pronunciation: "volibol", style: "people",
    translations: translations("voleybol", "volleyball", "Volleyball", "voleybol", "volley-ball", "voleibol", "pallavolo", "voleibol", "volleybal", "siatkowka", "kurat al-tayir", "bareboru", "baeguseu", "pai qiu"),
    nonLatinPronunciations: { ru: "voleybol", ar: "kurat tayir", ja: "bareboru", ko: "beguseu", "zh-CN": "pay chyow" },
  },
  {
    englishKey: "cycling", tier: "A2", partOfSpeech: "noun", pronunciation: "saykling", style: "transport",
    translations: translations("bisiklet sürme", "cycling", "Radfahren", "velosport", "cyclisme", "ciclismo", "ciclismo", "ciclismo", "fietsen", "kolarstwo", "quyud darajat", "saikuringu", "jajeongeo", "zi xing che"),
    nonLatinPronunciations: { ru: "velosport", ar: "quyud darajat", ja: "saikuringu", ko: "jajeongeo", "zh-CN": "dzı shing che" },
  },
  {
    englishKey: "hiking", tier: "A2", partOfSpeech: "noun", pronunciation: "hayking", style: "nature",
    translations: translations("doğa yürüyüşü", "hiking", "Bergwandern", "peshiy turizm", "randonnée", "senderismo", "escursionismo", "trilha de montanha", "wandelen", "turystyka piesza", "mashi fil jibaal", "haikingu", "deung-san", "bu xing"),
    nonLatinPronunciations: { ru: "peshiy turizm", ar: "mashi fil jibal", ja: "haikingu", ko: "dungsan", "zh-CN": "boo shing" },
  },
  {
    englishKey: "knitting", tier: "B1", partOfSpeech: "noun", pronunciation: "niting", style: "people",
    translations: translations("örgü", "knitting", "Stricken", "vyazanie", "tricot", "tejido a mano", "maglia", "tricô", "breien", "dzierganie", "hiyaka", "amikomono", "tteugejil", "zhi mao yi"),
    nonLatinPronunciations: { ru: "vyazaniye", ar: "hiyaka", ja: "amikomono", ko: "tteugejil", "zh-CN": "jr mao yi" },
  },
  {
    englishKey: "violin", tier: "A1", partOfSpeech: "noun", pronunciation: "vayolin", style: "people",
    translations: translations("keman", "violin", "Geige", "skripka", "violon", "violín", "violino", "violino", "viool", "skrzypce", "kamanja", "baiorin", "ba-i-ollin", "ti qin"),
    nonLatinPronunciations: { ru: "skripka", ar: "kamanja", ja: "baiorin", ko: "baiolin", "zh-CN": "tı chin" },
  },
  {
    englishKey: "flute", tier: "A2", partOfSpeech: "noun", pronunciation: "fluut", style: "people",
    translations: translations("flüt", "flute", "Flöte", "fleyta", "flûte", "flauta", "flauto", "flauta", "fluit", "flet", "nay", "furu-to", "piri", "chang di"),
    nonLatinPronunciations: { ru: "fleyta", ar: "nay", ja: "furu-to", ko: "piri", "zh-CN": "chang dı" },
  },
  {
    englishKey: "lyrics", tier: "B1", partOfSpeech: "noun", pronunciation: "liriks", style: "people",
    translations: translations("şarkı sözleri", "lyrics", "Liedtext", "tekst pesni", "paroles", "letra musical", "parole musicali", "letra musical", "songtekst", "tekst piosenki", "kalimat al-ughniya", "kashi", "gasa", "ge ci"),
    nonLatinPronunciations: { ru: "tekst pesni", ar: "kalimat ugnia", ja: "kashi", ko: "gasa", "zh-CN": "ge tsı" },
  },
  {
    englishKey: "playlist", tier: "A2", partOfSpeech: "noun", pronunciation: "pleylist", style: "technology",
    translations: translations("çalma listesi", "playlist", "Wiedergabeliste", "pleylist", "liste de lecture", "lista de reproducción", "scaletta", "lista de reprodução", "afspeellijst", "playlista", "qa-imat tashghil", "pureirisuto", "jaesaeng mokrok", "bo fang lie biao"),
    nonLatinPronunciations: { ru: "pleylist", ar: "kaimat tashgil", ja: "pureirisuto", ko: "jeseng mongrok", "zh-CN": "bo fang lye byao" },
  },
  {
    englishKey: "garlic", tier: "A1", partOfSpeech: "noun", pronunciation: "garlik", style: "food",
    translations: translations("sarımsak", "garlic", "Knoblauch", "chesnok", "ail", "ajo", "aglio", "alho", "knoflook", "czosnek", "thum", "ninniku", "maneul", "da suan"),
    nonLatinPronunciations: { ru: "chesnok", ar: "sum", ja: "ninniku", ko: "maneul", "zh-CN": "da suan" },
  },
  {
    englishKey: "electrician", tier: "B1", partOfSpeech: "noun", pronunciation: "ilektrishın", style: "people",
    translations: translations("elektrikçi", "electrician", "Elektriker", "elektrik", "électricien", "electricista", "elettricista", "eletricista", "elektricien", "elektryk", "kahrabai", "denkiya", "jeonggi gisulja", "dian gong"),
    nonLatinPronunciations: { ru: "elektrik", ar: "kahrabai", ja: "denkiya", ko: "jonggi gisulja", "zh-CN": "dyen gong" },
  },
  {
    englishKey: "receptionist", tier: "B1", partOfSpeech: "noun", pronunciation: "risepshınist", style: "people",
    translations: translations("resepsiyonist", "receptionist", "Rezeptionist", "administrator", "réceptionniste", "recepcionista", "receptionist", "rececionista", "receptionist", "recepcjonista", "muwazzaf istiqbal", "uketsuke", "jeopsuga", "qian tai"),
    nonLatinPronunciations: { ru: "administrator", ar: "mu vazzaf istikbal", ja: "uketsuke", ko: "jopsuga", "zh-CN": "chyen tay" },
  },
  {
    englishKey: "gray", tier: "A1", partOfSpeech: "adjective", pronunciation: "grey", style: "abstract",
    translations: translations("gri renk", "gray", "graue Farbe", "seriy", "couleur grise", "color gris", "colore grigio", "cinzento", "grijze kleur", "kolor szary", "ramadi", "haiiro", "hoesaek", "hui se"),
    nonLatinPronunciations: { ru: "seriy", ar: "ramadi", ja: "haiiro", ko: "hoesaek", "zh-CN": "hway se" },
  },
  {
    englishKey: "triangle", tier: "A2", partOfSpeech: "noun", pronunciation: "trayengıl", style: "abstract",
    translations: translations("üçgen", "triangle", "Dreieck", "treugolnik", "triangle", "triángulo", "triangolo", "triângulo", "driehoek", "trojkat", "muthallath", "sankakkei", "sammakgak", "san jiao xing"),
    nonLatinPronunciations: { ru: "treugolnik", ar: "musallas", ja: "sankakkei", ko: "sammakgak", "zh-CN": "san jyao shing" },
  },
  {
    englishKey: "rectangle", tier: "A2", partOfSpeech: "noun", pronunciation: "rektengıl", style: "abstract",
    translations: translations("dikdörtgen", "rectangle", "Rechteck", "pryamougolnik", "rectangle", "rectángulo", "rettangolo", "retângulo", "rechthoek", "prostokat", "mustatil", "chokkeiko", "sag-gak-hyeong", "chang fang xing"),
    nonLatinPronunciations: { ru: "pryamougolnik", ar: "mustatil", ja: "chokkeiko", ko: "sagak hyeong", "zh-CN": "chang fang shing" },
  },
  {
    englishKey: "zero", tier: "A1", partOfSpeech: "noun", pronunciation: "ziro", style: "abstract",
    translations: translations("sıfır", "zero", "Null", "nol", "zéro", "cero", "zero", "zero", "nul", "zero", "sifr", "zero", "je-ro", "ling"),
    nonLatinPronunciations: { ru: "nol", ar: "sifr", ja: "zero", ko: "jero", "zh-CN": "ling" },
  },
  {
    englishKey: "two", tier: "A1", partOfSpeech: "noun", pronunciation: "tuu", style: "abstract",
    translations: translations("iki", "two", "zwei", "dva", "deux", "dos", "due", "dois", "twee", "dwa", "ithnan", "ni", "dul", "er"),
    nonLatinPronunciations: { ru: "dva", ar: "isnan", ja: "ni", ko: "dul", "zh-CN": "ar" },
  },
  {
    englishKey: "three", tier: "A1", partOfSpeech: "noun", pronunciation: "thrii", style: "abstract",
    translations: translations("üç", "three", "drei", "tri", "trois", "tres", "tre", "três", "drie", "trzy", "thalatha", "san", "set", "san"),
    nonLatinPronunciations: { ru: "tri", ar: "salasa", ja: "san", ko: "set", "zh-CN": "san" },
  },
  {
    englishKey: "four", tier: "A1", partOfSpeech: "noun", pronunciation: "for", style: "abstract",
    translations: translations("dört", "four", "vier", "chetyre", "quatre", "cuatro", "quattro", "quatro", "vier", "cztery", "arbaa", "yon", "net", "si"),
    nonLatinPronunciations: { ru: "chetire", ar: "arbaa", ja: "yon", ko: "net", "zh-CN": "sı" },
  },
  {
    englishKey: "five", tier: "A1", partOfSpeech: "noun", pronunciation: "fayv", style: "abstract",
    translations: translations("beş", "five", "fünf", "pyat", "cinq", "cinco", "cinque", "cinco", "vijf", "liczba pięć", "khamsa", "go", "daseot", "wu ge"),
    nonLatinPronunciations: { ru: "pyat", ar: "hamsa", ja: "go", ko: "tasot", "zh-CN": "vu" },
  },
  {
    englishKey: "cucumber", tier: "A2", partOfSpeech: "noun", pronunciation: "kyukambır", style: "food",
    translations: translations("salatalık", "cucumber", "Gurke", "ogurets", "concombre", "pepino", "cetriolo", "pepino", "komkommer", "ogorek", "khiyar", "kyuri", "oi", "huang gua"),
    nonLatinPronunciations: { ru: "ogurets", ar: "hıyar", ja: "kyuri", ko: "oi", "zh-CN": "huang gua" },
  },
  {
    englishKey: "lettuce", tier: "A2", partOfSpeech: "noun", pronunciation: "letıs", style: "food",
    translations: translations("marul", "lettuce", "Kopfsalat", "salat", "laitue", "lechuga", "lattuga", "alface", "sla", "salata", "khas", "retasu", "sangchu", "sheng cai"),
    nonLatinPronunciations: { ru: "salat", ar: "has", ja: "retasu", ko: "sangchu", "zh-CN": "sheng tsay" },
  },
  {
    englishKey: "mushroom", tier: "A2", partOfSpeech: "noun", pronunciation: "mashrum", style: "food",
    translations: translations("mantar", "mushroom", "Pilz", "grib", "champignon", "hongo", "fungo", "cogumelo", "paddenstoel", "grzyb", "futr", "kinoko", "beoseot", "mo gu"),
    nonLatinPronunciations: { ru: "grib", ar: "futr", ja: "kinoko", ko: "bosot", "zh-CN": "mo gu" },
  },
  {
    englishKey: "spinach", tier: "B1", partOfSpeech: "noun", pronunciation: "spinıç", style: "food",
    translations: translations("ıspanak", "spinach", "Spinat", "shpinat", "épinards", "espinaca", "spinaci", "espinafre", "spinazie", "szpinak", "sabanikh", "horenso", "sigeumchi", "bo cai"),
    nonLatinPronunciations: { ru: "shpinat", ar: "sabanih", ja: "horenso", ko: "sıgımchi", "zh-CN": "bo tsay" },
  },
  {
    englishKey: "lemonade", tier: "A1", partOfSpeech: "noun", pronunciation: "lemoneyd", style: "food",
    translations: translations("limonata", "lemonade", "Limonade", "limonad", "limonade", "limonada", "limonata", "limonada", "limonade", "lemoniada", "limunada", "remone-do", "lemonedeu", "ning meng shui"),
    nonLatinPronunciations: { ru: "limonad", ar: "limunada", ja: "remonedo", ko: "lemoneidu", "zh-CN": "ning meng shvey" },
  },
  {
    englishKey: "soda", tier: "A1", partOfSpeech: "noun", pronunciation: "soda", style: "food",
    translations: translations("gazoz", "soda", "Sodagetränk", "gazirovka", "soda", "refresco", "bibita gassata", "refrigerante", "frisdrank", "napoj gazowany", "mashrub ghazi", "soda", "tansa eumnyo", "qi shui"),
    nonLatinPronunciations: { ru: "gazirofka", ar: "mashrub gazi", ja: "soda", ko: "tansa eumnyo", "zh-CN": "chi shvey" },
  },
  {
    englishKey: "cocoa", tier: "A2", partOfSpeech: "noun", pronunciation: "koukou", style: "food",
    translations: translations("kakao", "cocoa", "Kakao", "kakao", "cacao", "cacao", "cacao", "cacau", "cacao", "kakao", "kakao", "kokoa", "kakao", "ke ke"),
    nonLatinPronunciations: { ru: "kakao", ar: "kakao", ja: "kokoa", ko: "kakao", "zh-CN": "ke ke" },
  },
  {
    englishKey: "smoothie", tier: "B1", partOfSpeech: "noun", pronunciation: "smuudi", style: "food",
    translations: translations("smoothie", "smoothie", "Smoothie", "smuzi", "smoothie", "batido", "frullato", "bebida cremosa", "smoothie", "napój owocowy", "smuzi", "sumuji", "seumudi", "guo zhi"),
    nonLatinPronunciations: { ru: "smuzi", ar: "smuzi", ja: "sumuji", ko: "seumudi", "zh-CN": "guo jr" },
  },
  {
    englishKey: "pasta", tier: "A1", partOfSpeech: "noun", pronunciation: "pasta", style: "food",
    translations: translations("makarna", "pasta", "Nudeln", "makaroni", "pâtes", "pasta", "pasta", "macarrão", "pasta", "makaron", "maakaruna", "pasuta", "pasta", "yi mian"),
    nonLatinPronunciations: { ru: "makaroni", ar: "makaruna", ja: "pasuta", ko: "pasta", "zh-CN": "yi myen" },
  },
  {
    englishKey: "lentil", tier: "A2", partOfSpeech: "noun", pronunciation: "lentıl", style: "food",
    translations: translations("mercimek", "lentil", "Linsensuppe", "chechevitsa", "graine de lentille", "lenteja", "lenticchia", "lentilha", "linze", "soczewica", "adas", "rensumame", "lentil", "bian dou"),
    nonLatinPronunciations: { ru: "chechevitsa", ar: "adas", ja: "rensumame", ko: "rentil", "zh-CN": "byen dow" },
  },
  {
    englishKey: "cereal", tier: "A2", partOfSpeech: "noun", pronunciation: "siriyıl", style: "food",
    translations: translations("kahvaltılık gevrek", "cereal", "Müsli", "kasha", "céréales", "cereales", "cereali", "cereais", "ontbijtgranen", "platki", "houbub iftar", "sherearu", "siriol", "mai pian"),
    nonLatinPronunciations: { ru: "kasha", ar: "hubub iftar", ja: "sherearu", ko: "siriol", "zh-CN": "may byen" },
  },
  {
    englishKey: "oat", tier: "A2", partOfSpeech: "noun", pronunciation: "out", style: "food",
    translations: translations("yulaf", "oat", "Hafer", "oves", "avoine", "avena", "avena", "aveia", "haver", "owies", "shofan", "ooto", "gwi", "yan mai"),
    nonLatinPronunciations: { ru: "oves", ar: "shofan", ja: "ooto", ko: "gwi", "zh-CN": "yen may" },
  },
  {
    englishKey: "almond", tier: "A2", partOfSpeech: "noun", pronunciation: "amınd", style: "food",
    translations: translations("badem", "almond", "Mandel", "mindal", "amande", "almendra", "mandorla", "amêndoa", "amandel", "migdal", "lawz", "amando", "amondeu", "xing ren"),
    nonLatinPronunciations: { ru: "mindal", ar: "lavz", ja: "amando", ko: "amondeu", "zh-CN": "shing ren" },
  },
  {
    englishKey: "peanut", tier: "A2", partOfSpeech: "noun", pronunciation: "piin at", style: "food",
    translations: translations("yer fıstığı", "peanut", "Erdnuss", "arahis", "cacahuète", "cacahuete", "arachide", "amendoim", "pinda", "orzeszek ziemny", "ful sudani", "pinatsu", "ttangkong", "hua sheng"),
    nonLatinPronunciations: { ru: "arahis", ar: "ful sudani", ja: "pinatsu", ko: "ttangkong", "zh-CN": "hua shung" },
  },
  {
    englishKey: "walnut", tier: "A2", partOfSpeech: "noun", pronunciation: "volnat", style: "food",
    translations: translations("ceviz", "walnut", "Walnuss", "gretskiy orekh", "noix commune", "nuez común", "noce comune", "noz comum", "walnoot", "orzech wloski", "jawz", "kurumi", "hodo", "he tao"),
    nonLatinPronunciations: { ru: "gretskiy oreh", ar: "javz", ja: "kurumi", ko: "hodo", "zh-CN": "he tao" },
  },
  {
    englishKey: "pistachio", tier: "B1", partOfSpeech: "noun", pronunciation: "pıstashiou", style: "food",
    translations: translations("antep fıstığı", "pistachio", "Pistazie", "fistashka", "pistache", "pistacho", "pistacchio", "pistache", "pistache", "pistacja", "fustuq", "pisutachio", "pistachio", "kai xin guo"),
    nonLatinPronunciations: { ru: "fistashka", ar: "fustuk", ja: "pisutachio", ko: "pistachio", "zh-CN": "kay shin gwo" },
  },
  {
    englishKey: "cookie", tier: "A1", partOfSpeech: "noun", pronunciation: "kuki", style: "food",
    translations: translations("kurabiye", "cookie", "Plätzchen", "pechenye", "petit gâteau", "galleta dulce", "biscotto dolce", "bolacha doce", "chocoladekoekje", "słodkie ciastko", "biskwit", "kukki", "kwaki", "qu qi"),
    nonLatinPronunciations: { ru: "pechenye", ar: "biskvit", ja: "kukki", ko: "kwaki", "zh-CN": "chu chi" },
  },
  {
    englishKey: "candy", tier: "A1", partOfSpeech: "noun", pronunciation: "kendi", style: "food",
    translations: translations("şekerleme", "candy", "Bonbon", "konfet", "bonbon", "caramelo", "caramella", "caramelo", "snoep", "cukierek", "حلوى سكرية", "kandi", "satang", "tang guo"),
    nonLatinPronunciations: { ru: "konfet", ar: "halva", ja: "kandi", ko: "satang", "zh-CN": "tang gwo" },
  },
  {
    englishKey: "pie", tier: "A2", partOfSpeech: "noun", pronunciation: "pay", style: "food",
    translations: translations("turta", "pie", "Obstkuchen", "pirog", "tarte", "tarta", "torta ripiena", "torta recheada", "pastei", "placek owocowy", "fatira", "pai", "pai", "pai"),
    nonLatinPronunciations: { ru: "pirog", ar: "fatira", ja: "pai", ko: "pai", "zh-CN": "pay" },
  },
  {
    englishKey: "pudding", tier: "B1", partOfSpeech: "noun", pronunciation: "puding", style: "food",
    translations: translations("puding", "pudding", "Pudding", "puding", "pudding", "pudín", "budino", "pudim", "pudding", "budyn", "muhallabia", "purin", "puding", "bu ding"),
    nonLatinPronunciations: { ru: "puding", ar: "muhallabiya", ja: "purin", ko: "puding", "zh-CN": "boo ding" },
  },
  {
    englishKey: "stove", tier: "A1", partOfSpeech: "noun", pronunciation: "stouv", style: "home",
    translations: translations("mutfak ocağı", "stove", "Herd", "plita", "fourneau", "estufa", "fornello", "fogão doméstico", "kooktoestel", "kuchenka domowa", "mawqad", "konro", "가스레인지", "lu zao"),
    nonLatinPronunciations: { ru: "plita", ar: "mavkad", ja: "konro", ko: "gas range", "zh-CN": "loo dzao" },
  },
  {
    englishKey: "ladle", tier: "B1", partOfSpeech: "noun", pronunciation: "leydıl", style: "home",
    translations: translations("kepçe", "ladle", "Schöpfkelle", "polovnik", "louche", "cucharón", "mestolo", "colher funda", "soeplepel", "chochla", "mirfaqa", "otama", "gukjaga", "tang chi"),
    nonLatinPronunciations: { ru: "polovnik", ar: "mirfaka", ja: "otama", ko: "gukjaga", "zh-CN": "tang chı" },
  },
  {
    englishKey: "detergent", tier: "A2", partOfSpeech: "noun", pronunciation: "ditörcınt", style: "home",
    translations: translations("deterjan", "detergent", "Waschmittel", "mojushchee sredstvo", "détergent", "detergente", "detersivo", "detergente", "wasmiddel", "detergent", "munazzif", "sentakuzai", "seje", "xi yi ji"),
    nonLatinPronunciations: { ru: "moyusheye sredstvo", ar: "munazif", ja: "sentakuzay", ko: "seje", "zh-CN": "shi yi ji" },
  },
  {
    englishKey: "broom", tier: "A1", partOfSpeech: "noun", pronunciation: "bruum", style: "home",
    translations: translations("süpürge", "broom", "Besen", "venik", "balai", "escoba", "scopa", "vassoura", "bezem", "miotla", "mكنسة", "houki", "bire", "sao ba"),
    nonLatinPronunciations: { ru: "venik", ar: "miknasa", ja: "houki", ko: "bire", "zh-CN": "sao ba" },
  },
  {
    englishKey: "hallway", tier: "A2", partOfSpeech: "noun", pronunciation: "holvey", style: "home",
    translations: translations("ev koridoru", "hallway", "Hausflur", "koridor", "passage intérieur", "pasillo", "passaggio interno", "corredor interno", "huisgang", "przejście wewnętrzne", "mamar", "roka", "bokdo", "zou lang"),
    nonLatinPronunciations: { ru: "koridor", ar: "mamar", ja: "roka", ko: "bokdo", "zh-CN": "dzou lang" },
  },
  {
    englishKey: "theater", tier: "A2", partOfSpeech: "noun", pronunciation: "thiytır", style: "place",
    translations: translations("tiyatro binası", "theater", "Schauspielhaus", "teatr", "salle de théâtre", "sala teatral", "sala teatrale", "sala de teatro", "schouwburg", "sala teatralna", "masrah", "gekijo", "geukjang", "ju yuan"),
    nonLatinPronunciations: { ru: "teatr", ar: "masrah", ja: "gekijo", ko: "gukjang", "zh-CN": "ju yuen" },
  },
  {
    englishKey: "pharmacy", tier: "A2", partOfSpeech: "noun", pronunciation: "farmısi", style: "health",
    translations: translations("eczane", "pharmacy", "Apotheke", "apteka", "pharmacie", "farmacia", "farmacia", "farmácia", "apotheek", "apteka", "saydaliya", "yakkyoku", "yakguk", "yao fang"),
    nonLatinPronunciations: { ru: "apteka", ar: "saydaliya", ja: "yakkyoku", ko: "yakguk", "zh-CN": "yao fang" },
  },
  {
    englishKey: "bakery", tier: "A1", partOfSpeech: "noun", pronunciation: "beykıri", style: "place",
    translations: translations("ekmek fırını", "bakery", "Bäckerei", "pekarnya", "boulangerie", "panadería", "panetteria", "padaria", "bakkerij", "piekarnia", "mahabaz", "pan-ya", "ppangjip", "mian bao fang"),
    nonLatinPronunciations: { ru: "pekarnya", ar: "mahabaz", ja: "panya", ko: "ppangjip", "zh-CN": "myen bao fang" },
  },
  {
    englishKey: "skyscraper", tier: "B1", partOfSpeech: "noun", pronunciation: "skayskreyper", style: "place",
    translations: translations("gökdelen", "skyscraper", "Wolkenkratzer", "neboskreb", "gratte-ciel", "rascacielos", "grattacielo", "arranha-céu", "wolkenkrabber", "drapacz chmur", "burj murtafi", "chokoso biru", "chogocheung geonmul", "mo tian da lou"),
    nonLatinPronunciations: { ru: "neboskreb", ar: "burj murtafi", ja: "chokoso biru", ko: "chogung geonmul", "zh-CN": "mo tyen da low" },
  },
  {
    englishKey: "stairs", tier: "A1", partOfSpeech: "noun", pronunciation: "sterz", style: "place",
    translations: translations("basamaklar", "stairs", "Treppenstufen", "lestnitsa", "marches", "escaleras", "scale", "escadas", "traptreden", "stopnie schodów", "daraj", "kaidan", "gyedan", "lou ti"),
    nonLatinPronunciations: { ru: "lestnitsa", ar: "daraj", ja: "kaidan", ko: "gyedan", "zh-CN": "low tı" },
  },
  {
    englishKey: "waterfall", tier: "B1", partOfSpeech: "noun", pronunciation: "votırfol", style: "nature",
    translations: translations("şelale", "waterfall", "Wasserfall", "vodopad", "cascade", "cascada", "cascata", "cachoeira", "waterval", "wodospad", "shلال", "takibana", "pokpo", "pu bu"),
    nonLatinPronunciations: { ru: "vodopad", ar: "shalal", ja: "takibana", ko: "pokpo", "zh-CN": "po boo" },
  },
  {
    englishKey: "volcano", tier: "B1", partOfSpeech: "noun", pronunciation: "volkeynou", style: "nature",
    translations: translations("yanardağ", "volcano", "Vulkan", "vulkan", "volcan", "volcán", "vulcano", "vulcão", "vulkaan", "wulkan", "barkan", "kazan", "hwansan", "huo shan"),
    nonLatinPronunciations: { ru: "vulkan", ar: "barkan", ja: "kazan", ko: "hvasan", "zh-CN": "hwo shan" },
  },
  {
    englishKey: "latitude", tier: "B2", partOfSpeech: "noun", pronunciation: "letıtud", style: "abstract",
    translations: translations("enlem", "latitude", "Breitengrad", "shir ota", "latitude", "latitud", "latitudine", "latitude", "breedtegraad", "szerokosc geograficzna", "ard", "ido", "wido", "wei du"),
    nonLatinPronunciations: { ru: "shir ota", ar: "ard", ja: "ido", ko: "vido", "zh-CN": "vey doo" },
  },
  {
    englishKey: "longitude", tier: "B2", partOfSpeech: "noun", pronunciation: "loncıtud", style: "abstract",
    translations: translations("boylam", "longitude", "Längengrad", "dolgota", "longitude", "longitud geográfica", "longitudine", "longitude", "lengtegraad", "dlugosc geograficzna", "tool", "keido", "gyeongdo", "jing du"),
    nonLatinPronunciations: { ru: "dolgota", ar: "tool", ja: "keido", ko: "gyongdo", "zh-CN": "jing doo" },
  },
  {
    englishKey: "hardworking", tier: "B1", partOfSpeech: "adjective", pronunciation: "hardvörking", style: "people",
    translations: translations("çalışkan", "hardworking", "fleißig", "trudolyubivi", "personne travailleuse", "persona trabajadora", "persona laboriosa", "pessoa trabalhadora", "hardwerkend", "pracowity", "mujtahid", "kinbenka", "seongsilhan", "qin fen"),
    nonLatinPronunciations: { ru: "trudolyubivi", ar: "mujtahid", ja: "kinbenka", ko: "sungsilhan", "zh-CN": "chin fun" },
  },
  {
    englishKey: "selfish", tier: "B1", partOfSpeech: "adjective", pronunciation: "selfish", style: "people",
    translations: translations("bencil", "selfish", "egoistisch", "egoistichni", "égoïste", "egoísta", "egoista", "egoísta", "egoistisch", "samolubny", "ani", "wagamama na", "ijasikhan", "zi si"),
    nonLatinPronunciations: { ru: "egoistichni", ar: "ani", ja: "wagamama na", ko: "ijasikhan", "zh-CN": "dzı sı" },
  },
  {
    englishKey: "handsome", tier: "A2", partOfSpeech: "adjective", pronunciation: "hensım", style: "people",
    translations: translations("yakışıklı", "handsome", "hübsch", "krasivi", "homme séduisant", "hombre atractivo", "uomo attraente", "homem atraente", "knap", "przystojny", "jamil", "kakkoii", "meotjin", "shuai qi"),
    nonLatinPronunciations: { ru: "krasivi", ar: "jamil", ja: "kakkoi", ko: "motjin", "zh-CN": "shvay chi" },
  },
  {
    englishKey: "beard", tier: "A2", partOfSpeech: "noun", pronunciation: "bird", style: "people",
    translations: translations("sakal", "beard", "Bart", "boroda", "barbe", "barba", "barba", "barba", "baard", "broda", "lihiya", "hige", "suyeom", "hu zi"),
    nonLatinPronunciations: { ru: "boroda", ar: "lihiya", ja: "hige", ko: "suyom", "zh-CN": "hu dzı" },
  },
  {
    englishKey: "pronunciation", tier: "B1", partOfSpeech: "noun", pronunciation: "prınansi-eyshın", style: "people",
    translations: translations("telaffuz", "pronunciation", "Aussprache", "proiznoshenie", "prononciation", "pronunciación", "pronuncia", "pronúncia", "uitspraak van een woord", "wymowa", "nutq", "hatsuon", "bal-eum", "fa yin"),
    nonLatinPronunciations: { ru: "proiznosheniye", ar: "nutk", ja: "hatsuon", ko: "bareum", "zh-CN": "fa yin" },
  },
  {
    englishKey: "analyze", tier: "B2", partOfSpeech: "verb", pronunciation: "enelayz", style: "verb",
    translations: translations("veriyi çözümlemek", "analyze", "Daten analysieren", "analizirovat", "étudier en détail", "estudiar en detalle", "studiare a fondo", "analisar dados", "gegevens ontleden", "analizowac", "yuhallil", "bunseki suru", "bunseok hada", "fen xi"),
    nonLatinPronunciations: { ru: "analizirovat", ar: "yuhallil", ja: "bunseki suru", ko: "bunseok hada", "zh-CN": "fun shı" },
  },
  {
    englishKey: "headset", tier: "A2", partOfSpeech: "noun", pronunciation: "hedset", style: "technology",
    translations: translations("kulaklık", "headset", "Headset", "garnitura", "casque audio", "auriculares", "cuffia", "fone de ouvido", "koptelefoon", "zestaw sluchawkowy", "samaat", "hedosetto", "he deuset", "er ji"),
    nonLatinPronunciations: { ru: "garnitura", ar: "samaat", ja: "hedosetto", ko: "heduset", "zh-CN": "er ji" },
  },
  {
    englishKey: "router", tier: "B1", partOfSpeech: "noun", pronunciation: "rautır", style: "technology",
    translations: translations("yönlendirici", "router", "Router", "marshrutizator", "routeur", "enrutador", "router", "roteador", "router", "router", "muwajjih", "ruta", "routeo", "lu you qi"),
    nonLatinPronunciations: { ru: "marshrutizator", ar: "muvajih", ja: "ruta", ko: "ruteo", "zh-CN": "loo yo chi" },
  },
  {
    englishKey: "livestream", tier: "B1", partOfSpeech: "noun", pronunciation: "layvstriim", style: "technology",
    translations: translations("canlı yayın", "livestream", "Livestream", "pryamaya translyatsiya", "diffusion en direct", "transmisión en directo", "diretta", "transmissão ao vivo", "livestream", "transmisja na zywo", "bth mubashir", "raibu sutoriimu", "saengbangsong", "zhi bo"),
    nonLatinPronunciations: { ru: "pryamaya translyatsiya", ar: "bess mubashir", ja: "raibu sutoriimu", ko: "sengbangsong", "zh-CN": "jr bo" },
  },
  {
    englishKey: "username", tier: "A2", partOfSpeech: "noun", pronunciation: "yuzırneym", style: "technology",
    translations: translations("kullanıcı adı", "username", "Benutzername", "imya polzovatelya", "nom d'utilisateur", "nombre de usuario", "nome utente", "nome de usuário", "gebruikersnaam", "nazwa uzytkownika", "ism al-mustakhdim", "yuzanēmu", "sayongja i-reum", "yong hu ming"),
    nonLatinPronunciations: { ru: "imya polzovatelya", ar: "ism al mustahdim", ja: "yuzanemu", ko: "sayongja irum", "zh-CN": "yong hoo ming" },
  },
  {
    englishKey: "hashtag", tier: "B1", partOfSpeech: "noun", pronunciation: "heshteg", style: "technology",
    translations: translations("etiket imi", "hashtag", "Hashtag", "hashtег", "mot-dièse", "hashtag", "hashtag", "hashtag", "hashtag", "hashtag", "wasm", "hashtagu", "haesitaegeu", "hua ti"),
    nonLatinPronunciations: { ru: "hashtag", ar: "vasm", ja: "hashutagu", ko: "hesitegu", "zh-CN": "hua tı" },
  },
  {
    englishKey: "notification", tier: "B1", partOfSpeech: "noun", pronunciation: "noutıfikeyshın", style: "technology",
    translations: translations("bildirim", "notification", "Benachrichtigung", "uvedomlenie", "notification", "notificación", "notifica", "notificação", "melding", "alert", "ishar", "tsuuchi", "alrim", "tong zhi"),
    nonLatinPronunciations: { ru: "uvedomleniye", ar: "ishar", ja: "tsuuchi", ko: "allim", "zh-CN": "tong jr" },
  },
  {
    englishKey: "broccoli", tier: "A2", partOfSpeech: "noun", pronunciation: "brokoli", style: "food",
    translations: translations("brokoli", "broccoli", "Brokkoli", "brokkoli", "brocoli", "brócoli", "broccoli", "brócolis", "broccoli", "brokul", "brokoli", "burokkori", "beurokolli", "xi lan hua"),
    nonLatinPronunciations: { ru: "brokkoli", ar: "brokoli", ja: "burokkori", ko: "beurokolli", "zh-CN": "shı lan hwa" },
  },
  {
    englishKey: "cabbage", tier: "A2", partOfSpeech: "noun", pronunciation: "kebıc", style: "food",
    translations: translations("lahana", "cabbage", "Kohl", "kapusta", "chou", "repollo", "cavolo", "repolho", "kool", "kapusta", "malfuf", "kyabetsu", "yangbaechu", "juan tou"),
    nonLatinPronunciations: { ru: "kapusta", ar: "malfuf", ja: "kyabetsu", ko: "yangbechu", "zh-CN": "juan tow" },
  },
  {
    englishKey: "pumpkin", tier: "A2", partOfSpeech: "noun", pronunciation: "pampkin", style: "food",
    translations: translations("balkabağı", "pumpkin", "Kürbis", "tykva", "citrouille", "calabaza", "zucca", "abóbora", "pompoen", "dynia", "qar", "kabocha", "hobak", "nan gua"),
    nonLatinPronunciations: { ru: "tikva", ar: "kar", ja: "kabocha", ko: "hobak", "zh-CN": "nan gwa" },
  },
  {
    englishKey: "zucchini", tier: "A2", partOfSpeech: "noun", pronunciation: "zukini", style: "food",
    translations: translations("kabak", "zucchini", "Zucchini", "kabachok", "courgette", "calabacín", "zucchina", "abobrinha", "courgette", "cukinia", "kussa", "zukkini", "aehobak", "xi hu lu"),
    nonLatinPronunciations: { ru: "kabachok", ar: "kussa", ja: "zukkini", ko: "ehobak", "zh-CN": "shı hoo loo" },
  },
  {
    englishKey: "celery", tier: "B1", partOfSpeech: "noun", pronunciation: "selıri", style: "food",
    translations: translations("kereviz", "celery", "Sellerie", "selderey", "céleri", "apio", "sedano", "aipo", "selderij", "seler", "karafs", "serori", "sellori", "qin cai"),
    nonLatinPronunciations: { ru: "selderey", ar: "karafs", ja: "serori", ko: "sellori", "zh-CN": "chin tsay" },
  },
  {
    englishKey: "cashew", tier: "B1", partOfSpeech: "noun", pronunciation: "kashu", style: "food",
    translations: translations("kaju", "cashew", "Cashew", "keshu", "noix de cajou", "anacardo", "anacardio", "castanha de caju", "cashew", "nerkowiec", "kaju", "kashu", "kashu", "yao guo"),
    nonLatinPronunciations: { ru: "keshu", ar: "kaju", ja: "kashu", ko: "kashu", "zh-CN": "yao gwo" },
  },
  {
    englishKey: "hazelnut", tier: "B1", partOfSpeech: "noun", pronunciation: "heyzılnat", style: "food",
    translations: translations("fındık", "hazelnut", "Haselnuss", "funduk", "noisette", "avellana", "nocciola", "avelã", "hazelnoot", "leszczyna", "bunduq", "hazērunattsu", "heijeolneot", "zhen zi"),
    nonLatinPronunciations: { ru: "funduk", ar: "bundu", ja: "hazerunattsu", ko: "heijeolnot", "zh-CN": "jen dzı" },
  },
  {
    englishKey: "chestnut", tier: "B1", partOfSpeech: "noun", pronunciation: "chesnat", style: "food",
    translations: translations("kestane", "chestnut", "Kastanie", "kashtan", "châtaigne", "castaña", "castagna", "castanha", "kastanje", "kasztan", "kastana", "kuri", "bam", "li zi"),
    nonLatinPronunciations: { ru: "kashtan", ar: "kastana", ja: "kuri", ko: "bam", "zh-CN": "lı dzı" },
  },
  {
    englishKey: "coconut", tier: "A2", partOfSpeech: "noun", pronunciation: "koukınat", style: "food",
    translations: translations("hindistan cevizi", "coconut", "Kokosnuss", "kokos", "noix de coco", "coco", "cocco", "coco", "kokosnoot", "kokos", "joz al-hind", "kokonattsu", "koko neot", "ye zi"),
    nonLatinPronunciations: { ru: "kokos", ar: "joz al hind", ja: "kokonattsu", ko: "koko not", "zh-CN": "ye dzı" },
  },
  {
    englishKey: "donut", tier: "A1", partOfSpeech: "noun", pronunciation: "dounat", style: "food",
    translations: translations("donut", "donut", "Donut", "ponchik", "beignet", "rosquilla", "ciambella", "rosquinha", "donut", "pączek", "kaak", "donattsu", "donat", "tian quan"),
    nonLatinPronunciations: { ru: "ponchik", ar: "kaak", ja: "donattsu", ko: "donat", "zh-CN": "tyen chyuan" },
  },
  {
    englishKey: "muffin", tier: "A2", partOfSpeech: "noun", pronunciation: "mafin", style: "food",
    translations: translations("muffin", "muffin", "Muffin", "maffin", "muffin", "magdalena", "muffin", "queque", "muffin", "muffinka", "kaak sghir", "mafīn", "mafin", "ma fen"),
    nonLatinPronunciations: { ru: "mafin", ar: "kaak sagir", ja: "mafin", ko: "mapin", "zh-CN": "ma fun" },
  },
  {
    englishKey: "honey", tier: "A1", partOfSpeech: "noun", pronunciation: "hani", style: "food",
    translations: translations("bal", "honey", "Honig", "myod", "miel", "miel", "miele", "mel", "honing", "miód", "asal", "hachimitsu", "kkul", "feng mi"),
    nonLatinPronunciations: { ru: "myod", ar: "asal", ja: "hachimitsu", ko: "kkul", "zh-CN": "fung mi" },
  },
  {
    englishKey: "pastry", tier: "B1", partOfSpeech: "noun", pronunciation: "peystiri", style: "food",
    translations: translations("hamur işi", "pastry", "Gebäck", "vypechka", "pâtisserie", "bollería", "pasticceria", "pastelaria", "gebak", "wypiek cukierniczy", "halawiyat", "pasutori", "gwaja", "dian xin"),
    nonLatinPronunciations: { ru: "vipechka", ar: "halaviyat", ja: "pasutori", ko: "gvaja", "zh-CN": "dyen shin" },
  },
  {
    englishKey: "whisk", tier: "B1", partOfSpeech: "noun", pronunciation: "visk", style: "home",
    translations: translations("çırpıcı", "whisk", "Schneebesen", "venchik", "fouet de cuisine", "batidor", "frusta da cucina", "batedor", "garde", "trzepaczka", "khafik", "awata", "거품기", "dan zi"),
    nonLatinPronunciations: { ru: "venchik", ar: "hafik", ja: "avata", ko: "vısık", "zh-CN": "dan dzı" },
  },
  {
    englishKey: "grater", tier: "B1", partOfSpeech: "noun", pronunciation: "greyter", style: "home",
    translations: translations("rende", "grater", "Reibe", "terka", "râpe", "rallador", "grattugia", "ralador", "rasp", "tarka", "mubshar", "oroshigane", "강판", "ca ban"),
    nonLatinPronunciations: { ru: "terka", ar: "mubshar", ja: "oroshigane", ko: "gangpan", "zh-CN": "tsa ban" },
  },
  {
    englishKey: "tongs", tier: "B1", partOfSpeech: "noun", pronunciation: "tongs", style: "home",
    translations: translations("maşa", "tongs", "Zange", "shchiptsy", "pince de cuisine", "pinzas", "pinze", "pegador", "tang", "pinceta", "milqat", "ryori basute", "jipge", "jia zi"),
    nonLatinPronunciations: { ru: "shchiptsi", ar: "milkat", ja: "ryori basute", ko: "jipge", "zh-CN": "jya dzı" },
  },
  {
    englishKey: "spatula", tier: "B1", partOfSpeech: "noun", pronunciation: "spachula", style: "home",
    translations: translations("spatula", "spatula", "Pfannenwender", "lopatka", "spatule", "espátula", "spatola", "espátula", "spatel", "łopatka", "milqat matbakh", "hera", "seutelra", "guo chan"),
    nonLatinPronunciations: { ru: "lopatka", ar: "milkat", ja: "hera", ko: "seutelra", "zh-CN": "gwo chan" },
  },
  {
    englishKey: "armchair", tier: "A2", partOfSpeech: "noun", pronunciation: "armcher", style: "home",
    translations: translations("berjer", "armchair", "Sessel", "kreslo", "fauteuil", "butaca", "poltrona", "poltrona", "fauteuil", "fotel", "kursi", "isu", "sopa", "fu yi"),
    nonLatinPronunciations: { ru: "kreslo", ar: "kursi", ja: "isu", ko: "sopa", "zh-CN": "foo yi" },
  },
  {
    englishKey: "cushion", tier: "A2", partOfSpeech: "noun", pronunciation: "kushın", style: "home",
    translations: translations("minder", "cushion", "Sofakissen", "divannaya podushka", "coussin", "cojín", "cuscino decorativo", "almofada", "sierkussen", "poduszka dekoracyjna", "وسادة ديكور", "kusshon", "bangseok", "dian zi"),
    nonLatinPronunciations: { ru: "podushka", ar: "visada", ja: "kusshon", ko: "bangsok", "zh-CN": "dyen dzı" },
  },
  {
    englishKey: "bookstore", tier: "A2", partOfSpeech: "noun", pronunciation: "bukstor", style: "place",
    translations: translations("kitapçı", "bookstore", "Buchhandlung", "knizhniy magazin", "librairie", "librería", "libreria", "livraria", "boekhandel", "księgarnia", "maktaba", "shoten", "seojeom", "shu dian"),
    nonLatinPronunciations: { ru: "knijni magazin", ar: "maktaba", ja: "shoten", ko: "sojom", "zh-CN": "shu dyen" },
  },
  {
    englishKey: "moustache", tier: "A2", partOfSpeech: "noun", pronunciation: "mastash", style: "people",
    translations: translations("bıyık", "moustache", "Schnurrbart", "usy", "moustache", "bigote", "baffi", "bigode", "snor", "wąsy", "sharib", "kuchi hige", "kotsuyeom", "hu xu"),
    nonLatinPronunciations: { ru: "usi", ar: "sharib", ja: "hige", ko: "kotsuyom", "zh-CN": "hoo shyu" },
  },
  {
    englishKey: "glasses", tier: "A1", partOfSpeech: "noun", pronunciation: "glasis", style: "people",
    translations: translations("gözlük", "glasses", "Brille", "ochki", "lunettes", "gafas", "occhiali", "óculos", "bril", "okulary", "nadharat", "megane", "angyeong", "yan jing"),
    nonLatinPronunciations: { ru: "ochki", ar: "nazarat", ja: "megane", ko: "angyong", "zh-CN": "yen jing" },
  },
  {
    englishKey: "skating", tier: "B1", partOfSpeech: "noun", pronunciation: "skeyting", style: "people",
    translations: translations("paten kayma", "skating", "Eislaufen", "катание", "patinage", "patinaje", "pattinaggio", "patinação", "schaatsen", "łyżwiarstwo", "التزلج", "スケート", "스케이팅", "滑冰"),
    nonLatinPronunciations: { ru: "kataniye", ar: "tazaluj", ja: "suketo", ko: "seuketing", "zh-CN": "hwa bing" },
  },
] satisfies readonly AdditionalCardDefinition[];

export const ADDITIONAL_CARD_ENTRIES: readonly CardSeedRow[] = definitions.map((definition) => {
  const values = definition.translations;

  return [
    definition.englishKey,
    definition.tier,
    "word",
    definition.partOfSpeech,
    definition.pronunciation,
    values.tr,
    values.en,
    values.de,
    values.ru,
    values.fr,
    values.es,
    values.it,
    values.pt,
    values.nl,
    values.pl,
    values.ar,
    values.ja,
    values.ko,
    values["zh-CN"],
  ] as const satisfies CardSeedRow;
});

const definitionByEnglishKey = new Map(definitions.map((definition) => [definition.englishKey, definition]));

export function getAdditionalCardPronunciation(
  englishKey: string,
  language: LanguageCode,
): string | undefined {
  const definition = definitionByEnglishKey.get(englishKey);
  return definition ? buildPronunciations(definition)[language] : undefined;
}

export function getAdditionalCardExampleStyle(englishKey: string): AdditionalExampleStyle | undefined {
  return definitionByEnglishKey.get(englishKey)?.style;
}

export const ADDITIONAL_CARD_KEYS = new Set(definitions.map((definition) => definition.englishKey));
