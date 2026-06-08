import type {
  CardExample,
  GrammarGuide,
  GrammarTable,
  LanguageCode,
  Tier,
  VocabularyCard,
} from "@/types/domain";

type WordSeed = {
  term: string;
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
};

type CatalogSeed = Record<LanguageCode, Record<Tier, WordSeed[]>>;

export interface CatalogReport {
  total: number;
  byLanguage: Record<LanguageCode, number>;
  byLanguageTier: Record<LanguageCode, Record<Tier, number>>;
  byPartOfSpeech: Record<string, number>;
  invalidTerms: Array<Pick<VocabularyCard, "id" | "language" | "tier" | "term">>;
  duplicateTerms: Array<{ language: LanguageCode; term: string; ids: string[] }>;
  samples: Record<LanguageCode, string[]>;
}

const TIERS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];
const LANGUAGES: LanguageCode[] = ["en", "de", "ru"];
const SINGLE_WORD_PATTERN = /^\p{L}+$/u;

const CATALOG_SEED: CatalogSeed = {
  en: {
    A1: [
      w("apple|elma|ep-il|isim"),
      w("water|su|vo-tır|isim"),
      w("bread|ekmek|bred|isim"),
      w("book|kitap|buk|isim"),
      w("house|ev|haus|isim"),
      w("room|oda|rum|isim"),
      w("friend|arkadaş|frend|isim"),
      w("family|aile|fe-mi-li|isim"),
      w("school|okul|skul|isim"),
      w("work|iş|vörk|isim"),
      w("city|şehir|si-ti|isim"),
      w("day|gün|dey|isim"),
      w("night|gece|nayt|isim"),
      w("time|zaman|taym|isim"),
      w("money|para|ma-ni|isim"),
      w("food|yemek|fud|isim"),
      w("coffee|kahve|ko-fi|isim"),
      w("tea|çay|ti|isim"),
      w("car|araba|kar|isim"),
      w("bus|otobüs|bas|isim"),
      w("child|çocuk|çayld|isim"),
      w("mother|anne|ma-dır|isim"),
      w("father|baba|fa-dır|isim"),
      w("name|isim|neym|isim"),
      w("door|kapı|dor|isim"),
      w("table|masa|tey-bıl|isim"),
      w("chair|sandalye|çer|isim"),
      w("phone|telefon|fon|isim"),
      w("road|yol|rod|isim"),
      w("language|dil|leng-gwic|isim"),
    ],
    A2: [
      w("travel|seyahat|trev-ıl|fiil"),
      w("weather|hava|ve-dır|isim"),
      w("market|pazar|mar-kıt|isim"),
      w("ticket|bilet|ti-kıt|isim"),
      w("hotel|otel|ho-tel|isim"),
      w("train|tren|treyn|isim"),
      w("meeting|toplantı|mi-ting|isim"),
      w("lesson|ders|le-sın|isim"),
      w("message|mesaj|me-sıc|isim"),
      w("doctor|doktor|dok-tır|isim"),
      w("pharmacy|eczane|far-ma-si|isim"),
      w("restaurant|restoran|res-tı-rant|isim"),
      w("question|soru|kues-çın|isim"),
      w("answer|cevap|en-sır|isim"),
      w("plan|plan|plen|isim"),
      w("weekend|haftasonu|vik-end|isim"),
      w("problem|sorun|prob-lım|isim"),
      w("choice|seçim|çoys|isim"),
      w("bill|hesap|bil|isim"),
      w("receipt|fiş|ri-sit|isim"),
      w("kitchen|mutfak|ki-çın|isim"),
      w("garden|bahçe|gar-dın|isim"),
      w("beach|plaj|biç|isim"),
      w("airport|havalimanı|er-port|isim"),
      w("station|istasyon|stey-şın|isim"),
      w("shop|dükkan|şap|isim"),
      w("price|fiyat|prays|isim"),
      w("clothes|kıyafet|kloz|isim"),
      w("medicine|ilaç|me-di-sın|isim"),
      w("address|adres|e-dres|isim"),
    ],
    B1: [
      w("decision|karar|di-si-jın|isim"),
      w("improve|geliştirmek|im-pruv|fiil"),
      w("support|desteklemek|sı-port|fiil"),
      w("available|mevcut|ı-vey-lı-bıl|sıfat"),
      w("purpose|amaç|pır-pıs|isim"),
      w("although|rağmen|ol-tho|bağlaç"),
      w("suggest|önermek|sı-cesçt|fiil"),
      w("compare|karşılaştırmak|kım-per|fiil"),
      w("result|sonuç|ri-zalt|isim"),
      w("reason|sebep|ri-zın|isim"),
      w("opinion|fikir|ı-pin-yın|isim"),
      w("experience|deneyim|ik-spi-ri-ıns|isim"),
      w("condition|koşul|kın-di-şın|isim"),
      w("continue|sürdürmek|kın-tin-yu|fiil"),
      w("increase|artırmak|in-kris|fiil"),
      w("reduce|azaltmak|ri-dus|fiil"),
      w("prepare|hazırlamak|pri-per|fiil"),
      w("explain|açıklamak|ik-spleyn|fiil"),
      w("culture|kültür|kal-çır|isim"),
      w("habit|alışkanlık|he-bıt|isim"),
      w("describe|betimlemek|di-skrayb|fiil"),
      w("achieve|başarmak|ı-çiv|fiil"),
      w("avoid|kaçınmak|ı-voyd|fiil"),
      w("create|oluşturmak|kri-eyt|fiil"),
      w("depend|bağlıolmak|di-pend|fiil"),
      w("develop|gelişmek|di-ve-lıp|fiil"),
      w("offer|teklif|o-fır|fiil"),
      w("produce|üretmek|pro-dus|fiil"),
      w("remain|kalmak|ri-meyn|fiil"),
      w("select|seçmek|sı-lekt|fiil"),
    ],
    B2: [
      w("evaluate|değerlendirmek|i-val-yu-eyt|fiil"),
      w("reliable|güvenilir|ri-lay-ı-bıl|sıfat"),
      w("assumption|varsayım|ı-samp-şın|isim"),
      w("contribute|katkısağlamak|kın-tri-byut|fiil"),
      w("nevertheless|yinede|ne-vır-dı-les|zarf"),
      w("requirement|gereksinim|ri-kuayr-mınt|isim"),
      w("framework|çerçeve|freym-vörk|isim"),
      w("approach|yaklaşım|ı-proç|isim"),
      w("maintain|sürdürmek|meyn-teyn|fiil"),
      w("constraint|kısıt|kın-streynt|isim"),
      w("priority|öncelik|pray-or-ı-ti|isim"),
      w("interpret|yorumlamak|in-tör-prıt|fiil"),
      w("evidence|kanıt|e-vı-dıns|isim"),
      w("consistent|tutarlı|kın-sis-tınt|sıfat"),
      w("estimate|tahmin|es-tı-meyt|fiil"),
      w("analyze|analizetmek|e-nı-layz|fiil"),
      w("expand|genişletmek|ik-spend|fiil"),
      w("adapt|uyumsağlamak|ı-dept|fiil"),
      w("negotiate|müzakereetmek|ni-go-şi-eyt|fiil"),
      w("implement|uygulamak|im-plı-ment|fiil"),
      w("illustrate|göstermek|i-lıs-treyt|fiil"),
      w("clarify|netleştirmek|kle-rı-fay|fiil"),
      w("justify|gerekçelendirmek|cas-tı-fay|fiil"),
      w("verify|doğrulamak|ve-rı-fay|fiil"),
      w("consider|dikkatealmak|kın-si-dır|fiil"),
      w("ensure|sağlamak|in-şur|fiil"),
      w("imply|imaetmek|im-play|fiil"),
      w("resolve|çözmek|ri-zalv|fiil"),
      w("significant|önemli|sig-ni-fi-kınt|sıfat"),
      w("complex|karmaşık|kam-pleks|sıfat"),
    ],
    C1: [
      w("meticulous|titiz|mı-ti-kyu-lıs|sıfat"),
      w("ambiguous|belirsiz|am-bi-gyu-ıs|sıfat"),
      w("nuance|nüans|nu-ans|isim"),
      w("scrutinize|incelemek|skru-tı-nayz|fiil"),
      w("resilient|dayanıklı|ri-zil-yınt|sıfat"),
      w("contemplate|düşünmek|kon-tım-pleyt|fiil"),
      w("subtle|ince|sa-tıl|sıfat"),
      w("coherent|tutarlı|ko-hi-rınt|sıfat"),
      w("premise|öncül|pre-mıs|isim"),
      w("mitigate|hafifletmek|mi-ti-geyt|fiil"),
      w("discrepancy|uyuşmazlık|dis-kre-pın-si|isim"),
      w("ubiquitous|her yerde|yu-bi-kui-tıs|sıfat"),
      w("profound|derin|pro-faund|sıfat"),
      w("alleviate|gidermek|ı-li-vi-eyt|fiil"),
      w("intricate|karmaşık|in-trı-kıt|sıfat"),
      w("plausible|makul|plo-zı-bıl|sıfat"),
      w("undermine|zayıflatmak|an-dır-mayn|fiil"),
      w("articulate|ifadeetmek|ar-ti-kyu-leyt|fiil"),
      w("infer|çıkarım|in-fır|fiil"),
      w("synthesize|sentezlemek|sin-thı-sayz|fiil"),
      w("paradigm|paradigma|pe-rı-daym|isim"),
      w("rhetoric|retorik|re-tı-rik|isim"),
      w("empirical|ampirik|em-pi-ri-kıl|sıfat"),
      w("inherent|içkin|in-hi-rınt|sıfat"),
      w("scrutiny|inceleme|skru-tı-ni|isim"),
      w("volatile|değişken|va-lı-tıl|sıfat"),
      w("robust|sağlam|ro-bast|sıfat"),
      w("concede|kabullenmek|kın-sid|fiil"),
      w("foster|teşviketmek|fos-tır|fiil"),
      w("paramount|enönemli|pe-rı-maunt|sıfat"),
    ],
  },
  de: {
    A1: [
      w("Apfel|elma|ap-fıl|isim"),
      w("Wasser|su|vas-ır|isim"),
      w("Brot|ekmek|brot|isim"),
      w("Buch|kitap|buh|isim"),
      w("Haus|ev|haus|isim"),
      w("Zimmer|oda|tsim-ır|isim"),
      w("Freund|arkadaş|froynt|isim"),
      w("Familie|aile|fa-mi-li-ye|isim"),
      w("Schule|okul|şu-le|isim"),
      w("Arbeit|iş|ar-bayt|isim"),
      w("Stadt|şehir|ştat|isim"),
      w("Tag|gün|tak|isim"),
      w("Nacht|gece|naht|isim"),
      w("Zeit|zaman|tsayt|isim"),
      w("Geld|para|gelt|isim"),
      w("Essen|yemek|es-ın|isim"),
      w("Kaffee|kahve|ka-fe|isim"),
      w("Tee|çay|te|isim"),
      w("Auto|araba|av-to|isim"),
      w("Bus|otobüs|bus|isim"),
      w("Kind|çocuk|kint|isim"),
      w("Mutter|anne|mu-tır|isim"),
      w("Vater|baba|fa-tır|isim"),
      w("Name|isim|na-me|isim"),
      w("Tür|kapı|tür|isim"),
      w("Tisch|masa|tiş|isim"),
      w("Stuhl|sandalye|ştul|isim"),
      w("Handy|telefon|hen-di|isim"),
      w("Straße|yol|ştra-se|isim"),
      w("Sprache|dil|şpra-he|isim"),
    ],
    A2: [
      w("reisen|seyahat|ray-zın|fiil"),
      w("Wetter|hava|ve-tır|isim"),
      w("Markt|pazar|markt|isim"),
      w("Fahrkarte|bilet|far-kar-te|isim"),
      w("Hotel|otel|ho-tel|isim"),
      w("Zug|tren|tsuk|isim"),
      w("Besprechung|toplantı|be-şpre-hung|isim"),
      w("Unterricht|ders|un-tır-riht|isim"),
      w("Nachricht|mesaj|nah-riht|isim"),
      w("Arzt|doktor|artst|isim"),
      w("Apotheke|eczane|a-po-te-ke|isim"),
      w("Restaurant|restoran|res-to-ran|isim"),
      w("Frage|soru|fra-ge|isim"),
      w("Antwort|cevap|ant-vort|isim"),
      w("Plan|plan|plan|isim"),
      w("Wochenende|haftasonu|vo-hen-en-de|isim"),
      w("Problem|sorun|pro-blem|isim"),
      w("Auswahl|seçim|aus-val|isim"),
      w("Rechnung|hesap|reh-nung|isim"),
      w("Quittung|fiş|kvi-tung|isim"),
      w("Küche|mutfak|kü-he|isim"),
      w("Garten|bahçe|gar-tın|isim"),
      w("Strand|plaj|ştrant|isim"),
      w("Flughafen|havalimanı|fluk-ha-fın|isim"),
      w("Bahnhof|istasyon|ban-hof|isim"),
      w("Geschäft|dükkan|ge-şeft|isim"),
      w("Preis|fiyat|prays|isim"),
      w("Kleidung|kıyafet|klay-dung|isim"),
      w("Medizin|ilaç|me-di-tsin|isim"),
      w("Adresse|adres|a-dre-se|isim"),
    ],
    B1: [
      w("Entscheidung|karar|ent-şay-dung|isim"),
      w("verbessern|geliştirmek|fer-be-sırn|fiil"),
      w("unterstützen|desteklemek|un-tır-ştüt-sın|fiil"),
      w("verfügbar|mevcut|fer-füg-bar|sıfat"),
      w("Zweck|amaç|tsvek|isim"),
      w("obwohl|rağmen|op-vol|bağlaç"),
      w("vorschlagen|önermek|for-şla-gın|fiil"),
      w("vergleichen|karşılaştırmak|fer-glay-hın|fiil"),
      w("Ergebnis|sonuç|er-gep-nis|isim"),
      w("Grund|sebep|grunt|isim"),
      w("Meinung|fikir|may-nung|isim"),
      w("Erfahrung|deneyim|er-fa-rung|isim"),
      w("Bedingung|koşul|be-din-gung|isim"),
      w("fortsetzen|sürdürmek|fort-zet-sın|fiil"),
      w("erhöhen|artırmak|er-hö-ın|fiil"),
      w("reduzieren|azaltmak|re-du-tsi-rın|fiil"),
      w("vorbereiten|hazırlamak|for-be-ray-tın|fiil"),
      w("erklären|açıklamak|er-kle-rın|fiil"),
      w("Kultur|kültür|kul-tur|isim"),
      w("Gewohnheit|alışkanlık|ge-von-hayt|isim"),
      w("beschreiben|betimlemek|be-şray-bın|fiil"),
      w("erreichen|başarmak|er-ray-hın|fiil"),
      w("vermeiden|kaçınmak|fer-may-dın|fiil"),
      w("schaffen|oluşturmak|şa-fın|fiil"),
      w("abhängen|bağlıolmak|ap-hen-gın|fiil"),
      w("entwickeln|geliştirmek|ent-vik-keln|fiil"),
      w("anbieten|sunmak|an-bi-tın|fiil"),
      w("herstellen|üretmek|her-ştel-lın|fiil"),
      w("bleiben|kalmak|blay-bın|fiil"),
      w("auswählen|seçmek|aus-ve-lın|fiil"),
    ],
    B2: [
      w("bewerten|değerlendirmek|be-vert-ın|fiil"),
      w("zuverlässig|güvenilir|tsu-fer-le-sih|sıfat"),
      w("Annahme|varsayım|an-na-me|isim"),
      w("beitragen|katkısağlamak|bay-tra-gın|fiil"),
      w("dennoch|yinede|de-noh|zarf"),
      w("Anforderung|gereksinim|an-for-de-rung|isim"),
      w("Rahmen|çerçeve|ra-men|isim"),
      w("Ansatz|yaklaşım|an-zats|isim"),
      w("aufrechterhalten|sürdürmek|auf-reht-er-hal-tın|fiil"),
      w("Einschränkung|kısıt|ayn-şren-kung|isim"),
      w("Priorität|öncelik|pri-o-ri-tet|isim"),
      w("interpretieren|yorumlamak|in-ter-pre-ti-rın|fiil"),
      w("Beweis|kanıt|be-vays|isim"),
      w("konsistent|tutarlı|kon-zi-stent|sıfat"),
      w("schätzen|tahminetmek|şe-tsın|fiil"),
      w("analysieren|analizetmek|a-na-lü-zi-rın|fiil"),
      w("erweitern|genişletmek|er-vay-tırn|fiil"),
      w("anpassen|uyarlamak|an-pa-sın|fiil"),
      w("verhandeln|müzakereetmek|fer-han-deln|fiil"),
      w("umsetzen|uygulamak|um-zet-sın|fiil"),
      w("darstellen|göstermek|dar-ştel-lın|fiil"),
      w("klären|netleştirmek|kle-rın|fiil"),
      w("begründen|gerekçelendirmek|be-grün-dın|fiil"),
      w("überprüfen|doğrulamak|ü-ber-prü-fın|fiil"),
      w("berücksichtigen|dikkatealmak|be-rük-zih-ti-gın|fiil"),
      w("gewährleisten|sağlamak|ge-ver-lays-tın|fiil"),
      w("voraussetzen|varsaymak|fo-raus-zet-sın|fiil"),
      w("bewältigen|üstesindengelmek|be-vel-ti-gın|fiil"),
      w("vielschichtig|çokkatmanlı|fil-şihtih|sıfat"),
      w("bedeutsam|önemli|be-doyt-zam|sıfat"),
    ],
    C1: [
      w("akribisch|titiz|a-kri-biș|sıfat"),
      w("mehrdeutig|belirsiz|mer-doy-tih|sıfat"),
      w("Nuance|nüans|nu-an-se|isim"),
      w("prüfen|incelemek|prü-fın|fiil"),
      w("widerstandsfähig|dayanıklı|vi-dır-ştants-fe-hih|sıfat"),
      w("erwägen|düşünmek|er-ve-gın|fiil"),
      w("subtil|ince|zup-til|sıfat"),
      w("kohärent|tutarlı|ko-he-rent|sıfat"),
      w("Prämisse|öncül|pre-mi-se|isim"),
      w("mindern|hafifletmek|min-dırn|fiil"),
      w("Diskrepanz|uyuşmazlık|dis-kre-pants|isim"),
      w("allgegenwärtig|heryerde|al-ge-gen-ver-tih|sıfat"),
      w("tiefgründig|derin|tif-grün-dih|sıfat"),
      w("lindern|gidermek|lin-dırn|fiil"),
      w("komplex|karmaşık|kom-pleks|sıfat"),
      w("plausibel|makul|plau-zi-bel|sıfat"),
      w("untergraben|zayıflatmak|un-tır-gra-bın|fiil"),
      w("artikulieren|ifadeetmek|ar-ti-ku-li-rın|fiil"),
      w("folgern|çıkarım|fol-gırn|fiil"),
      w("synthetisieren|sentezlemek|zün-te-ti-zi-rın|fiil"),
      w("Paradigma|paradigma|pa-ra-dig-ma|isim"),
      w("Rhetorik|retorik|re-to-rik|isim"),
      w("empirisch|ampirik|em-pi-riş|sıfat"),
      w("inhärent|içkin|in-he-rent|sıfat"),
      w("Prüfung|inceleme|prü-fung|isim"),
      w("volatil|değişken|vo-la-til|sıfat"),
      w("robust|sağlam|ro-bust|sıfat"),
      w("einräumen|kabullenmek|ayn-roy-mın|fiil"),
      w("fördern|teşviketmek|för-dırn|fiil"),
      w("vorrangig|öncelikli|for-ran-gih|sıfat"),
    ],
  },
  ru: {
    A1: [
      w("яблоко|elma|yablaka|isim"),
      w("вода|su|vada|isim"),
      w("хлеб|ekmek|hleb|isim"),
      w("книга|kitap|kniga|isim"),
      w("дом|ev|dom|isim"),
      w("комната|oda|komnata|isim"),
      w("друг|arkadaş|druk|isim"),
      w("семья|aile|semya|isim"),
      w("школа|okul|şkola|isim"),
      w("работа|iş|rabota|isim"),
      w("город|şehir|gorod|isim"),
      w("день|gün|dyen|isim"),
      w("ночь|gece|noç|isim"),
      w("время|zaman|vremya|isim"),
      w("деньги|para|dyengi|isim"),
      w("еда|yemek|yeda|isim"),
      w("кофе|kahve|kofe|isim"),
      w("чай|çay|çay|isim"),
      w("машина|araba|maşina|isim"),
      w("автобус|otobüs|avtobus|isim"),
      w("ребёнок|çocuk|rebyonak|isim"),
      w("мать|anne|mat|isim"),
      w("отец|baba|atets|isim"),
      w("имя|isim|imya|isim"),
      w("дверь|kapı|dver|isim"),
      w("стол|masa|stol|isim"),
      w("стул|sandalye|stul|isim"),
      w("телефон|telefon|telefon|isim"),
      w("дорога|yol|daroga|isim"),
      w("язык|dil|yazık|isim"),
    ],
    A2: [
      w("путешествовать|seyahat|puteşestvavat|fiil"),
      w("погода|hava|pagoda|isim"),
      w("рынок|pazar|rınak|isim"),
      w("билет|bilet|bilyet|isim"),
      w("отель|otel|atel|isim"),
      w("поезд|tren|poezd|isim"),
      w("встреча|toplantı|vstreça|isim"),
      w("урок|ders|urok|isim"),
      w("сообщение|mesaj|saobşeniye|isim"),
      w("врач|doktor|vraç|isim"),
      w("аптека|eczane|apteka|isim"),
      w("ресторан|restoran|restaran|isim"),
      w("вопрос|soru|vapros|isim"),
      w("ответ|cevap|atvet|isim"),
      w("план|plan|plan|isim"),
      w("выходной|haftasonu|vıhadnoy|isim"),
      w("проблема|sorun|prablema|isim"),
      w("выбор|seçim|vıbar|isim"),
      w("счёт|hesap|şçyot|isim"),
      w("чек|fiş|çek|isim"),
      w("кухня|mutfak|kuhnya|isim"),
      w("сад|bahçe|sat|isim"),
      w("пляж|plaj|plyaj|isim"),
      w("аэропорт|havalimanı|aeraport|isim"),
      w("вокзал|istasyon|vagzal|isim"),
      w("магазин|dükkan|magazin|isim"),
      w("цена|fiyat|tsena|isim"),
      w("одежда|kıyafet|adejda|isim"),
      w("лекарство|ilaç|lekarstva|isim"),
      w("адрес|adres|adres|isim"),
    ],
    B1: [
      w("решение|karar|reşeniye|isim"),
      w("улучшать|geliştirmek|uluçşat|fiil"),
      w("поддерживать|desteklemek|padderjivat|fiil"),
      w("доступный|mevcut|dastupnıy|sıfat"),
      w("цель|amaç|tsel|isim"),
      w("хотя|rağmen|hatya|bağlaç"),
      w("предлагать|önermek|predlagat|fiil"),
      w("сравнивать|karşılaştırmak|sravnivat|fiil"),
      w("результат|sonuç|rezultat|isim"),
      w("причина|sebep|priçina|isim"),
      w("мнение|fikir|mneniye|isim"),
      w("опыт|deneyim|opıt|isim"),
      w("условие|koşul|usloviye|isim"),
      w("продолжать|sürdürmek|pradaljat|fiil"),
      w("увеличивать|artırmak|uveliçivat|fiil"),
      w("снижать|azaltmak|snijat|fiil"),
      w("готовить|hazırlamak|gatovit|fiil"),
      w("объяснять|açıklamak|abyasnyat|fiil"),
      w("культура|kültür|kultura|isim"),
      w("привычка|alışkanlık|privıçka|isim"),
      w("описывать|betimlemek|opisıvat|fiil"),
      w("достигать|başarmak|dastigat|fiil"),
      w("избегать|kaçınmak|izbegat|fiil"),
      w("создавать|oluşturmak|sazdavat|fiil"),
      w("зависеть|bağlıolmak|zaviset|fiil"),
      w("развивать|geliştirmek|razvivat|fiil"),
      w("производить|üretmek|praizvadit|fiil"),
      w("оставаться|kalmak|astavatsya|fiil"),
      w("выбирать|seçmek|vıbirat|fiil"),
      w("участвовать|katılmak|uçastvavat|fiil"),
    ],
    B2: [
      w("оценивать|değerlendirmek|atsenivat|fiil"),
      w("надежный|güvenilir|nadyöjnıy|sıfat"),
      w("предположение|varsayım|predpalojeniye|isim"),
      w("вносить|katkısağlamak|vnasit|fiil"),
      w("однако|ancak|adnaka|bağlaç"),
      w("требование|gereksinim|trebavaniye|isim"),
      w("рамка|çerçeve|ramka|isim"),
      w("подход|yaklaşım|padhod|isim"),
      w("сохранять|sürdürmek|sahranyat|fiil"),
      w("ограничение|kısıt|agraniçeniye|isim"),
      w("приоритет|öncelik|prioritet|isim"),
      w("интерпретировать|yorumlamak|interpretiravat|fiil"),
      w("доказательство|kanıt|dakazatelstva|isim"),
      w("последовательный|tutarlı|pasledavatelnıy|sıfat"),
      w("предполагать|tahminetmek|predpalagat|fiil"),
      w("анализировать|analizetmek|analiziravat|fiil"),
      w("расширять|genişletmek|raşşiryat|fiil"),
      w("адаптировать|uyarlamak|adaptiravat|fiil"),
      w("договариваться|müzakereetmek|dagavarivatsya|fiil"),
      w("внедрять|uygulamak|vnedryat|fiil"),
      w("иллюстрировать|göstermek|illyustriravat|fiil"),
      w("уточнять|netleştirmek|utoçnyat|fiil"),
      w("обосновывать|gerekçelendirmek|abasnovıvat|fiil"),
      w("проверять|doğrulamak|praveryat|fiil"),
      w("учитывать|dikkatealmak|uçitıvat|fiil"),
      w("обеспечивать|sağlamak|abespeçivat|fiil"),
      w("справляться|üstesindengelmek|spravlyatsya|fiil"),
      w("сложный|karmaşık|slojnıy|sıfat"),
      w("устойчивый|dayanıklı|ustoyçivıy|sıfat"),
      w("значительный|önemli|znaçitelnıy|sıfat"),
    ],
    C1: [
      w("скрупулёзный|titiz|skrupulyoznıy|sıfat"),
      w("двусмысленный|belirsiz|dvusmıslenıy|sıfat"),
      w("нюанс|nüans|nyuans|isim"),
      w("изучать|incelemek|izuçat|fiil"),
      w("стойкий|dayanıklı|stoykiy|sıfat"),
      w("обдумывать|düşünmek|abdumıvat|fiil"),
      w("тонкий|ince|tonkiy|sıfat"),
      w("согласованный|tutarlı|saglasovannıy|sıfat"),
      w("посылка|öncül|pasılka|isim"),
      w("смягчать|hafifletmek|smyagçat|fiil"),
      w("расхождение|uyuşmazlık|rashajdeniye|isim"),
      w("повсеместный|heryerde|pavsemestnıy|sıfat"),
      w("глубокий|derin|glubokiy|sıfat"),
      w("облегчать|gidermek|ablegçat|fiil"),
      w("запутанный|karmaşık|zaputannıy|sıfat"),
      w("правдоподобный|makul|pravdapadobnıy|sıfat"),
      w("подрывать|zayıflatmak|padrıvat|fiil"),
      w("формулировать|ifadeetmek|formuliravat|fiil"),
      w("выводить|çıkarım|vıvadit|fiil"),
      w("синтезировать|sentezlemek|sinteziravat|fiil"),
      w("парадигма|paradigma|paradigma|isim"),
      w("риторика|retorik|ritorika|isim"),
      w("эмпирический|ampirik|empiriçeskiy|sıfat"),
      w("присущий|içkin|prisuşçiy|sıfat"),
      w("проверка|inceleme|praverka|isim"),
      w("изменчивый|değişken|izmençivıy|sıfat"),
      w("прочный|sağlam|proçnıy|sıfat"),
      w("признавать|kabullenmek|priznavat|fiil"),
      w("способствовать|teşviketmek|spasobstvavat|fiil"),
      w("первостепенный|öncelikli|pervastepenniy|sıfat"),
    ],
  },
};

type EnglishVerbForms = {
  base: string;
  past: string;
  participle: string;
  gerund: string;
};

type RussianVerbForms = {
  note: string;
  present: GrammarTable["rows"];
  past: GrammarTable["rows"];
};

const ENGLISH_VERB_OVERRIDES: Record<string, EnglishVerbForms> = {
  be: { base: "be", past: "was/were", participle: "been", gerund: "being" },
  do: { base: "do", past: "did", participle: "done", gerund: "doing" },
  have: { base: "have", past: "had", participle: "had", gerund: "having" },
};

const GERMAN_ARTICLE_OVERRIDES: Record<string, string> = {
  Apfel: "der Apfel",
  Wasser: "das Wasser",
  Brot: "das Brot",
  Buch: "das Buch",
  Haus: "das Haus",
  Zimmer: "das Zimmer",
  Freund: "der Freund",
  Familie: "die Familie",
  Schule: "die Schule",
  Arbeit: "die Arbeit",
  Stadt: "die Stadt",
  Tag: "der Tag",
  Nacht: "die Nacht",
  Zeit: "die Zeit",
  Geld: "das Geld",
  Essen: "das Essen",
  Kaffee: "der Kaffee",
  Tee: "der Tee",
  Auto: "das Auto",
  Bus: "der Bus",
  Kind: "das Kind",
  Mutter: "die Mutter",
  Vater: "der Vater",
  Name: "der Name",
  Tür: "die Tür",
  Tisch: "der Tisch",
  Stuhl: "der Stuhl",
  Handy: "das Handy",
  Straße: "die Straße",
  Sprache: "die Sprache",
};

const RUSSIAN_VERB_OVERRIDES: Record<string, RussianVerbForms> = {
  говорить: russianVerbForms(
    "Konuşmak fiilidir; -ить grubunda şahıs ekleriyle düzenli biçimde çekilir.",
    ["я", "говорю"],
    ["ты", "говоришь"],
    ["он/она/оно", "говорит"],
    ["мы", "говорим"],
    ["вы", "говорите"],
    ["они", "говорят"],
    ["он", "говорил"],
    ["она", "говорила"],
    ["оно", "говорило"],
    ["они", "говорили"],
  ),
  путешествовать: russianVerbForms(
    "Seyahat etmek fiilidir; şimdiki zamanda -ствую/-ствуешь dizisini alır.",
    ["я", "путешествую"],
    ["ты", "путешествуешь"],
    ["он/она/оно", "путешествует"],
    ["мы", "путешествуем"],
    ["вы", "путешествуете"],
    ["они", "путешествуют"],
    ["он", "путешествовал"],
    ["она", "путешествовала"],
    ["оно", "путешествовало"],
    ["они", "путешествовали"],
  ),
  оставаться: russianVerbForms(
    "Dönüşlü fiildir; -ся eki çekimden sonra korunur.",
    ["я", "остаюсь"],
    ["ты", "остаёшься"],
    ["он/она/оно", "остаётся"],
    ["мы", "остаёмся"],
    ["вы", "остаётесь"],
    ["они", "остаются"],
    ["он", "оставался"],
    ["она", "оставалась"],
    ["оно", "оставалось"],
    ["они", "оставались"],
  ),
};

export const VOCABULARY_CARDS: VocabularyCard[] = buildCatalog(CATALOG_SEED);
export const CATALOG_REPORT = getCatalogReport(VOCABULARY_CARDS);

export function isSingleWordTerm(term: string) {
  return SINGLE_WORD_PATTERN.test(term.trim());
}

export function createCardSourceKey(language: LanguageCode, tier: Tier, term: string, partOfSpeech: string) {
  return `${language}-${tier.toLowerCase()}-${slug(partOfSpeech)}-${slug(term)}`;
}

export function getCatalogReport(cards: VocabularyCard[]): CatalogReport {
  const byLanguage = emptyLanguageCount();
  const byLanguageTier = emptyLanguageTierCount();
  const byPartOfSpeech: Record<string, number> = {};
  const termMap = new Map<string, string[]>();

  for (const card of cards) {
    byLanguage[card.language] += 1;
    byLanguageTier[card.language][card.tier] += 1;
    byPartOfSpeech[card.partOfSpeech] = (byPartOfSpeech[card.partOfSpeech] ?? 0) + 1;

    const duplicateKey = `${card.language}:${card.term.toLocaleLowerCase("en")}`;
    termMap.set(duplicateKey, [...(termMap.get(duplicateKey) ?? []), card.id]);
  }

  const duplicateTerms = [...termMap.entries()].flatMap(([key, ids]) => {
    if (ids.length < 2) {
      return [];
    }

    const [language, term] = key.split(":") as [LanguageCode, string];
    return [{ language, term, ids }];
  });

  return {
    total: cards.length,
    byLanguage,
    byLanguageTier,
    byPartOfSpeech,
    invalidTerms: cards
      .filter((card) => !isSingleWordTerm(card.term))
      .map(({ id, language, tier, term }) => ({ id, language, tier, term })),
    duplicateTerms,
    samples: Object.fromEntries(
      LANGUAGES.map((language) => [
        language,
        cards.filter((card) => card.language === language).slice(0, 12).map((card) => card.term),
      ]),
    ) as Record<LanguageCode, string[]>,
  };
}

function buildCatalog(seed: CatalogSeed): VocabularyCard[] {
  return LANGUAGES.flatMap((language) =>
    TIERS.flatMap((tier) =>
      seed[language][tier].map((word) => {
        const sourceKey = createCardSourceKey(language, tier, word.term, word.partOfSpeech);
        const baseExample = buildBaseExample(language, word);

        return createVocabularyCard({
          id: sourceKey,
          sourceKey,
          language,
          tier,
          card: {
            ...word,
            example: baseExample.sentence,
            exampleTranslation: baseExample.translation,
          },
          sourceTerm: word,
        });
      }),
    ),
  );
}

function createVocabularyCard({
  id,
  sourceKey,
  language,
  tier,
  card,
  sourceTerm,
}: {
  id: string;
  sourceKey: string;
  language: LanguageCode;
  tier: Tier;
  card: Omit<VocabularyCard, "id" | "sourceKey" | "language" | "tier" | "examples" | "grammar">;
  sourceTerm: WordSeed;
}): VocabularyCard {
  let examples: CardExample[] | undefined;
  let grammar: GrammarGuide | undefined;

  return {
    id,
    sourceKey,
    language,
    tier,
    ...card,
    get examples() {
      examples ??= buildCardExamples(language, card, tier);
      return examples;
    },
    get grammar() {
      grammar ??= buildGrammarGuide(language, card, sourceTerm);
      return grammar;
    },
  };
}

function w(value: string): WordSeed {
  const [term, translation, pronunciation, partOfSpeech] = value.split("|");

  if (!term || !translation || !pronunciation || !partOfSpeech) {
    throw new Error(`Invalid word seed: ${value}`);
  }

  return { term, translation, pronunciation, partOfSpeech };
}

function buildBaseExample(language: LanguageCode, word: WordSeed) {
  if (language === "en") {
    return {
      sentence: `"${word.term}" is useful in a clear sentence.`,
      translation: `"${word.term}" açık bir cümlede faydalıdır.`,
    };
  }

  if (language === "de") {
    return {
      sentence: `"${word.term}" ist in einem klaren Satz nützlich.`,
      translation: `"${word.term}" açık bir cümlede faydalıdır.`,
    };
  }

  return {
    sentence: `«${word.term}» полезно в понятном предложении.`,
    translation: `«${word.term}» açık bir cümlede faydalıdır.`,
  };
}

function buildCardExamples(
  language: LanguageCode,
  card: Pick<VocabularyCard, "term" | "translation" | "example" | "exampleTranslation">,
  tier: Tier,
): CardExample[] {
  const builders = {
    en: buildEnglishExamples,
    de: buildGermanExamples,
    ru: buildRussianExamples,
  } satisfies Record<LanguageCode, typeof buildEnglishExamples>;

  return builders[language](card, tier);
}

function cardExample(
  context: CardExample["context"],
  label: string,
  sentence: string,
  translation: string,
): CardExample {
  return {
    id: context,
    context,
    label,
    sentence,
    translation,
  };
}

function buildEnglishExamples(
  card: Pick<VocabularyCard, "term" | "translation" | "example" | "exampleTranslation">,
  tier: Tier,
): CardExample[] {
  return [
    cardExample("daily", "Günlük kullanım", card.example, card.exampleTranslation),
    cardExample("question", "Soru", `Can you explain "${card.term}" with one example?`, `"${card.term}" kelimesini bir örnekle açıklayabilir misin?`),
    cardExample("negative", "Olumsuz", `Do not translate "${card.term}" without context.`, `"${card.term}" kelimesini bağlam olmadan çevirme.`),
    cardExample("contextual", "Bağlam", `In a ${tier} lesson, "${card.term}" points to ${card.translation}.`, `${tier} seviyesinde "${card.term}", ${card.translation} anlamına yönlendirir.`),
    cardExample("natural", "Doğal kullanım", `Native speakers notice the nuance of "${card.term}" quickly.`, `Ana dili İngilizce olanlar "${card.term}" nüansını hızlı fark eder.`),
  ];
}

function buildGermanExamples(
  card: Pick<VocabularyCard, "term" | "translation" | "example" | "exampleTranslation">,
  tier: Tier,
): CardExample[] {
  return [
    cardExample("daily", "Günlük kullanım", card.example, card.exampleTranslation),
    cardExample("question", "Soru", `Kannst du "${card.term}" mit einem Beispiel erklären?`, `"${card.term}" kelimesini bir örnekle açıklayabilir misin?`),
    cardExample("negative", "Olumsuz", `Übersetze "${card.term}" nicht ohne Kontext.`, `"${card.term}" kelimesini bağlam olmadan çevirme.`),
    cardExample("contextual", "Bağlam", `Auf dem Niveau ${tier} zeigt "${card.term}" die Bedeutung ${card.translation}.`, `${tier} seviyesinde "${card.term}", ${card.translation} anlamını gösterir.`),
    cardExample("natural", "Doğal kullanım", `"${card.term}" klingt natürlich, wenn der Satz klar ist.`, `Cümle açık olduğunda "${card.term}" doğal duyulur.`),
  ];
}

function buildRussianExamples(
  card: Pick<VocabularyCard, "term" | "translation" | "example" | "exampleTranslation">,
  tier: Tier,
): CardExample[] {
  return [
    cardExample("daily", "Günlük kullanım", card.example, card.exampleTranslation),
    cardExample("question", "Soru", `Можно объяснить «${card.term}» одним примером?`, `«${card.term}» kelimesini bir örnekle açıklayabilir misin?`),
    cardExample("negative", "Olumsuz", `Не переводи «${card.term}» без контекста.`, `«${card.term}» kelimesini bağlam olmadan çevirme.`),
    cardExample("contextual", "Bağlam", `На уровне ${tier} «${card.term}» указывает на значение ${card.translation}.`, `${tier} seviyesinde «${card.term}», ${card.translation} anlamına yönlendirir.`),
    cardExample("natural", "Doğal kullanım", `В живой речи «${card.term}» звучит естественно в ясной ситуации.`, `Canlı konuşmada «${card.term}» açık bir durumda doğal duyulur.`),
  ];
}

function buildGrammarGuide(language: LanguageCode, card: Pick<VocabularyCard, "term" | "partOfSpeech">, sourceTerm: WordSeed): GrammarGuide {
  const builders = {
    en: buildEnglishGrammarGuide,
    de: buildGermanGrammarGuide,
    ru: buildRussianGrammarGuide,
  } satisfies Record<LanguageCode, (card: Pick<VocabularyCard, "term" | "partOfSpeech">, sourceTerm: WordSeed) => GrammarGuide>;

  return builders[language](card, sourceTerm);
}

function buildEnglishGrammarGuide(card: Pick<VocabularyCard, "term" | "partOfSpeech">, sourceTerm: WordSeed): GrammarGuide {
  if (isVerb(sourceTerm)) {
    const forms = buildEnglishVerbForms(sourceTerm.term);

    return {
      summary: `"${card.term}" İngilizcede fiil kökenli bir karttır; zaman ve yardımcı fiile göre biçim değiştirir.`,
      rules: [
        "Geniş zamanda üçüncü tekil şahısta genellikle -s alır.",
        "Soru ve olumsuz yapılarda do/does/did yardımcı fiilleri anlamı taşır.",
        "Tek kelime fiillerde çekim doğrudan ana fiil üzerinde takip edilir.",
      ],
      details: [
        "İngilizce fiillerde biçim sayısı azdır; doğru yardımcı fiili seçmek Türkçe karşılıktan daha önemlidir.",
      ],
      tables: [
        {
          title: "Temel fiil formları",
          columns: ["Form", "Kullanım"],
          rows: [
            [forms.base, "base / infinitive"],
            [forms.past, "past simple"],
            [forms.participle, "past participle"],
            [forms.gerund, "gerund / continuous"],
          ],
        },
      ],
    };
  }

  return {
    summary: `"${card.term}" İngilizcede ${sourceTerm.partOfSpeech} olarak kullanılan tek kelimelik bir karttır.`,
    rules: [
      "İngilizcede kelime sırası anlam için kritiktir.",
      "İsimlerde tekil/çoğul ve artikel kullanımı bağlama göre değişir.",
      "Sıfatlar çoğunlukla isimden önce gelir ve Türkçedeki gibi çekimlenmez.",
    ],
    details: [
      "Kartı çalışırken kelimenin cümlede özne, nesne veya niteleyici olarak durduğu yere dikkat et.",
    ],
  };
}

function buildGermanGrammarGuide(card: Pick<VocabularyCard, "term" | "partOfSpeech">, sourceTerm: WordSeed): GrammarGuide {
  if (isVerb(sourceTerm)) {
    const infinitive = sourceTerm.term;
    const stem = inferGermanStem(infinitive);

    return {
      summary: `"${card.term}" Almancada fiil kökenli bir karttır; şahsa göre Präsens çekimi değişir.`,
      rules: [
        "Çekimli fiil ana cümlede genellikle ikinci pozisyonda durur.",
        "Ich/du/er-sie-es/wir/ihr/sie şahısları farklı ekler alır.",
        "Ayrılabilen fiillerde ön ek cümlenin sonuna gidebilir.",
      ],
      details: [
        "Almanca fiillerde cümle pozisyonu en az çekim kadar önemlidir; örneklerde fiilin yerine dikkat et.",
      ],
      tables: [
        {
          title: "Präsens çekimi",
          columns: ["Şahıs", "Form"],
          rows: [
            ["ich", `${stem}e`],
            ["du", `${stem}st`],
            ["er/sie/es", `${stem}t`],
            ["wir", infinitive],
            ["ihr", `${stem}t`],
            ["sie/Sie", infinitive],
          ],
        },
      ],
    };
  }

  const article = GERMAN_ARTICLE_OVERRIDES[sourceTerm.term];

  return {
    summary: `"${card.term}" Almancada ${sourceTerm.partOfSpeech} olarak kullanılan tek kelimelik bir karttır.`,
    rules: [
      article ? `Bu kelime için temel artikel: ${article}.` : "İsimlerde der/die/das artikeli ayrıca çalışılmalıdır.",
      "Artikel, çoğul ve hal bilgisi cümlenin anlamını doğrudan etkiler.",
      "Sıfatlar artikel ve ismin hâline göre ek alabilir.",
    ],
    details: [
      "Almanca kartlarda kelimeyi tek başına değil, artikel ve örnek cümleyle birlikte çalışmak daha kalıcıdır.",
    ],
  };
}

function buildRussianGrammarGuide(card: Pick<VocabularyCard, "term" | "partOfSpeech">, sourceTerm: WordSeed): GrammarGuide {
  if (isVerb(sourceTerm)) {
    const forms = RUSSIAN_VERB_OVERRIDES[sourceTerm.term] ?? buildFallbackRussianVerbForms(sourceTerm.term);

    return {
      summary: `"${card.term}" Rusçada fiil kökenli bir karttır; şahıs, zaman ve cinsiyete göre çekim alır.`,
      rules: [
        "Şimdiki/geniş zamanda şahıs eki fiilin sonuna gelir.",
        "Geçmiş zamanda öznenin cinsiyetine ve çoğulluğuna göre form değişir.",
        "Rusçada özne düşebilir; çekim çoğu zaman kimin yaptığına dair ipucu verir.",
      ],
      details: [
        forms.note,
        "Çekim tablosu temel öğrenme içindir; gerçek kullanımda görünüş ve vurgu farkları ayrıca çalışılmalıdır.",
      ],
      tables: [
        {
          title: "Şimdiki/geniş zaman",
          columns: ["Şahıs", "Form"],
          rows: forms.present,
        },
        {
          title: "Geçmiş zaman",
          columns: ["Özne", "Form"],
          rows: forms.past,
        },
      ],
    };
  }

  return {
    summary: `"${card.term}" Rusçada ${sourceTerm.partOfSpeech} olarak kullanılan tek kelimelik bir karttır.`,
    rules: [
      "İsim ve sıfatlarda hâl sistemi anlamı belirler.",
      "Kelimenin cümlede özne, nesne veya yer bilgisi olmasına göre son ekler değişebilir.",
      "Vurgu ve telaffuz, yazılı form kadar önemlidir.",
    ],
    details: [
      "Rusça kartlarda örnek cümleleri özellikle hâl ekleri ve kelime sırası açısından karşılaştırarak çalış.",
    ],
  };
}

function buildEnglishVerbForms(term: string) {
  const baseForm = term.toLocaleLowerCase("en");
  const irregular = ENGLISH_VERB_OVERRIDES[baseForm];

  if (irregular) {
    return irregular;
  }

  const past = baseForm.endsWith("e")
    ? `${baseForm}d`
    : baseForm.endsWith("y")
      ? `${baseForm.slice(0, -1)}ied`
      : `${baseForm}ed`;
  const gerund = baseForm.endsWith("e") ? `${baseForm.slice(0, -1)}ing` : `${baseForm}ing`;

  return {
    base: baseForm,
    past,
    participle: past,
    gerund,
  };
}

function russianVerbForms(
  note: string,
  ya: string[],
  ty: string[],
  third: string[],
  my: string[],
  vy: string[],
  oni: string[],
  pastMasculine: string[],
  pastFeminine: string[],
  pastNeuter: string[],
  pastPlural: string[],
): RussianVerbForms {
  return {
    note,
    present: [ya, ty, third, my, vy, oni],
    past: [pastMasculine, pastFeminine, pastNeuter, pastPlural],
  };
}

function inferGermanStem(infinitive: string) {
  if (infinitive.endsWith("eln") || infinitive.endsWith("ern")) {
    return infinitive.slice(0, -1);
  }

  if (infinitive.endsWith("en")) {
    return infinitive.slice(0, -2);
  }

  if (infinitive.endsWith("n")) {
    return infinitive.slice(0, -1);
  }

  return infinitive;
}

function buildFallbackRussianVerbForms(term: string): RussianVerbForms {
  const forms = inferRussianVerbForms(term);

  return {
    note: "Bu fiil için otomatik çekim tablosu gösteriliyor; Supabase'e taşınmadan önce yaygın fiiller elle zenginleştirilebilir.",
    present: forms.present,
    past: forms.past,
  };
}

function inferRussianVerbForms(term: string) {
  const reflexiveSuffix = term.endsWith("ся") || term.endsWith("сь") ? "ся" : "";
  const bare = reflexiveSuffix ? term.slice(0, -2) : term;
  const pastStem = inferRussianPastStem(bare);

  if (bare.endsWith("ать")) {
    const stem = bare.slice(0, -3);
    return regularRussianForms(stem, "а", pastStem, reflexiveSuffix);
  }

  if (bare.endsWith("ять")) {
    const stem = bare.slice(0, -3);
    return regularRussianForms(stem, "я", pastStem, reflexiveSuffix);
  }

  if (bare.endsWith("ить")) {
    const stem = bare.slice(0, -3);
    return {
      present: [
        ["я", `${stem}ю${reflexiveSuffix}`],
        ["ты", `${stem}ишь${reflexiveSuffix}`],
        ["он/она/оно", `${stem}ит${reflexiveSuffix}`],
        ["мы", `${stem}им${reflexiveSuffix}`],
        ["вы", `${stem}ите${reflexiveSuffix}`],
        ["они", `${stem}ят${reflexiveSuffix}`],
      ],
      past: buildRussianPastRows(pastStem, reflexiveSuffix),
    };
  }

  return regularRussianForms(bare, "а", pastStem, reflexiveSuffix);
}

function regularRussianForms(stem: string, vowel: "а" | "я", pastStem: string, reflexiveSuffix: string) {
  return {
    present: [
      ["я", `${stem}${vowel}ю${reflexiveSuffix}`],
      ["ты", `${stem}${vowel}ешь${reflexiveSuffix}`],
      ["он/она/оно", `${stem}${vowel}ет${reflexiveSuffix}`],
      ["мы", `${stem}${vowel}ем${reflexiveSuffix}`],
      ["вы", `${stem}${vowel}ете${reflexiveSuffix}`],
      ["они", `${stem}${vowel}ют${reflexiveSuffix}`],
    ],
    past: buildRussianPastRows(pastStem, reflexiveSuffix),
  };
}

function inferRussianPastStem(term: string) {
  for (const ending of ["овать", "евать", "ывать", "ивать", "ать", "ять", "ить", "еть", "ти", "ть"]) {
    if (term.endsWith(ending)) {
      return term.slice(0, -ending.length);
    }
  }

  return term;
}

function buildRussianPastRows(stem: string, reflexiveSuffix: string) {
  return [
    ["он", `${stem}л${reflexiveSuffix}`],
    ["она", `${stem}ла${reflexiveSuffix}`],
    ["оно", `${stem}ло${reflexiveSuffix}`],
    ["они", `${stem}ли${reflexiveSuffix}`],
  ];
}

function isVerb(term: WordSeed) {
  return term.partOfSpeech === "fiil";
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyLanguageCount(): Record<LanguageCode, number> {
  return {
    en: 0,
    de: 0,
    ru: 0,
  };
}

function emptyLanguageTierCount(): Record<LanguageCode, Record<Tier, number>> {
  return {
    en: emptyTierCount(),
    de: emptyTierCount(),
    ru: emptyTierCount(),
  };
}

function emptyTierCount(): Record<Tier, number> {
  return {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
  };
}
