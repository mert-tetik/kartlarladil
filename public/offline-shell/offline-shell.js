(function () {
  "use strict";

  const DB_NAME = "foxiesdeck-offline-v1";
  const DB_VERSION = 1;
  const DATABASE_OPEN_TIMEOUT_MS = 1_500;
  const PROFILE_KEY = "foxiesdeck:offline-profile";
  const LOCALE_KEY = "foxiesdeck:locale";
  const CARD_LANGUAGE_KEY = "foxiesdeck:landing-card-language";
  const SNAPSHOT_FALLBACK_PREFIX = DB_NAME + ":snapshot:";
  let persistenceRequestStarted = false;
  const locales = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
  const languagePickerOrder = ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "tr", "ru", "ar", "ja", "ko", "zh-CN"];
  const languageNameFallback = {
    en: "English", de: "German", fr: "French", es: "Spanish", it: "Italian", pt: "Portuguese", nl: "Dutch",
    pl: "Polish", tr: "Turkish", ru: "Russian", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese (Simplified)",
  };
  const cardLanguageLabelCopy = {
    en: "Card Language", tr: "Kart Dili", de: "Kartensprache", ru: "Язык карточек", fr: "Langue des cartes",
    es: "Idioma de las cartas", it: "Lingua delle carte", pt: "Idioma do cartão", nl: "Kaarttaal", pl: "Język kart",
    ar: "لغة البطاقة", ja: "カードの言語", ko: "카드 언어", "zh-CN": "卡片语言",
  };
  const selectLanguageCopy = {
    en: "Select language", tr: "Dil seç", de: "Select language", ru: "Выбрать язык", fr: "Select language",
    es: "Select language", it: "Select language", pt: "Select language", nl: "Select language", pl: "Select language",
    ar: "Select language", ja: "Select language", ko: "Select language", "zh-CN": "Select language",
  };
  const languageNativeName = {
    en: "English", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano", pt: "Português", nl: "Nederlands",
    pl: "Polski", tr: "Türkçe", ru: "Русский", ar: "العربية", ja: "日本語", ko: "한국어", "zh-CN": "简体中文",
  };
  const noCardsInLanguageCopy = {
    en: "No saved cards in this language.", tr: "Bu dilde kaydedilmiş kartın yok.", de: "Für diese Sprache sind keine Karten gespeichert.",
    ru: "Для этого языка нет сохранённых карточек.", fr: "Aucune carte n’est enregistrée dans cette langue.",
    es: "No hay tarjetas guardadas en este idioma.", it: "Non ci sono carte salvate in questa lingua.", pt: "Não há cartões salvos neste idioma.",
    nl: "Er zijn geen kaarten opgeslagen in deze taal.", pl: "Brak zapisanych kart w tym języku.", ar: "لا توجد بطاقات محفوظة بهذه اللغة.",
    ja: "この言語で保存されたカードはありません。", ko: "이 언어로 저장된 카드가 없습니다.", "zh-CN": "没有保存此语言的卡片。",
  };
  const savedCardFilterCopy = {
    en: { label: "Saved card status", active: "To learn", learned: "Learned", emptyActive: "No cards to learn in this language.", emptyLearned: "No learned cards in this language." },
    tr: { label: "Kaydedilmiş kart durumu", active: "Öğrenilecek", learned: "Öğrenilmiş", emptyActive: "Bu dilde öğrenilecek kartın yok.", emptyLearned: "Bu dilde öğrenilmiş kartın yok." },
    de: { label: "Status gespeicherter Karten", active: "Zu lernen", learned: "Gelernt", emptyActive: "Keine Karten zum Lernen in dieser Sprache.", emptyLearned: "Keine gelernten Karten in dieser Sprache." },
    ru: { label: "Статус сохранённых карточек", active: "К изучению", learned: "Выученные", emptyActive: "В этом языке нет карточек для изучения.", emptyLearned: "В этом языке нет выученных карточек." },
    fr: { label: "Statut des cartes enregistrées", active: "À apprendre", learned: "Apprises", emptyActive: "Aucune carte à apprendre dans cette langue.", emptyLearned: "Aucune carte apprise dans cette langue." },
    es: { label: "Estado de las tarjetas guardadas", active: "Por aprender", learned: "Aprendidas", emptyActive: "No hay tarjetas por aprender en este idioma.", emptyLearned: "No hay tarjetas aprendidas en este idioma." },
    it: { label: "Stato delle schede salvate", active: "Da imparare", learned: "Imparate", emptyActive: "Non ci sono schede da imparare in questa lingua.", emptyLearned: "Non ci sono schede imparate in questa lingua." },
    pt: { label: "Estado dos cartões salvos", active: "Para aprender", learned: "Aprendidos", emptyActive: "Não há cartões para aprender neste idioma.", emptyLearned: "Não há cartões aprendidos neste idioma." },
    nl: { label: "Status van opgeslagen kaarten", active: "Nog te leren", learned: "Geleerd", emptyActive: "Er zijn geen kaarten meer te leren in deze taal.", emptyLearned: "Er zijn geen geleerde kaarten in deze taal." },
    pl: { label: "Stan zapisanych kart", active: "Do nauczenia", learned: "Nauczone", emptyActive: "W tym języku nie ma kart do nauczenia.", emptyLearned: "W tym języku nie ma nauczonych kart." },
    ar: { label: "حالة البطاقات المحفوظة", active: "للتعلم", learned: "تم تعلمها", emptyActive: "لا توجد بطاقات لتعلمها بهذه اللغة.", emptyLearned: "لا توجد بطاقات متعلمة بهذه اللغة." },
    ja: { label: "保存したカードの状態", active: "学習する", learned: "習得済み", emptyActive: "この言語には学習するカードがありません。", emptyLearned: "この言語には習得済みのカードがありません。" },
    ko: { label: "저장된 카드 상태", active: "학습할 카드", learned: "학습 완료", emptyActive: "이 언어에는 학습할 카드가 없어요.", emptyLearned: "이 언어에는 학습 완료된 카드가 없어요." },
    "zh-CN": { label: "已保存卡片状态", active: "待学习", learned: "已学会", emptyActive: "此语言没有待学习的卡片。", emptyLearned: "此语言没有已学会的卡片。" },
  };
  const saveErrorCopy = {
    en: "Couldn't save the note. Check device storage.",
    tr: "Not kaydedilemedi. Cihaz depolama alanını kontrol et.",
    de: "Notiz konnte nicht gespeichert werden. Prüfe den Gerätespeicher.",
    ru: "Не удалось сохранить заметку. Проверьте память устройства.",
    fr: "Impossible d’enregistrer la note. Vérifiez l’espace disponible.",
    es: "No se pudo guardar la nota. Comprueba el almacenamiento del dispositivo.",
    it: "Impossibile salvare la nota. Controlla lo spazio sul dispositivo.",
    pt: "Não foi possível salvar a nota. Verifique o armazenamento do dispositivo.",
    nl: "Notitie opslaan is niet gelukt. Controleer de opslagruimte.",
    pl: "Nie udało się zapisać notatki. Sprawdź miejsce na urządzeniu.",
    ar: "تعذر حفظ الملاحظة. تحقق من مساحة التخزين على الجهاز.",
    ja: "メモを保存できませんでした。端末の空き容量を確認してください。",
    ko: "메모를 저장하지 못했어요. 기기의 저장 공간을 확인해 주세요.",
    "zh-CN": "无法保存笔记，请检查设备存储空间。",
  };
  const automaticModalIntroCopy = {
    en: "Offline notes are turned into cards automatically when a connection is available. You can add ready cards to your deck here.",
    tr: "Çevrimdışı notların bağlantı sağlanınca otomatik olarak karta dönüştürülür. Hazır kartları buradan destene ekleyebilirsin.",
    de: "Offline-Notizen werden bei bestehender Verbindung automatisch in Karten umgewandelt. Fertige Karten kannst du hier zu deinem Stapel hinzufügen.",
    ru: "Офлайн-заметки автоматически превращаются в карточки при подключении к интернету. Готовые карточки можно добавить в свою коллекцию здесь.",
    fr: "Les notes hors ligne sont automatiquement transformées en cartes dès que la connexion revient. Vous pouvez ajouter les cartes prêtes à votre jeu ici.",
    es: "Las notas sin conexión se convierten automáticamente en tarjetas cuando vuelve internet. Aquí puedes añadir las tarjetas listas a tu colección.",
    it: "Le note offline vengono trasformate automaticamente in carte quando torna la connessione. Qui puoi aggiungere le carte pronte al tuo mazzo.",
    pt: "As notas offline são convertidas automaticamente em cartões quando a conexão volta. Você pode adicionar os cartões prontos ao seu baralho aqui.",
    nl: "Offline notities worden automatisch omgezet in kaarten zodra er weer verbinding is. Je kunt de kaarten hier aan je stapel toevoegen.",
    pl: "Notatki offline są automatycznie zamieniane na karty po przywróceniu połączenia. Gotowe karty możesz tutaj dodać do swojej talii.",
    ar: "تُحوَّل الملاحظات المحفوظة دون اتصال إلى بطاقات تلقائيًا عند عودة الاتصال. يمكنك إضافة البطاقات الجاهزة إلى مجموعتك من هنا.",
    ja: "オフラインのメモは、接続が戻ると自動的にカードに変換されます。完成したカードはここからデッキに追加できます。",
    ko: "오프라인 메모는 연결이 복구되면 자동으로 카드로 변환됩니다. 완성된 카드는 여기에서 덱에 추가할 수 있습니다.",
    "zh-CN": "恢复网络连接后，离线笔记会自动转换为卡片。你可以在这里将已生成的卡片加入卡组。",
  };
  const copy = {
    en: { status: "OFFLINE MODE", title: "You're offline", intro: "Your saved cards are here, and you can jot down words to turn into cards when you're back online.", reconnect: "Reconnect", reconnecting: "Checking connection…", noConnection: "FoxiesDeck still can't be reached. Your notes are safe here.", deck: "Your saved cards", noCards: "Your saved cards will appear here after the app has synced them once.", cards: "cards", notes: "Words to remember", notePlaceholder: "Write a word or phrase…", addNote: "Add note", noNotes: "Your notes stay on this device until you convert or remove them.", review: "Review saved notes", modalTitle: "Turn your notes into cards", modalIntro: "Your notes are saved on this device. Convert them into cards, or skip for now.", convert: "Convert all", skip: "Skip for now", close: "Close", converting: "Creating cards…", convertError: "Some notes couldn't be converted. They are still saved so you can try again.", addDeck: "Add to deck", adding: "Adding…", added: "Added to your deck", addError: "Couldn't add this card. It may have reached your plan's card limit.", emptyModal: "No notes are waiting to be converted.", target: "Learning language", active: "In progress", learned: "Learned", testReconnect: "Visual test: reconnect is simulated." },
    tr: { status: "ÇEVRİMDIŞI MOD", title: "İnternet bağlantın yok", intro: "Kaydettiğin kartlar burada. İnternet gelince karta dönüştürmek için yeni kelimeler not alabilirsin.", reconnect: "Yeniden bağlan", reconnecting: "Bağlantı kontrol ediliyor…", noConnection: "FoxiesDeck'e hâlâ ulaşılamıyor. Notların burada güvende.", deck: "Kaydedilmiş kartların", noCards: "Uygulama kartlarını bir kez eşitlediğinde kaydedilmiş kartların burada görünür.", cards: "kart", notes: "Not al", notePlaceholder: "Bir kelime veya ifade yaz…", addNote: "Not ekle", noNotes: "Notların, dönüştürene veya silene kadar bu cihazda kalır.", review: "Notları gözden geçir", modalTitle: "Notlarını karta dönüştür", modalIntro: "Notların bu cihazda saklanıyor. Kartlara dönüştür veya şimdilik geç.", convert: "Tümünü dönüştür", skip: "Şimdilik geç", close: "Kapat", converting: "Kartlar oluşturuluyor…", convertError: "Bazı notlar dönüştürülemedi. Daha sonra tekrar deneyebilirsin.", addDeck: "Desteye ekle", adding: "Ekleniyor…", added: "Destene eklendi", addError: "Kart eklenemedi. Abonelik kart sınırına ulaşmış olabilirsin.", emptyModal: "Dönüştürülmeyi bekleyen not yok.", target: "Öğrenme dili", active: "Devam ediyor", learned: "Öğrenildi", testReconnect: "Görsel test: yeniden bağlanma canlandırılıyor." },
    de: { status: "OFFLINE-MODUS", title: "Du bist offline", intro: "Deine gespeicherten Karten sind hier. Notiere Wörter, die du später in Karten umwandeln kannst.", reconnect: "Erneut verbinden", reconnecting: "Verbindung wird geprüft…", noConnection: "FoxiesDeck ist noch nicht erreichbar. Deine Notizen sind sicher.", deck: "Deine gespeicherten Karten", noCards: "Deine Karten erscheinen hier, sobald die App sie einmal synchronisiert hat.", cards: "Karten", notes: "Wörter merken", notePlaceholder: "Wort oder Ausdruck eingeben…", addNote: "Notiz hinzufügen", noNotes: "Deine Notizen bleiben auf diesem Gerät, bis du sie umwandelst oder löschst.", review: "Notizen ansehen", modalTitle: "Notizen in Karten umwandeln", modalIntro: "Deine Notizen sind auf diesem Gerät gespeichert. Wandle sie jetzt um oder später.", convert: "Alle umwandeln", skip: "Vorerst überspringen", close: "Schließen", converting: "Karten werden erstellt…", convertError: "Einige Notizen konnten nicht umgewandelt werden. Du kannst es später erneut versuchen.", addDeck: "Zum Deck hinzufügen", adding: "Wird hinzugefügt…", added: "Zum Deck hinzugefügt", addError: "Karte konnte nicht hinzugefügt werden. Möglicherweise ist dein Kartenlimit erreicht.", emptyModal: "Keine Notizen zur Umwandlung vorhanden.", target: "Lernsprache", active: "In Bearbeitung", learned: "Gelernt", testReconnect: "Visueller Test: Verbindung wird simuliert." },
    ru: { status: "ОФЛАЙН-РЕЖИМ", title: "Нет подключения к интернету", intro: "Здесь хранятся ваши карточки. Записывайте слова, чтобы позже превратить их в карточки.", reconnect: "Подключиться снова", reconnecting: "Проверяем подключение…", noConnection: "FoxiesDeck пока недоступен. Ваши заметки в безопасности.", deck: "Сохранённые карточки", noCards: "Карточки появятся здесь после первой синхронизации приложения.", cards: "карточек", notes: "Слова на заметку", notePlaceholder: "Введите слово или выражение…", addNote: "Добавить заметку", noNotes: "Заметки останутся на устройстве, пока вы не преобразуете или не удалите их.", review: "Просмотреть заметки", modalTitle: "Создать карточки из заметок", modalIntro: "Заметки сохранены на устройстве. Преобразуйте их в карточки или вернитесь позже.", convert: "Преобразовать все", skip: "Пока пропустить", close: "Закрыть", converting: "Создаём карточки…", convertError: "Не все заметки удалось преобразовать. Вы сможете попробовать снова.", addDeck: "Добавить в колоду", adding: "Добавляем…", added: "Добавлено в колоду", addError: "Не удалось добавить карточку. Возможно, достигнут лимит вашего тарифа.", emptyModal: "Нет заметок для преобразования.", target: "Изучаемый язык", active: "В процессе", learned: "Выучено", testReconnect: "Визуальный тест: подключение имитируется." },
    fr: { status: "MODE HORS LIGNE", title: "Vous êtes hors ligne", intro: "Vos cartes enregistrées sont ici. Notez des mots pour les transformer en cartes une fois de retour en ligne.", reconnect: "Se reconnecter", reconnecting: "Vérification de la connexion…", noConnection: "FoxiesDeck est toujours inaccessible. Vos notes sont en sécurité.", deck: "Vos cartes enregistrées", noCards: "Vos cartes apparaîtront ici après leur première synchronisation.", cards: "cartes", notes: "Mots à retenir", notePlaceholder: "Écrivez un mot ou une expression…", addNote: "Ajouter", noNotes: "Vos notes restent sur cet appareil jusqu’à leur conversion ou suppression.", review: "Voir les notes", modalTitle: "Transformer vos notes en cartes", modalIntro: "Vos notes sont enregistrées sur cet appareil. Convertissez-les en cartes ou revenez plus tard.", convert: "Tout convertir", skip: "Ignorer pour l’instant", close: "Fermer", converting: "Création des cartes…", convertError: "Certaines notes n’ont pas pu être converties. Vous pourrez réessayer.", addDeck: "Ajouter au deck", adding: "Ajout…", added: "Ajoutée au deck", addError: "Impossible d’ajouter cette carte. La limite de votre abonnement est peut-être atteinte.", emptyModal: "Aucune note à convertir.", target: "Langue étudiée", active: "En cours", learned: "Appris", testReconnect: "Test visuel : reconnexion simulée." },
    es: { status: "MODO SIN CONEXIÓN", title: "No tienes conexión", intro: "Aquí están tus tarjetas guardadas. Anota palabras para convertirlas en tarjetas cuando vuelvas a conectarte.", reconnect: "Volver a conectar", reconnecting: "Comprobando conexión…", noConnection: "FoxiesDeck aún no está disponible. Tus notas están a salvo.", deck: "Tus tarjetas guardadas", noCards: "Tus tarjetas aparecerán aquí después de que la app las sincronice una vez.", cards: "tarjetas", notes: "Palabras para recordar", notePlaceholder: "Escribe una palabra o frase…", addNote: "Añadir nota", noNotes: "Tus notas se guardan en este dispositivo hasta que las conviertas o elimines.", review: "Revisar notas", modalTitle: "Convierte tus notas en tarjetas", modalIntro: "Tus notas están guardadas en este dispositivo. Conviértelas en tarjetas o déjalo para más tarde.", convert: "Convertir todas", skip: "Omitir por ahora", close: "Cerrar", converting: "Creando tarjetas…", convertError: "No se pudieron convertir algunas notas. Puedes volver a intentarlo.", addDeck: "Añadir al mazo", adding: "Añadiendo…", added: "Añadida al mazo", addError: "No se pudo añadir. Es posible que hayas alcanzado el límite de tu plan.", emptyModal: "No hay notas pendientes de conversión.", target: "Idioma de aprendizaje", active: "En curso", learned: "Aprendida", testReconnect: "Prueba visual: reconexión simulada." },
    it: { status: "MODALITÀ OFFLINE", title: "Sei offline", intro: "Le tue carte salvate sono qui. Annota parole da trasformare in carte quando tornerai online.", reconnect: "Riconnettiti", reconnecting: "Controllo della connessione…", noConnection: "FoxiesDeck non è ancora raggiungibile. Le tue note sono al sicuro.", deck: "Le tue carte salvate", noCards: "Le carte appariranno qui dopo la prima sincronizzazione dell’app.", cards: "carte", notes: "Parole da ricordare", notePlaceholder: "Scrivi una parola o un’espressione…", addNote: "Aggiungi nota", noNotes: "Le note restano su questo dispositivo finché non le converti o le elimini.", review: "Rivedi le note", modalTitle: "Trasforma le note in carte", modalIntro: "Le note sono salvate su questo dispositivo. Convertile in carte o fallo più tardi.", convert: "Converti tutto", skip: "Salta per ora", close: "Chiudi", converting: "Creazione delle carte…", convertError: "Non è stato possibile convertire alcune note. Puoi riprovare più tardi.", addDeck: "Aggiungi al mazzo", adding: "Aggiunta…", added: "Aggiunta al mazzo", addError: "Impossibile aggiungere la carta. Potresti aver raggiunto il limite del piano.", emptyModal: "Nessuna nota da convertire.", target: "Lingua da imparare", active: "In corso", learned: "Imparata", testReconnect: "Test visivo: riconnessione simulata." },
    pt: { status: "MODO OFFLINE", title: "Você está sem conexão", intro: "Seus cartões salvos estão aqui. Anote palavras para transformá-las em cartões quando voltar à internet.", reconnect: "Reconectar", reconnecting: "Verificando conexão…", noConnection: "O FoxiesDeck ainda não pode ser acessado. Suas notas estão seguras.", deck: "Seus cartões salvos", noCards: "Seus cartões aparecerão aqui depois que o app sincronizar uma vez.", cards: "cartões", notes: "Palavras para lembrar", notePlaceholder: "Escreva uma palavra ou expressão…", addNote: "Adicionar nota", noNotes: "Suas notas ficam neste dispositivo até você convertê-las ou removê-las.", review: "Revisar notas", modalTitle: "Transforme notas em cartões", modalIntro: "Suas notas estão salvas neste dispositivo. Converta-as em cartões ou deixe para depois.", convert: "Converter tudo", skip: "Pular por enquanto", close: "Fechar", converting: "Criando cartões…", convertError: "Não foi possível converter algumas notas. Você pode tentar novamente.", addDeck: "Adicionar ao baralho", adding: "Adicionando…", added: "Adicionado ao baralho", addError: "Não foi possível adicionar. Talvez você tenha atingido o limite do seu plano.", emptyModal: "Não há notas para converter.", target: "Idioma de aprendizagem", active: "Em andamento", learned: "Aprendida", testReconnect: "Teste visual: reconexão simulada." },
    nl: { status: "OFFLINEMODUS", title: "Je bent offline", intro: "Je opgeslagen kaarten staan hier. Noteer woorden om ze om te zetten in kaarten zodra je weer online bent.", reconnect: "Opnieuw verbinden", reconnecting: "Verbinding controleren…", noConnection: "FoxiesDeck is nog niet bereikbaar. Je notities zijn veilig.", deck: "Je opgeslagen kaarten", noCards: "Je kaarten verschijnen hier zodra de app ze één keer heeft gesynchroniseerd.", cards: "kaarten", notes: "Woorden om te onthouden", notePlaceholder: "Schrijf een woord of uitdrukking…", addNote: "Notitie toevoegen", noNotes: "Je notities blijven op dit apparaat totdat je ze omzet of verwijdert.", review: "Notities bekijken", modalTitle: "Zet je notities om in kaarten", modalIntro: "Je notities zijn op dit apparaat opgeslagen. Zet ze om in kaarten of doe dat later.", convert: "Alles omzetten", skip: "Voorlopig overslaan", close: "Sluiten", converting: "Kaarten maken…", convertError: "Sommige notities konden niet worden omgezet. Je kunt het later opnieuw proberen.", addDeck: "Aan deck toevoegen", adding: "Toevoegen…", added: "Toegevoegd aan je deck", addError: "Kaart toevoegen is niet gelukt. Mogelijk is de limiet van je abonnement bereikt.", emptyModal: "Geen notities om om te zetten.", target: "Leertaal", active: "Bezig", learned: "Geleerd", testReconnect: "Visuele test: opnieuw verbinden wordt gesimuleerd." },
    pl: { status: "TRYB OFFLINE", title: "Nie masz połączenia", intro: "Tutaj znajdziesz zapisane karty. Zapisuj słowa, aby później zamienić je w karty.", reconnect: "Połącz ponownie", reconnecting: "Sprawdzanie połączenia…", noConnection: "FoxiesDeck jest nadal niedostępny. Twoje notatki są bezpieczne.", deck: "Zapisane karty", noCards: "Karty pojawią się tutaj po pierwszej synchronizacji aplikacji.", cards: "kart", notes: "Słówka do zapamiętania", notePlaceholder: "Wpisz słowo lub wyrażenie…", addNote: "Dodaj notatkę", noNotes: "Notatki pozostaną na tym urządzeniu, dopóki ich nie przekonwertujesz lub nie usuniesz.", review: "Przejrzyj notatki", modalTitle: "Zamień notatki w karty", modalIntro: "Notatki są zapisane na tym urządzeniu. Zamień je w karty albo zrób to później.", convert: "Konwertuj wszystkie", skip: "Pomiń na razie", close: "Zamknij", converting: "Tworzenie kart…", convertError: "Nie udało się przekonwertować niektórych notatek. Możesz spróbować ponownie.", addDeck: "Dodaj do talii", adding: "Dodawanie…", added: "Dodano do talii", addError: "Nie udało się dodać karty. Możliwe, że osiągnięto limit planu.", emptyModal: "Brak notatek do konwersji.", target: "Język nauki", active: "W toku", learned: "Opanowano", testReconnect: "Test wizualny: ponowne połączenie jest symulowane." },
    ar: { status: "وضع عدم الاتصال", title: "أنت غير متصل بالإنترنت", intro: "بطاقاتك المحفوظة هنا. دوّن الكلمات لتحويلها إلى بطاقات عند عودة الاتصال.", reconnect: "إعادة الاتصال", reconnecting: "جارٍ التحقق من الاتصال…", noConnection: "لا يزال FoxiesDeck غير متاح. ملاحظاتك محفوظة بأمان.", deck: "بطاقاتك المحفوظة", noCards: "ستظهر بطاقاتك هنا بعد مزامنة التطبيق لها مرة واحدة.", cards: "بطاقات", notes: "كلمات لتتذكرها", notePlaceholder: "اكتب كلمة أو عبارة…", addNote: "إضافة ملاحظة", noNotes: "تبقى ملاحظاتك على هذا الجهاز حتى تحولها أو تحذفها.", review: "مراجعة الملاحظات", modalTitle: "حوّل ملاحظاتك إلى بطاقات", modalIntro: "ملاحظاتك محفوظة على هذا الجهاز. حوّلها إلى بطاقات أو أجّل ذلك الآن.", convert: "تحويل الكل", skip: "تخطي الآن", close: "إغلاق", converting: "جارٍ إنشاء البطاقات…", convertError: "تعذر تحويل بعض الملاحظات. يمكنك المحاولة مرة أخرى لاحقًا.", addDeck: "إضافة إلى المجموعة", adding: "جارٍ الإضافة…", added: "أُضيفت إلى مجموعتك", addError: "تعذرت إضافة البطاقة. ربما وصلت إلى حد البطاقات في خطتك.", emptyModal: "لا توجد ملاحظات بانتظار التحويل.", target: "لغة التعلم", active: "قيد التعلم", learned: "تم تعلمها", testReconnect: "اختبار مرئي: تتم محاكاة إعادة الاتصال." },
    ja: { status: "オフラインモード", title: "インターネットに接続されていません", intro: "保存済みのカードを確認できます。オンラインに戻ったときにカードにする単語もメモできます。", reconnect: "再接続", reconnecting: "接続を確認しています…", noConnection: "FoxiesDeckにまだ接続できません。メモはこの端末に保存されています。", deck: "保存したカード", noCards: "アプリが一度同期すると、保存したカードがここに表示されます。", cards: "枚", notes: "覚えておく単語", notePlaceholder: "単語やフレーズを入力…", addNote: "メモを追加", noNotes: "メモは変換または削除するまでこの端末に保存されます。", review: "メモを確認", modalTitle: "メモをカードに変換", modalIntro: "メモはこの端末に保存されています。カードに変換するか、後で行ってください。", convert: "すべて変換", skip: "今はスキップ", close: "閉じる", converting: "カードを作成しています…", convertError: "一部のメモを変換できませんでした。後でもう一度お試しください。", addDeck: "デッキに追加", adding: "追加中…", added: "デッキに追加しました", addError: "カードを追加できませんでした。プランの上限に達した可能性があります。", emptyModal: "変換するメモはありません。", target: "学習する言語", active: "学習中", learned: "習得済み", testReconnect: "ビジュアルテスト：再接続をシミュレーションしています。" },
    ko: { status: "오프라인 모드", title: "인터넷에 연결되어 있지 않아요", intro: "저장된 카드를 확인하고, 온라인으로 돌아왔을 때 카드로 만들 단어를 메모할 수 있어요.", reconnect: "다시 연결", reconnecting: "연결을 확인하는 중…", noConnection: "아직 FoxiesDeck에 연결할 수 없어요. 메모는 안전하게 저장되어 있어요.", deck: "저장된 카드", noCards: "앱이 한 번 동기화되면 저장된 카드가 여기에 표시돼요.", cards: "개", notes: "기억할 단어", notePlaceholder: "단어나 표현 입력…", addNote: "메모 추가", noNotes: "메모는 변환하거나 삭제할 때까지 이 기기에 저장돼요.", review: "메모 확인", modalTitle: "메모를 카드로 만들기", modalIntro: "메모가 이 기기에 저장되어 있어요. 지금 카드로 변환하거나 나중에 할 수 있어요.", convert: "모두 변환", skip: "지금은 건너뛰기", close: "닫기", converting: "카드를 만드는 중…", convertError: "일부 메모를 변환하지 못했어요. 나중에 다시 시도할 수 있어요.", addDeck: "덱에 추가", adding: "추가 중…", added: "덱에 추가했어요", addError: "카드를 추가하지 못했어요. 요금제의 카드 한도에 도달했을 수 있어요.", emptyModal: "변환할 메모가 없어요.", target: "학습 언어", active: "학습 중", learned: "학습 완료", testReconnect: "시각 테스트: 재연결을 시뮬레이션합니다." },
    "zh-CN": { status: "离线模式", title: "当前没有网络连接", intro: "这里可以查看已保存的卡片，也可以记下单词，联网后再将它们转换成卡片。", reconnect: "重新连接", reconnecting: "正在检查连接…", noConnection: "目前仍无法连接到 FoxiesDeck。你的笔记已安全保存在此设备上。", deck: "已保存的卡片", noCards: "应用完成首次同步后，已保存的卡片会显示在这里。", cards: "张卡片", notes: "要记住的单词", notePlaceholder: "输入单词或短语…", addNote: "添加笔记", noNotes: "笔记会保存在此设备上，直到你转换或删除它们。", review: "查看笔记", modalTitle: "将笔记转换为卡片", modalIntro: "笔记已保存在此设备上。现在转换为卡片，或稍后再处理。", convert: "全部转换", skip: "暂时跳过", close: "关闭", converting: "正在创建卡片…", convertError: "部分笔记无法转换，你可以稍后重试。", addDeck: "添加到卡组", adding: "正在添加…", added: "已添加到卡组", addError: "无法添加此卡片，可能已达到套餐卡片数量上限。", emptyModal: "没有等待转换的笔记。", target: "学习语言", active: "学习中", learned: "已掌握", testReconnect: "视觉测试：正在模拟重新连接。" },
  };

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      let settled = false;
      let request;
      let timeout = 0;
      function rejectOnce(error) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(error);
      }
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        rejectOnce(error);
        return;
      }
      timeout = window.setTimeout(function () {
        rejectOnce(new Error("offline_storage_open_timeout"));
      }, DATABASE_OPEN_TIMEOUT_MS);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains("profiles")) {
          const profiles = db.createObjectStore("profiles", { keyPath: "id" });
          profiles.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("cards")) {
          const cards = db.createObjectStore("cards", { keyPath: "key" });
          cards.createIndex("profileId", "profileId");
        }
        if (!db.objectStoreNames.contains("notes")) {
          const notes = db.createObjectStore("notes", { keyPath: "key" });
          notes.createIndex("profileId", "profileId");
        }
        if (!db.objectStoreNames.contains("drafts")) {
          const drafts = db.createObjectStore("drafts", { keyPath: "key" });
          drafts.createIndex("profileId", "profileId");
        }
      };
      request.onsuccess = function () {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve(request.result);
      };
      request.onerror = function () { rejectOnce(request.error || new Error("offline_storage_unavailable")); };
    });
  }

  function requestValue(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("offline_storage_request_failed")); };
    });
  }

  function transactionDone(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || new Error("offline_storage_transaction_failed")); };
      transaction.onabort = function () { reject(transaction.error || new Error("offline_storage_transaction_aborted")); };
    });
  }

  async function readProfileRecords(storeName, profileId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(storeName, "readonly");
      // Attach the completion listener before starting/awaiting the request.
      // Fast Android WebViews can complete a readonly transaction between
      // request resolution and a later transactionDone() call.
      const completed = transactionDone(tx);
      const result = await requestValue(tx.objectStore(storeName).index("profileId").getAll(profileId));
      await completed;
      return result || [];
    } finally { db.close(); }
  }

  function activeProfileId() {
    try { return localStorage.getItem(PROFILE_KEY) || "guest"; }
    catch { return "guest"; }
  }

  function safeLocalStorageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  function readSnapshotFallback(profileId) {
    try {
      const value = JSON.parse(localStorage.getItem(SNAPSHOT_FALLBACK_PREFIX + profileId) || "null");
      if (!value || !value.profile || !Array.isArray(value.cards)) return null;
      return value;
    } catch { return null; }
  }

  async function saveSnapshot(snapshot) {
    const profileId = snapshot.profileId || "guest";
    const timestamp = new Date().toISOString();
    const nativeLanguage = snapshot.nativeLanguage || snapshot.locale || localStorage.getItem(LOCALE_KEY) || "en";
    const cardLanguage = snapshot.cardLanguage || snapshot.learningLanguage || localStorage.getItem(CARD_LANGUAGE_KEY) || "en";
    const existing = await readProfileRecords("cards", profileId);
    const existingByCardId = new Map(existing.map(function (entry) { return [entry.inventory.cardId, entry]; }));
    const changedCards = snapshot.cards.filter(function (entry) {
      const previous = existingByCardId.get(entry.inventory.cardId);
      return !previous
        || JSON.stringify(previous.inventory) !== JSON.stringify(entry.inventory)
        || JSON.stringify(previous.card) !== JSON.stringify(entry.card);
    });
    const db = await openDatabase();
    try {
      const tx = db.transaction(["profiles", "cards"], "readwrite");
      const completed = transactionDone(tx);
      tx.objectStore("profiles").put({
        id: profileId,
        nativeLanguage: nativeLanguage,
        cardLanguage: cardLanguage,
        locale: nativeLanguage,
        learningLanguage: cardLanguage,
        updatedAt: timestamp,
      });
      const cardStore = tx.objectStore("cards");
      const known = new Set(snapshot.cards.map(function (entry) { return entry.inventory.cardId; }));
      changedCards.forEach(function (entry) {
        cardStore.put({
          key: profileId + ":" + entry.inventory.cardId,
          profileId: profileId,
          inventory: entry.inventory,
          card: entry.card,
          updatedAt: timestamp,
        });
      });
      await completed;

      if (snapshot.complete) {
        const prune = db.transaction("cards", "readwrite");
        const pruneCompleted = transactionDone(prune);
        const store = prune.objectStore("cards");
        existing.forEach(function (entry) {
          if (!known.has(entry.inventory.cardId)) store.delete(entry.key);
        });
        await pruneCompleted;
      }

      localStorage.setItem(PROFILE_KEY, profileId);
      localStorage.setItem(LOCALE_KEY, nativeLanguage);
      localStorage.setItem(CARD_LANGUAGE_KEY, cardLanguage);
      if (!persistenceRequestStarted && navigator.storage && navigator.storage.persist) {
        persistenceRequestStarted = true;
        navigator.storage.persist().catch(function () {});
      }
      return { ok: true };
    } finally { db.close(); }
  }

  async function getSnapshot(profileId) {
    const id = profileId || activeProfileId();
    const fallback = readSnapshotFallback(id);
    try {
      const db = await openDatabase();
      try {
      const tx = db.transaction(["profiles", "cards"], "readonly");
      const completed = transactionDone(tx);
      const profileRequest = tx.objectStore("profiles").get(id);
      const cardsRequest = tx.objectStore("cards").index("profileId").getAll(id);
      const values = await Promise.all([requestValue(profileRequest), requestValue(cardsRequest), completed]);
      const snapshot = { profile: values[0] || null, cards: values[1] || [] };
      if (fallback && (!snapshot.profile || fallback.profile.updatedAt > snapshot.profile.updatedAt)) return fallback;
      return snapshot;
      } finally { db.close(); }
    } catch {
      return fallback || { profile: null, cards: [] };
    }
  }

  function fallbackStorageKey(storeName, profileId) {
    return DB_NAME + ":fallback:" + storeName + ":" + profileId;
  }

  function readFallbackRecords(storeName, profileId) {
    try {
      const records = JSON.parse(localStorage.getItem(fallbackStorageKey(storeName, profileId)) || "[]");
      return Array.isArray(records) ? records : [];
    } catch { return []; }
  }

  function writeFallbackRecords(storeName, profileId, records) {
    localStorage.setItem(fallbackStorageKey(storeName, profileId), JSON.stringify(records));
  }

  function dismissedStorageKey(storeName, profileId) {
    return DB_NAME + ":dismissed:" + storeName + ":" + profileId;
  }

  function readDismissedIds(storeName, profileId) {
    try {
      const ids = JSON.parse(localStorage.getItem(dismissedStorageKey(storeName, profileId)) || "[]");
      return new Set(Array.isArray(ids) ? ids.filter(function (id) { return typeof id === "string"; }) : []);
    } catch { return new Set(); }
  }

  function markRecordDismissed(storeName, profileId, recordId) {
    try {
      const ids = readDismissedIds(storeName, profileId);
      ids.add(recordId);
      localStorage.setItem(dismissedStorageKey(storeName, profileId), JSON.stringify(Array.from(ids)));
      return true;
    } catch { return false; }
  }

  function clearDismissedIds(storeName, profileId, recordIds) {
    try {
      const ids = readDismissedIds(storeName, profileId);
      recordIds.forEach(function (id) { ids.delete(id); });
      const key = dismissedStorageKey(storeName, profileId);
      if (ids.size === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(Array.from(ids)));
      return true;
    } catch { return false; }
  }

  function clearFallbackRecords(storeName, profileId, recordIds) {
    try {
      const records = storeName === "notes" ? readFallbackRecords("notes", profileId) : readFallbackDraftRecords(profileId);
      const remaining = records.filter(function (entry) {
        const record = storeName === "notes" ? entry.note : entry.draft;
        return !record || !recordIds.has(record.id);
      });
      writeFallbackRecords(storeName, profileId, remaining);
      return true;
    } catch { return false; }
  }

  async function reapDismissedRecords(storeName, profileId, recordIds) {
    if (recordIds.size === 0 || !clearFallbackRecords(storeName, profileId, recordIds)) return;
    let db = null;
    try {
      db = await openDatabase();
      const tx = db.transaction(storeName, "readwrite");
      const completed = transactionDone(tx);
      recordIds.forEach(function (id) { tx.objectStore(storeName).delete(profileId + ":" + id); });
      await completed;
      clearDismissedIds(storeName, profileId, recordIds);
    } catch {
      // Keep tombstones until IndexedDB and localStorage copies are both reaped.
    } finally { if (db) db.close(); }
  }

  async function listNotes(profileId) {
    const id = profileId || activeProfileId();
    let records = [];
    let indexedDbReadSucceeded = false;
    try { records = await readProfileRecords("notes", id); indexedDbReadSucceeded = true; } catch {}
    const dismissedIds = readDismissedIds("notes", id);
    if (indexedDbReadSucceeded && dismissedIds.size > 0) void reapDismissedRecords("notes", id, dismissedIds);
    const byId = new Map(records.filter(function (entry) { return entry.note && !dismissedIds.has(entry.note.id); }).map(function (entry) { return [entry.note.id, entry]; }));
    readFallbackRecords("notes", id).forEach(function (entry) {
      if (entry.note && !dismissedIds.has(entry.note.id) && !byId.has(entry.note.id)) byId.set(entry.note.id, entry);
    });
    return Array.from(byId.values());
  }

  async function putNote(profileId, note) {
    clearDismissedIds("notes", profileId, new Set([note.id]));
    const record = { key: profileId + ":" + note.id, profileId: profileId, note: note, createdAt: note.createdAt };
    try {
      const db = await openDatabase();
      try {
        const tx = db.transaction("notes", "readwrite");
        const completed = transactionDone(tx);
        tx.objectStore("notes").put(record);
        await completed;
      } finally { db.close(); }
      try { writeFallbackRecords("notes", profileId, readFallbackRecords("notes", profileId).filter(function (item) { return item.note && item.note.id !== note.id; })); } catch {}
    } catch {
      const records = readFallbackRecords("notes", profileId).filter(function (item) { return !item.note || item.note.id !== note.id; });
      records.push(record);
      writeFallbackRecords("notes", profileId, records);
    }
  }

  async function removeNote(profileId, noteId) {
    const dismissedIds = new Set([noteId]);
    const tombstoneStored = markRecordDismissed("notes", profileId, noteId);
    const fallbackCleared = clearFallbackRecords("notes", profileId, dismissedIds);

    let indexedDbDeleted = false;
    let indexedDbError = null;
    try {
      const db = await openDatabase();
      try {
        const tx = db.transaction("notes", "readwrite");
        const completed = transactionDone(tx);
        tx.objectStore("notes").delete(profileId + ":" + noteId);
        await completed;
        indexedDbDeleted = true;
      }
      finally { db.close(); }
    } catch (error) { indexedDbError = error; }

    if (indexedDbDeleted && fallbackCleared) clearDismissedIds("notes", profileId, dismissedIds);
    if (!tombstoneStored && (!fallbackCleared || !indexedDbDeleted)) {
      throw indexedDbError || new Error("offline_note_delete_failed");
    }
  }
  function readFallbackDraftRecords(profileId) {
    try {
      const records = JSON.parse(localStorage.getItem(fallbackStorageKey("drafts", profileId)) || "[]");
      return Array.isArray(records) ? records : [];
    } catch { return []; }
  }
  function writeFallbackDraftRecords(profileId, records) {
    localStorage.setItem(fallbackStorageKey("drafts", profileId), JSON.stringify(records));
  }
  async function listDrafts(profileId) {
    const id = profileId || activeProfileId();
    let records = [];
    let indexedDbReadSucceeded = false;
    try { records = await readProfileRecords("drafts", id); indexedDbReadSucceeded = true; } catch {}
    const dismissedIds = readDismissedIds("drafts", id);
    if (indexedDbReadSucceeded && dismissedIds.size > 0) void reapDismissedRecords("drafts", id, dismissedIds);
    const byId = new Map(records.filter(function (entry) { return entry.draft && !dismissedIds.has(entry.draft.id); }).map(function (entry) { return [entry.draft.id, entry]; }));
    readFallbackDraftRecords(id).forEach(function (entry) {
      if (entry.draft && !dismissedIds.has(entry.draft.id) && !byId.has(entry.draft.id)) byId.set(entry.draft.id, entry);
    });
    return Array.from(byId.values());
  }
  async function putDraft(profileId, draft) {
    clearDismissedIds("drafts", profileId, new Set([draft.id]));
    const record = { key: profileId + ":" + draft.id, profileId: profileId, draft: draft, createdAt: draft.createdAt };
    let db = null;
    try {
      db = await openDatabase();
      const tx = db.transaction("drafts", "readwrite");
      const completed = transactionDone(tx);
      tx.objectStore("drafts").put(record);
      await completed;
      try { writeFallbackDraftRecords(profileId, readFallbackDraftRecords(profileId).filter(function (item) { return !item.draft || item.draft.id !== draft.id; })); } catch {}
    } catch {
      const records = readFallbackDraftRecords(profileId).filter(function (item) { return !item.draft || item.draft.id !== draft.id; });
      records.push(record);
      writeFallbackDraftRecords(profileId, records);
    } finally {
      if (db) db.close();
    }
  }
  async function removeDraft(profileId, draftId) {
    const dismissedIds = new Set([draftId]);
    const tombstoneStored = markRecordDismissed("drafts", profileId, draftId);
    const fallbackCleared = clearFallbackRecords("drafts", profileId, dismissedIds);
    let indexedDbDeleted = false;
    let indexedDbError = null;
    try {
      const db = await openDatabase();
      try {
        const tx = db.transaction("drafts", "readwrite");
        const completed = transactionDone(tx);
        tx.objectStore("drafts").delete(profileId + ":" + draftId);
        await completed;
        indexedDbDeleted = true;
      } finally { db.close(); }
    } catch (error) { indexedDbError = error; }
    if (indexedDbDeleted && fallbackCleared) clearDismissedIds("drafts", profileId, dismissedIds);
    if (!tombstoneStored && (!fallbackCleared || !indexedDbDeleted)) {
      throw indexedDbError || new Error("offline_draft_delete_failed");
    }
  }

  const storageApi = { saveSnapshot: saveSnapshot, getSnapshot: getSnapshot, listNotes: listNotes, putNote: putNote, removeNote: removeNote, listDrafts: listDrafts, putDraft: putDraft, removeDraft: removeDraft };
  window.FoxiesDeckOffline = storageApi;

  function localeCode(value) {
    if (!value) return null;
    if (locales.indexOf(value) >= 0) return value;
    const normalized = String(value).toLowerCase();
    if (normalized.indexOf("zh") === 0) return "zh-CN";
    const base = normalized.split(/[-_]/)[0];
    return locales.indexOf(base) >= 0 ? base : null;
  }

  function languageDisplayName(code, displayLocale) {
    try {
      if (typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames([displayLocale], { type: "language" }).of(code) || languageNameFallback[code] || code;
      }
    } catch {}
    return languageNameFallback[code] || code;
  }

  const languageFlagEmoji = {
    en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹", pt: "🇵🇹", nl: "🇳🇱",
    pl: "🇵🇱", tr: "🇹🇷", ru: "🇷🇺", ar: "🇸🇦", ja: "🇯🇵", ko: "🇰🇷", "zh-CN": "🇨🇳",
  };

  function renderLanguageFlag(node, language) {
    if (!node) return;
    node.replaceChildren();
    node.dataset.language = language;
    const image = document.createElement("img");
    image.src = "/flags/language/" + language + ".png";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.addEventListener("error", function () {
      node.replaceChildren();
      node.textContent = languageFlagEmoji[language] || "🌐";
    }, { once: true });
    node.appendChild(image);
  }

  function makeId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  const SUPER_WATER_LOCALES = new Set(["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl"]);
  const SUPER_WATER_RANGES = [[0xa0, 0xff], [0x110, 0x111], [0x131, 0x131], [0x141, 0x142], [0x152, 0x153], [0x160, 0x161], [0x178, 0x178], [0x17d, 0x17e], [0x192, 0x192], [0x2c6, 0x2c7], [0x2d8, 0x2dd], [0x2013, 0x2014], [0x2018, 0x201e], [0x2020, 0x2022], [0x2026, 0x2026], [0x2030, 0x2030], [0x2039, 0x203a], [0x2044, 0x2044], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2212, 0x2212], [0x2215, 0x2215], [0x2219, 0x2219], [0xfb01, 0xfb02]];
  function formatSuperWaterText(value) {
    return Array.from(value.replace(/\u1e9e/g, "SS").replace(/\u0130/g, "I"), function (character) {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 0x7f || SUPER_WATER_RANGES.some(function (range) { return codePoint >= range[0] && codePoint <= range[1]; })) return character;
      return character.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }).join("");
  }
  function heading(node, value, locale) {
    if (node) node.textContent = SUPER_WATER_LOCALES.has(locale) ? formatSuperWaterText(value) : value;
  }
  function text(node, value) { if (node) node.textContent = value || ""; }
  let standaloneMessageTimer = 0;
  function showStandaloneAppMessage(message, tone) {
    const host = element("standalone-app-message-host");
    if (!host) return;
    window.clearTimeout(standaloneMessageTimer);

    const toast = document.createElement("div");
    toast.className = "offline-app-message";
    toast.dataset.appMessage = tone === "success" ? "success" : "error";
    toast.setAttribute("role", tone === "error" ? "alert" : "status");

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = tone === "success"
      ? '<circle cx="12" cy="12" r="10"></circle><path d="m8 12 2.5 2.5L16 9"></path>'
      : '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path>';

    const messageText = document.createElement("span");
    messageText.className = "offline-app-message-text";
    messageText.textContent = message;
    toast.append(icon, messageText);
    host.replaceChildren(toast);

    let pointerStartX = null;
    toast.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      pointerStartX = event.clientX;
      toast.dataset.dragging = "true";
      try { toast.setPointerCapture(event.pointerId); } catch {}
    });
    toast.addEventListener("pointermove", function (event) {
      if (pointerStartX === null) return;
      toast.style.setProperty("--message-drag-offset", (event.clientX - pointerStartX) + "px");
    });
    function finishSwipe(event) {
      if (pointerStartX === null) return;
      const offset = event.clientX - pointerStartX;
      pointerStartX = null;
      delete toast.dataset.dragging;
      if (Math.abs(offset) >= 96) {
        toast.style.setProperty("--message-dismiss-offset", (offset < 0 ? "-100vw" : "100vw"));
        toast.dataset.dismissing = "true";
        window.setTimeout(function () { if (toast.parentNode === host) host.replaceChildren(); }, 450);
      } else {
        toast.style.setProperty("--message-drag-offset", "0px");
      }
    }
    toast.addEventListener("pointerup", finishSwipe);
    toast.addEventListener("pointercancel", finishSwipe);

    window.requestAnimationFrame(function () { toast.dataset.visible = "true"; });
    function dismiss() {
      if (toast.parentNode !== host) return;
      delete toast.dataset.visible;
      toast.dataset.dismissing = "true";
      window.setTimeout(function () { if (toast.parentNode === host) host.replaceChildren(); }, 450);
    }
    standaloneMessageTimer = window.setTimeout(dismiss, 5000);
  }
  function showAppMessage(message, tone) {
    if (!message) return;
    const payload = {
      type: "foxiesdeck:app-message",
      message: message,
      tone: tone,
      durationMs: 5000,
    };
    if (window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin);
      return;
    }
    showStandaloneAppMessage(message, tone);
  }
  function element(id) { return document.getElementById(id); }

  function emitOfflineSpeechStatus(text, language, state) {
    window.dispatchEvent(new CustomEvent("foxiesdeck:speech-status", {
      detail: { text: text, language: language, state: state },
    }));
  }

  async function boot() {
    if (!document.body.hasAttribute("data-offline-shell")) return;
    const params = new URLSearchParams(location.search);
    const visualMode = params.get("visual");
    const testMode = visualMode === "offline";
    if (testMode && window.parent === window) {
      location.replace("/visual-test-offline");
      return;
    }
    const profileId = testMode ? "visual-test" : activeProfileId();
    let state = { profile: null, cards: [], notes: [], drafts: [], locale: "en", learningLanguage: "en", cardFilter: "active", conversionState: "idle" };

    const fallbackLocale = localeCode(safeLocalStorageGet(LOCALE_KEY)) || localeCode(navigator.language) || "en";
    const userLocale = fallbackLocale;
    const strings = copy[userLocale] || copy.en;
    const cardFilterButtons = Array.from(document.querySelectorAll("[data-card-filter]"));
    state.locale = userLocale;
    state.learningLanguage = testMode ? "es" : localeCode(safeLocalStorageGet(CARD_LANGUAGE_KEY)) || "en";
    state.cards = [];
    state.drafts = [];
    state.notes = [];
    if (testMode && visualMode === "offline") {
      state.cards = [
        { inventory: { cardId: "demo-1", status: "active", correctCount: 2 }, card: { language: "es", term: "aprender", tier: "A2", termKind: "word", pronunciation: "a.pɾenˈdeɾ", translations: { en: "to learn", tr: "öğrenmek" }, translation: "to learn", example: "Quiero aprender español." } },
        { inventory: { cardId: "demo-2", status: "learned", correctCount: 6 }, card: { language: "es", term: "la sobremesa", tier: "B1", termKind: "fixed_phrase", pronunciation: "la so.βɾeˈme.sa", translations: { en: "conversation after a meal", tr: "yemek sonrası sohbet" }, translation: "conversation after a meal", example: "La sobremesa duró una hora." } },
        { inventory: { cardId: "demo-3", status: "active", correctCount: 1 }, card: { language: "de", term: "lernen", tier: "A1", termKind: "word", pronunciation: "ˈlɛʁnən", translations: { en: "to learn", tr: "öğrenmek" }, translation: "to learn", example: "Ich lerne Deutsch." } },
      ];
    }

    document.documentElement.lang = userLocale;
    document.documentElement.dir = userLocale === "ar" ? "rtl" : "ltr";
    document.body.dataset.offlineNativeLanguage = userLocale;
    document.body.dataset.offlineCardLanguage = state.learningLanguage;
    document.documentElement.classList.toggle("super-water-locale", SUPER_WATER_LOCALES.has(userLocale));
    heading(element("card-language-label"), cardLanguageLabelCopy[userLocale] || cardLanguageLabelCopy.en, userLocale);
    const cardLanguageSelect = element("card-language-select");
    const cardLanguageCurrent = element("card-language-current");
    const cardLanguageCurrentFlag = element("card-language-current-flag");
    const cardLanguageSelectLabel = element("card-language-select-label");
    const cardLanguageSheet = element("card-language-sheet");
    const cardLanguageSheetBackdrop = element("card-language-sheet-backdrop");
    const cardLanguageSheetClose = element("card-language-sheet-close");
    const cardLanguageSheetPanel = cardLanguageSheet.querySelector(".language-sheet-panel");
    const cardLanguageSheetDragHandle = element("card-language-sheet-drag-handle");
    const cardLanguageSheetTitle = element("card-language-sheet-title");
    const cardLanguageSheetVisual = element("card-language-sheet-visual");
    const cardLanguageOptions = element("card-language-options");
    let languageSheetCloseTimer = 0;
    let languageSheetDragStartY = null;
    let languageSheetDragOffsetY = 0;
    let cardLanguageChangedDuringHydration = false;
    heading(cardLanguageSelectLabel, cardLanguageLabelCopy[userLocale] || cardLanguageLabelCopy.en, userLocale);
    heading(cardLanguageSheetTitle, selectLanguageCopy[userLocale] || selectLanguageCopy.en, userLocale);
    cardLanguageSheetBackdrop.setAttribute("aria-label", strings.close);
    cardLanguageSheetClose.setAttribute("aria-label", strings.close);
    function renderLanguageOptions() {
      const languageOptions = languagePickerOrder.map(function (language) {
        return {
          language: language,
          count: state.cards.filter(function (entry) {
            return entry.card && localeCode(entry.card.language) === language;
          }).length,
        };
      }).sort(function (left, right) { return right.count - left.count; });
      cardLanguageOptions.replaceChildren();
      languageOptions.forEach(function (languageOption) {
        const language = languageOption.language;
        const option = document.createElement("button");
        option.type = "button";
        option.className = "language-option";
        option.setAttribute("role", "option");
        option.dataset.language = language;
        const leading = document.createElement("span");
        leading.className = "language-option-leading";
        const outline = document.createElement("span");
        outline.className = "language-option-outline";
        const outlineFlag = document.createElement("span");
        outlineFlag.className = "language-option-flag";
        outlineFlag.setAttribute("aria-hidden", "true");
        renderLanguageFlag(outlineFlag, language);
        outline.appendChild(outlineFlag);
        const flag = document.createElement("span");
        flag.className = "language-option-flag";
        flag.setAttribute("aria-hidden", "true");
        renderLanguageFlag(flag, language);
        leading.append(outline, flag);
        const name = document.createElement("span");
        name.className = "language-option-name";
        name.textContent = languageNativeName[language] || language;
        option.append(leading, name);
        option.addEventListener("click", function () { selectCardLanguage(language); });
        cardLanguageOptions.appendChild(option);
      });
    }
    renderLanguageOptions();
    renderLanguagePicker();
    element("note-input").dir = state.learningLanguage === "ar" ? "rtl" : "auto";
    text(element("status-label"), strings.status);
    heading(element("offline-title"), strings.title, userLocale);
    text(element("reconnect-label"), strings.reconnect);
    heading(element("deck-title"), strings.deck, userLocale);
    heading(element("notes-title"), strings.notes, userLocale);
    text(element("note-label"), strings.notePlaceholder);
    element("note-input").placeholder = strings.notePlaceholder;
    element("add-note").setAttribute("aria-label", strings.addNote);

    function renderLanguagePicker() {
      heading(cardLanguageCurrent, languageDisplayName(state.learningLanguage, userLocale), userLocale);
      renderLanguageFlag(cardLanguageCurrentFlag, state.learningLanguage);
      renderLanguageFlag(cardLanguageSheetVisual, state.learningLanguage);
      cardLanguageOptions.querySelectorAll(".language-option").forEach(function (option) {
        option.setAttribute("aria-selected", option.dataset.language === state.learningLanguage ? "true" : "false");
      });
      cardLanguageSelect.setAttribute("aria-label", (cardLanguageLabelCopy[userLocale] || cardLanguageLabelCopy.en) + ": " + cardLanguageCurrent.textContent);
    }

    function closeLanguagePicker(restoreFocus) {
      window.clearTimeout(languageSheetCloseTimer);
      cardLanguageSheet.dataset.open = "false";
      cardLanguageSheet.dataset.closing = "true";
      cardLanguageSheet.setAttribute("aria-hidden", "true");
      cardLanguageSheet.setAttribute("inert", "");
      document.body.classList.remove("language-sheet-open");
      cardLanguageSelect.setAttribute("aria-expanded", "false");
      cardLanguageSheetPanel.removeAttribute("data-dragging");
      cardLanguageSheetPanel.style.removeProperty("transform");
      languageSheetCloseTimer = window.setTimeout(function () {
        cardLanguageSheet.dataset.closing = "false";
      }, 360);
      if (restoreFocus) window.setTimeout(function () { cardLanguageSelect.focus(); }, 0);
    }

    function openLanguagePicker() {
      window.clearTimeout(languageSheetCloseTimer);
      cardLanguageSheet.dataset.closing = "false";
      cardLanguageSheet.setAttribute("aria-hidden", "false");
      cardLanguageSheet.removeAttribute("inert");
      document.body.classList.add("language-sheet-open");
      cardLanguageSelect.setAttribute("aria-expanded", "true");
      cardLanguageSheetPanel.style.removeProperty("transform");
      window.requestAnimationFrame(function () { cardLanguageSheet.dataset.open = "true"; });
      window.setTimeout(function () {
        const selected = cardLanguageOptions.querySelector('[data-language="' + state.learningLanguage + '"]');
        if (selected) selected.focus();
      }, 80);
    }

    function selectCardLanguage(language) {
      const selectedLanguage = localeCode(language);
      if (!selectedLanguage) return;
      cardLanguageChangedDuringHydration = true;
      state.learningLanguage = selectedLanguage;
      try { localStorage.setItem(CARD_LANGUAGE_KEY, selectedLanguage); } catch {}
      document.body.dataset.offlineCardLanguage = selectedLanguage;
      element("note-input").dir = selectedLanguage === "ar" ? "rtl" : "auto";
      renderLanguagePicker();
      closeLanguagePicker(true);
      renderCards();
      renderNotes();
    }

    cardLanguageSelect.addEventListener("click", function () {
      if (cardLanguageSheet.dataset.open === "true") closeLanguagePicker(true);
      else openLanguagePicker();
    });
    cardLanguageSelect.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (cardLanguageSheet.dataset.open !== "true") cardLanguageSelect.click();
      }
    });
    cardLanguageOptions.addEventListener("keydown", function (event) {
      const options = Array.from(cardLanguageOptions.querySelectorAll(".language-option"));
      const currentIndex = options.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, currentIndex + 1);
      else if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = options.length - 1;
      else if (event.key === "Escape") { event.preventDefault(); closeLanguagePicker(true); return; }
      else return;
      event.preventDefault();
      if (options[nextIndex]) options[nextIndex].focus();
    });
    cardLanguageSheetBackdrop.addEventListener("click", function () { closeLanguagePicker(true); });
    cardLanguageSheetClose.addEventListener("click", function () { closeLanguagePicker(true); });
    cardLanguageSheetDragHandle.addEventListener("pointerdown", function (event) {
      if (cardLanguageSheet.dataset.open !== "true") return;
      languageSheetDragStartY = event.clientY;
      languageSheetDragOffsetY = 0;
      cardLanguageSheetPanel.setAttribute("data-dragging", "true");
      cardLanguageSheetDragHandle.setPointerCapture(event.pointerId);
    });
    cardLanguageSheetDragHandle.addEventListener("pointermove", function (event) {
      if (languageSheetDragStartY === null) return;
      languageSheetDragOffsetY = Math.max(0, event.clientY - languageSheetDragStartY);
      cardLanguageSheetPanel.style.transform = "translateY(" + languageSheetDragOffsetY + "px)";
    });
    function finishLanguageSheetDrag() {
      if (languageSheetDragStartY === null) return;
      const shouldClose = languageSheetDragOffsetY > 110;
      languageSheetDragStartY = null;
      languageSheetDragOffsetY = 0;
      cardLanguageSheetPanel.removeAttribute("data-dragging");
      if (shouldClose) {
        closeLanguagePicker(true);
      } else {
        cardLanguageSheetPanel.style.removeProperty("transform");
      }
    }
    cardLanguageSheetDragHandle.addEventListener("pointerup", finishLanguageSheetDrag);
    cardLanguageSheetDragHandle.addEventListener("pointercancel", finishLanguageSheetDrag);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && cardLanguageSheet.dataset.open === "true") {
        event.preventDefault();
        closeLanguagePicker(true);
      }
    });

    function cardsForSelectedLanguage() {
      return state.cards.filter(function (entry) {
        return entry.card && localeCode(entry.card.language) === state.learningLanguage;
      });
    }

    function renderCardFilter() {
      const entries = cardsForSelectedLanguage();
      const counts = { active: 0, learned: 0 };
      entries.forEach(function (entry) {
        counts[entry.inventory && entry.inventory.status === "learned" ? "learned" : "active"] += 1;
      });
      const filterCopy = savedCardFilterCopy[userLocale] || savedCardFilterCopy.en;
      const filterRow = element("saved-card-filter-row");
      if (filterRow) filterRow.setAttribute("aria-label", filterCopy.label);
      cardFilterButtons.forEach(function (button) {
        const filter = button.dataset.cardFilter === "learned" ? "learned" : "active";
        const selected = state.cardFilter === filter;
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.setAttribute("aria-label", filterCopy[filter]);
        text(element("saved-card-filter-" + filter + "-label"), filterCopy[filter]);
        text(element("saved-card-filter-" + filter + "-count"), String(counts[filter]));
      });
    }

    let offlineExampleFitCleanup = null;
    function renderCards() {
      if (offlineExampleFitCleanup) {
        offlineExampleFitCleanup();
        offlineExampleFitCleanup = null;
      }
      const root = element("saved-cards");
      const allEntries = cardsForSelectedLanguage();
      renderCardFilter();
      const entries = allEntries.filter(function (entry) {
        return state.cardFilter === "learned"
          ? entry.inventory && entry.inventory.status === "learned"
          : !entry.inventory || entry.inventory.status !== "learned";
      });
      if (!entries.length) {
        root.replaceChildren();
        const empty = document.createElement("p"); empty.className = "empty";
        const filterCopy = savedCardFilterCopy[userLocale] || savedCardFilterCopy.en;
        empty.textContent = allEntries.length
          ? (state.cardFilter === "learned" ? filterCopy.emptyLearned : filterCopy.emptyActive)
          : (state.cards.length ? (noCardsInLanguageCopy[userLocale] || noCardsInLanguageCopy.en) : strings.noCards);
        root.appendChild(empty); return;
      }
      const offlineRenderer = window.FoxiesDeckOfflineCardRenderer;
      if (!offlineRenderer) {
        root.replaceChildren();
        console.error("[FoxiesDeck offline] Bundled vocabulary-card renderer is missing.");
        return;
      }
      root.innerHTML = offlineRenderer.render(entries, userLocale, { active: strings.active, learned: strings.learned });
      offlineExampleFitCleanup = offlineRenderer.fitExamples(root);
      fitOfflineCardText(root);
    }

    let offlineCardTextObserver = null;
    function fitOfflineCardText(root) {
      if (offlineCardTextObserver) offlineCardTextObserver.disconnect();
      const fit = function (container) {
        const textNode = container.querySelector("[data-single-line-fit-content]");
        if (!textNode) return;
        const availableWidth = container.clientWidth;
        const textWidth = textNode.scrollWidth;
        const safeWidth = availableWidth * 0.96;
        const scale = safeWidth > 0 && textWidth > safeWidth ? safeWidth / textWidth : 1;
        const centered = container.hasAttribute("data-single-line-fit-centered") ? "translateX(-50%) " : "";
        textNode.style.transform = centered + "scale(" + scale + ")";
      };
      const containers = Array.from(root.querySelectorAll("[data-single-line-fit-container]"));
      containers.forEach(fit);
      if (typeof ResizeObserver !== "undefined") {
        offlineCardTextObserver = new ResizeObserver(function (observations) {
          observations.forEach(function (observation) { fit(observation.target); });
        });
        containers.forEach(function (container) { offlineCardTextObserver.observe(container); });
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          containers.forEach(function (container) { if (container.isConnected) fit(container); });
        });
      }
    }

    element("saved-cards").addEventListener("click", function (event) {
      const target = event.target;
      const speakButton = target && target.closest ? target.closest("[data-card-speak]") : null;
      if (!speakButton) return;
      const cardElement = speakButton.closest("[data-card-language]");
      const termElement = speakButton.closest(".fd-card-design")?.querySelector("[data-testid='card-term']");
      const term = termElement && termElement.textContent ? termElement.textContent.trim() : "";
      if (!term || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
      const language = cardElement && cardElement.dataset.cardLanguage ? cardElement.dataset.cardLanguage : userLocale;
      const utterance = new SpeechSynthesisUtterance(term);
      utterance.lang = language;
      utterance.onstart = function () { emitOfflineSpeechStatus(term, language, "start"); };
      utterance.onend = function () { emitOfflineSpeechStatus(term, language, "end"); };
      utterance.onerror = function () { emitOfflineSpeechStatus(term, language, "end"); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

    window.addEventListener("foxiesdeck:speech-status", function (event) {
      const detail = event && event.detail;
      if (!detail || !detail.text || !detail.language) return;
      document.querySelectorAll(".fd-card-design").forEach(function (card) {
        const term = card.querySelector("[data-testid='card-term']");
        if (!term || term.textContent.trim() !== detail.text || term.lang !== detail.language) return;
        const pronunciation = card.querySelector("[data-testid='card-pronunciation']");
        if (pronunciation) pronunciation.classList.toggle("fd-card-design__pronunciation--speaking", detail.state === "start");
      });
    });

    cardFilterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const filter = button.dataset.cardFilter === "learned" ? "learned" : "active";
        if (state.cardFilter === filter) return;
        state.cardFilter = filter;
        renderCards();
      });
    });

    function notesForSelectedLanguage() {
      return state.notes.filter(function (note) {
        return localeCode(note.targetLanguage) === state.learningLanguage;
      });
    }

    function allNotes() { return state.notes; }
    function draftsForSelectedLanguage() {
      return state.drafts.filter(function (draft) {
        return localeCode(draft.targetLanguage || (draft.generated && draft.generated.language)) === state.learningLanguage;
      });
    }
    function allDrafts() { return state.drafts; }

    function storageProfileForNote(note) { return note.storageProfileId || profileId; }
    function isSameNote(left, right) {
      return left.id === right.id && storageProfileForNote(left) === storageProfileForNote(right);
    }
    function renderNotes() {
      const root = element("notes-list"); root.replaceChildren();
      const notes = notesForSelectedLanguage();
      if (notes.length) {
        notes.forEach(function (note) {
          const row = document.createElement("div"); row.className = "note-row";
          row.dataset.targetLanguage = note.targetLanguage;
          const content = document.createElement("div"); content.className = "note-content";
          const language = document.createElement("span"); language.className = "note-language"; language.textContent = languageDisplayName(note.targetLanguage, userLocale);
          const noteText = document.createElement("span"); noteText.className = "note-text"; noteText.textContent = note.text;
          content.append(language, noteText);
          const remove = document.createElement("button"); remove.className = "remove-note"; remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", strings.close);
          remove.addEventListener("click", async function () {
            if (!testMode) {
              try { await storageApi.removeNote(storageProfileForNote(note), note.id); }
              catch { showAppMessage(saveErrorCopy[userLocale] || saveErrorCopy.en, "error"); return; }
            }
            state.notes = state.notes.filter(function (item) { return !isSameNote(item, note); });
            renderNotes();
          });
          row.append(content, remove); root.appendChild(row);
        });
      }
    }

    function openModal() { closeLanguagePicker(false); state.dismissed = false; element("notes-modal").classList.add("open"); element("close-modal").focus(); }
    function closeModal() { state.dismissed = true; element("notes-modal").classList.remove("open"); }

    function renderModal() {
      const notesRoot = element("modal-notes"); const resultRoot = element("generated-results");
      const notes = testMode ? notesForSelectedLanguage() : allNotes();
      const drafts = testMode ? draftsForSelectedLanguage() : allDrafts();
      notesRoot.replaceChildren(); resultRoot.replaceChildren();
      element("notes-modal").dataset.conversionState = state.conversionState;
      notes.forEach(function (note) {
        const node = document.createElement("div"); node.className = "modal-note"; node.dataset.targetLanguage = note.targetLanguage;
        node.textContent = languageDisplayName(note.targetLanguage, userLocale) + " · " + note.text;
        notesRoot.appendChild(node);
      });
      drafts.forEach(function (draft) {
        const data = draft.generated || {};
        const item = document.createElement("article"); item.className = "generated";
        item.dataset.cardLanguage = data.language || draft.targetLanguage || "";
        const language = document.createElement("div"); language.className = "generated-language";
        language.textContent = languageDisplayName(data.language || draft.targetLanguage, userLocale);
        const term = document.createElement("div"); term.className = "term"; term.textContent = data.term || "";
        const translation = document.createElement("div"); translation.className = "translation"; translation.textContent = data.translations && (data.translations[userLocale] || data.translations.en) || "";
        const definition = document.createElement("div"); definition.className = "definition"; definition.textContent = data.definitions && (data.definitions[userLocale] || data.definitions.en) || "";
        const add = document.createElement("button"); add.type = "button"; add.className = "primary"; add.textContent = strings.addDeck;
        add.addEventListener("click", async function () {
          if (testMode) { add.textContent = strings.added; add.disabled = true; return; }
          add.disabled = true; add.textContent = strings.adding; text(element("modal-feedback"), "");
          try {
            const response = await fetch("/api/cards/offline-create", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
            const payload = await response.json().catch(function () { return {}; });
            if (!response.ok || payload.status !== "success") throw new Error(payload.message || payload.errorCode || strings.addError);
            if (payload.data && payload.data.card && payload.data.card.cardId) add.dataset.cardId = payload.data.card.cardId;
            const draftProfileId = draft.storageProfileId || profileId;
            await storageApi.removeDraft(draftProfileId, draft.id);
            state.drafts = state.drafts.filter(function (entry) { return !(entry.id === draft.id && (entry.storageProfileId || profileId) === draftProfileId); });
            add.textContent = strings.added;
            renderModal(); renderNotes();
          } catch (error) { add.disabled = false; add.textContent = strings.addDeck; text(element("modal-feedback"), error && error.message || strings.addError); }
        });
        item.append(language, term, translation, definition, add); resultRoot.appendChild(item);
      });
      const actions = element("modal-actions");
      actions.style.display = notes.length ? "flex" : "none";
      const convertButton = element("convert-all");
      convertButton.disabled = state.conversionState === "processing";
      convertButton.textContent = state.conversionState === "processing" ? strings.converting : strings.convert;
      if (!notes.length && !drafts.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = strings.emptyModal; resultRoot.appendChild(empty); }
    }

    let activeProbe = null;
    async function probeSite() {
      if (testMode) return true;
      if (!navigator.onLine) return false;
      if (activeProbe) return activeProbe;
      const controller = new AbortController();
      const timeout = window.setTimeout(function () { controller.abort(); }, 5000);
      activeProbe = (async function () {
        try {
          const response = await fetch("/api/offline/reachability", { method: "GET", cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache" }, signal: controller.signal });
          return response.ok;
        } catch { return false; }
        finally { window.clearTimeout(timeout); activeProbe = null; }
      })();
      return activeProbe;
    }

    function returnToAppAfterReconnect() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: "foxiesdeck:offline-reconnected" }, window.location.origin);
        return;
      }

      let destination = new URLSearchParams(location.search).get("returnTo") || "/";
      try {
        const parsed = new URL(destination, location.origin);
        if (parsed.origin !== location.origin) destination = "/";
        else {
          parsed.searchParams.set("twa", "1");
          parsed.searchParams.set("native", "1");
          destination = parsed.toString();
        }
      } catch {
        destination = "/?twa=1&native=1";
      }
      location.replace(destination);
    }

    element("note-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const input = element("note-input"); const value = input.value.trim().slice(0, 120);
      if (!value) return;
      const note = { id: makeId(), text: value, targetLanguage: state.learningLanguage, nativeLocale: state.locale, storageProfileId: profileId, createdAt: new Date().toISOString() };
      if (!testMode) {
        try { await storageApi.putNote(profileId, note); }
        catch { showAppMessage(saveErrorCopy[userLocale] || saveErrorCopy.en, "error"); return; }
      }
      state.notes.unshift(note); input.value = ""; renderNotes();
    });

    element("reconnect").addEventListener("click", async function () {
      const button = element("reconnect"); button.disabled = true;
      text(element("reconnect-label"), strings.reconnecting);
      let leavingOfflineScreen = false;
      try {
        const connected = await probeSite();
        if (testMode) {
          showAppMessage(strings.testReconnect, "error");
        } else if (!connected) {
          showAppMessage(strings.noConnection, "error");
        } else {
          leavingOfflineScreen = true;
          returnToAppAfterReconnect();
        }
      } catch {
        showAppMessage(strings.noConnection, "error");
      } finally {
        if (!leavingOfflineScreen) {
          button.disabled = false;
          text(element("reconnect-label"), strings.reconnect);
        }
      }
    });

    renderCards(); renderNotes();
    document.body.dataset.offlineShellReady = "true";
    document.body.dataset.offlineShellData = "loading";

    async function hydrateLocalData() {
      if (testMode) {
        document.body.dataset.offlineShellData = "ready";
        return;
      }

      const offlineProfileIds = profileId === "guest" ? ["guest"] : [profileId, "guest"];
      const [cached, draftGroups, noteGroups] = await Promise.all([
        storageApi.getSnapshot(profileId).catch(function () { return null; }),
        Promise.all(offlineProfileIds.map(function (storedProfileId) {
          return storageApi.listDrafts(storedProfileId).catch(function () { return []; });
        })),
        Promise.all(offlineProfileIds.map(function (storedProfileId) {
          return storageApi.listNotes(storedProfileId).catch(function () { return []; });
        })),
      ]);

      state.profile = cached && cached.profile || null;
      state.cards = cached && cached.cards || [];

      const savedCardLanguage = localeCode(state.profile && (state.profile.cardLanguage || state.profile.learningLanguage));
      if (!cardLanguageChangedDuringHydration && !safeLocalStorageGet(CARD_LANGUAGE_KEY) && savedCardLanguage) {
        state.learningLanguage = savedCardLanguage;
      }
      document.body.dataset.offlineCardLanguage = state.learningLanguage;
      element("note-input").dir = state.learningLanguage === "ar" ? "rtl" : "auto";

      const loadedDrafts = draftGroups.flat().map(function (entry) {
        const draft = entry.draft || {};
        return Object.assign({}, draft, { storageProfileId: entry.profileId || profileId });
      });
      const draftsById = new Map();
      [...loadedDrafts, ...state.drafts].forEach(function (draft) {
        if (draft.id) draftsById.set((draft.storageProfileId || profileId) + ":" + draft.id, draft);
      });
      state.drafts = Array.from(draftsById.values());

      const loadedNotes = noteGroups.flat().map(function (entry) {
        const note = entry.note || {};
        return Object.assign({}, note, {
          storageProfileId: entry.profileId || profileId,
          targetLanguage: localeCode(note.targetLanguage) || state.learningLanguage,
          nativeLocale: localeCode(note.nativeLocale) || state.locale,
        });
      });
      const notesById = new Map();
      [...loadedNotes, ...state.notes].forEach(function (note) {
        if (note.id) notesById.set((note.storageProfileId || profileId) + ":" + note.id, note);
      });
      state.notes = Array.from(notesById.values());

      renderLanguageOptions();
      renderLanguagePicker();
      renderCards();
      renderNotes();
      document.body.dataset.offlineShellData = "ready";
    }

    void hydrateLocalData().catch(function (error) {
      document.body.dataset.offlineShellData = "error";
      console.warn("[FoxiesDeck offline] Local data could not be hydrated; offline controls remain available.", error);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { void boot(); }, { once: true });
  else void boot();
})();
