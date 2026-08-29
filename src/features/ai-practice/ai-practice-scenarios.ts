import type { LanguageCode, LocaleCode } from "@/types/domain";

export type AiPracticeMode = "character" | "scenario";

export type AiPracticeScenarioId =
  | "restaurant-order"
  | "hotel-check-in"
  | "shopping-help"
  | "job-interview"
  | "doctor-visit"
  | "asking-directions"
  | "apartment-viewing"
  | "pharmacy-help"
  | "party-introduction"
  | "airport-check-in";

export interface AiPracticeScenario {
  id: AiPracticeScenarioId;
  characterId: string;
  titleByLocale: Partial<Record<LocaleCode, string>>;
  summaryByLocale: Partial<Record<LocaleCode, string>>;
  openingLinesByLanguage: Partial<Record<LanguageCode, string>>;
  roleplayInstructions: string;
}

const SCENARIO_DATA: readonly AiPracticeScenario[] = [
  {
    id: "restaurant-order",
    characterId: "friendly-worker",
    titleByLocale: {
      en: "Order at a restaurant",
      tr: "Restoranda sipariş ver",
      de: "Im Restaurant bestellen",
      fr: "Commander au restaurant",
      es: "Pedir en un restaurante",
      it: "Ordinare al ristorante",
      pt: "Pedir em um restaurante",
      nl: "Bestellen in een restaurant",
      pl: "Zamówienie w restauracji",
    },
    summaryByLocale: {
      en: "Choose a meal, ask about ingredients, and pay the bill.",
      tr: "Yemek seç, içerikleri sor ve hesabı öde.",
      de: "Wähle ein Essen, frage nach Zutaten und bezahle die Rechnung.",
      fr: "Choisis un plat, demande les ingrédients et paie l'addition.",
      es: "Elige un plato, pregunta por los ingredientes y paga la cuenta.",
      it: "Scegli un piatto, chiedi gli ingredienti e paga il conto.",
      pt: "Escolha um prato, pergunte pelos ingredientes e pague a conta.",
      nl: "Kies een maaltijd, vraag naar ingrediënten en betaal de rekening.",
      pl: "Wybierz danie, zapytaj o składniki i zapłać rachunek.",
    },
    openingLinesByLanguage: {
      en: "Hi there! Welcome in. Are you ready to order?",
      tr: "Merhaba! Hoş geldiniz. Sipariş vermeye hazır mısınız?",
      de: "Hallo! Willkommen. Möchten Sie bestellen?",
      fr: "Bonjour ! Bienvenue. Êtes-vous prêt à commander ?",
      es: "¡Hola! Bienvenido. ¿Está listo para pedir?",
      it: "Ciao! Benvenuto. È pronto per ordinare?",
      pt: "Olá! Bem-vindo. Está pronto para pedir?",
      nl: "Hallo! Welkom. Bent u klaar om te bestellen?",
      pl: "Dzień dobry! Czy jest Pan/Pani gotowy/a do zamówienia?",
    },
    roleplayInstructions:
      "Role-play a friendly restaurant server. Help the learner order a meal, answer practical questions about ingredients and options, take the order, and handle the bill naturally.",
  },
  {
    id: "hotel-check-in",
    characterId: "gentle-companion",
    titleByLocale: {
      en: "Check in at a hotel",
      tr: "Otele giriş yap",
      de: "Im Hotel einchecken",
      fr: "S'enregistrer à l'hôtel",
      es: "Registrarse en un hotel",
      it: "Fare il check-in in hotel",
      pt: "Fazer check-in no hotel",
      nl: "Inchecken bij een hotel",
      pl: "Zameldowanie w hotelu",
    },
    summaryByLocale: {
      en: "Give your details, ask about the room, and learn the hotel rules.",
      tr: "Bilgilerini ver, odanı sor ve otel kurallarını öğren.",
      de: "Gib deine Daten an, frage nach dem Zimmer und lerne die Hotelregeln kennen.",
      fr: "Donne tes informations, demande ta chambre et découvre les règles de l'hôtel.",
      es: "Da tus datos, pregunta por la habitación y conoce las reglas del hotel.",
      it: "Fornisci i tuoi dati, chiedi della camera e scopri le regole dell'hotel.",
      pt: "Dê seus dados, pergunte sobre o quarto e conheça as regras do hotel.",
      nl: "Geef je gegevens, vraag naar de kamer en leer de hotelregels kennen.",
      pl: "Podaj swoje dane, zapytaj o pokój i poznaj zasady hotelu.",
    },
    openingLinesByLanguage: {
      en: "Good evening! Welcome to the hotel. May I see your name or reservation?",
      tr: "İyi akşamlar! Otelimize hoş geldiniz. Adınızı veya rezervasyonunuzu alabilir miyim?",
      de: "Guten Abend! Willkommen im Hotel. Darf ich Ihren Namen oder Ihre Reservierung sehen?",
      fr: "Bonsoir ! Bienvenue à l'hôtel. Puis-je avoir votre nom ou votre réservation ?",
      es: "¡Buenas tardes! Bienvenido al hotel. ¿Puedo ver su nombre o su reserva?",
      it: "Buonasera! Benvenuto in hotel. Posso avere il suo nome o la prenotazione?",
      pt: "Boa noite! Bem-vindo ao hotel. Posso ver seu nome ou sua reserva?",
      nl: "Goedenavond! Welkom in het hotel. Mag ik uw naam of reservering zien?",
      pl: "Dobry wieczór! Witamy w hotelu. Czy mogę prosić o nazwisko lub rezerwację?",
    },
    roleplayInstructions:
      "Role-play a calm hotel receptionist. Check the learner in, ask for the necessary details, explain room facilities and simple hotel rules, and respond to reasonable requests.",
  },
  {
    id: "shopping-help",
    characterId: "campus-friend",
    titleByLocale: {
      en: "Get help while shopping",
      tr: "Alışverişte yardım iste",
      de: "Beim Einkaufen Hilfe bekommen",
      fr: "Demander de l'aide en magasin",
      es: "Pedir ayuda al comprar",
      it: "Chiedere aiuto mentre fai shopping",
      pt: "Pedir ajuda durante as compras",
      nl: "Hulp vragen tijdens het winkelen",
      pl: "Poprosić o pomoc podczas zakupów",
    },
    summaryByLocale: {
      en: "Find a size, compare products, and decide what to buy.",
      tr: "Beden bul, ürünleri karşılaştır ve ne alacağına karar ver.",
      de: "Finde eine Größe, vergleiche Produkte und entscheide, was du kaufst.",
      fr: "Trouve une taille, compare les produits et décide quoi acheter.",
      es: "Encuentra una talla, compara productos y decide qué comprar.",
      it: "Trova una taglia, confronta i prodotti e decidi cosa comprare.",
      pt: "Encontre um tamanho, compare produtos e decida o que comprar.",
      nl: "Vind een maat, vergelijk producten en beslis wat je koopt.",
      pl: "Znajdź rozmiar, porównaj produkty i zdecyduj, co kupić.",
    },
    openingLinesByLanguage: {
      en: "Hey! I work here. What are you looking for today?",
      tr: "Merhaba! Burada çalışıyorum. Bugün ne arıyorsunuz?",
      de: "Hallo! Ich arbeite hier. Was suchen Sie heute?",
      fr: "Bonjour ! Je travaille ici. Que cherchez-vous aujourd'hui ?",
      es: "¡Hola! Trabajo aquí. ¿Qué busca hoy?",
      it: "Ciao! Lavoro qui. Che cosa cerca oggi?",
      pt: "Olá! Eu trabalho aqui. O que você procura hoje?",
      nl: "Hallo! Ik werk hier. Waar bent u vandaag naar op zoek?",
      pl: "Cześć! Pracuję tutaj. Czego szukasz dzisiaj?",
    },
    roleplayInstructions:
      "Role-play a helpful store assistant. Ask what the learner is looking for, help with sizes, colors, prices, alternatives, and checkout without turning the conversation into a lecture.",
  },
  {
    id: "job-interview",
    characterId: "wise-elder",
    titleByLocale: {
      en: "Go to a job interview",
      tr: "İş görüşmesine katıl",
      de: "Zu einem Vorstellungsgespräch gehen",
      fr: "Passer un entretien d'embauche",
      es: "Hacer una entrevista de trabajo",
      it: "Fare un colloquio di lavoro",
      pt: "Fazer uma entrevista de emprego",
      nl: "Een sollicitatiegesprek voeren",
      pl: "Pójść na rozmowę kwalifikacyjną",
    },
    summaryByLocale: {
      en: "Introduce yourself, describe your experience, and ask smart questions.",
      tr: "Kendini tanıt, deneyimini anlat ve iyi sorular sor.",
      de: "Stelle dich vor, beschreibe deine Erfahrung und stelle gute Fragen.",
      fr: "Présente-toi, décris ton expérience et pose de bonnes questions.",
      es: "Preséntate, describe tu experiencia y haz buenas preguntas.",
      it: "Presentati, descrivi la tua esperienza e fai buone domande.",
      pt: "Apresente-se, descreva sua experiência e faça boas perguntas.",
      nl: "Stel jezelf voor, beschrijf je ervaring en stel goede vragen.",
      pl: "Przedstaw się, opisz swoje doświadczenie i zadaj dobre pytania.",
    },
    openingLinesByLanguage: {
      en: "Good morning. Please have a seat. Could you tell me a little about yourself?",
      tr: "Günaydın. Lütfen oturun. Bize biraz kendinizden bahseder misiniz?",
      de: "Guten Morgen. Bitte nehmen Sie Platz. Erzählen Sie mir bitte etwas über sich.",
      fr: "Bonjour. Asseyez-vous, je vous en prie. Pouvez-vous me parler un peu de vous ?",
      es: "Buenos días. Tome asiento, por favor. ¿Puede contarme algo sobre usted?",
      it: "Buongiorno. Si accomodi. Può parlarmi un po' di sé?",
      pt: "Bom dia. Sente-se, por favor. Pode falar um pouco sobre você?",
      nl: "Goedemorgen. Gaat u zitten. Kunt u iets over uzelf vertellen?",
      pl: "Dzień dobry. Proszę usiąść. Czy może Pan/Pani opowiedzieć coś o sobie?",
    },
    roleplayInstructions:
      "Role-play a thoughtful but realistic job interviewer. Ask one interview question at a time, follow up on the learner's experience, and leave room for the learner to ask questions.",
  },
  {
    id: "doctor-visit",
    characterId: "warm-grandmother",
    titleByLocale: {
      en: "Talk to a doctor",
      tr: "Doktorla konuş",
      de: "Mit einem Arzt sprechen",
      fr: "Parler à un médecin",
      es: "Hablar con un médico",
      it: "Parlare con un medico",
      pt: "Falar com um médico",
      nl: "Met een arts praten",
      pl: "Rozmowa z lekarzem",
    },
    summaryByLocale: {
      en: "Describe a simple symptom, answer questions, and understand basic advice.",
      tr: "Basit bir belirtiyi anlat, soruları yanıtla ve temel tavsiyeleri anla.",
      de: "Beschreibe ein einfaches Symptom, beantworte Fragen und verstehe grundlegende Ratschläge.",
      fr: "Décris un symptôme simple, réponds aux questions et comprends les conseils de base.",
      es: "Describe un síntoma sencillo, responde preguntas y entiende consejos básicos.",
      it: "Descrivi un sintomo semplice, rispondi alle domande e capisci i consigli di base.",
      pt: "Descreva um sintoma simples, responda às perguntas e entenda conselhos básicos.",
      nl: "Beschrijf een eenvoudig symptoom, beantwoord vragen en begrijp basisadvies.",
      pl: "Opisz prosty objaw, odpowiedz na pytania i zrozum podstawowe zalecenia.",
    },
    openingLinesByLanguage: {
      en: "Hello. What brings you in today?",
      tr: "Merhaba. Bugün sizi buraya getiren şikayet nedir?",
      de: "Guten Tag. Was führt Sie heute zu mir?",
      fr: "Bonjour. Qu'est-ce qui vous amène aujourd'hui ?",
      es: "Hola. ¿Qué le trae hoy por aquí?",
      it: "Buongiorno. Che cosa la porta qui oggi?",
      pt: "Olá. O que traz você aqui hoje?",
      nl: "Goedendag. Waar komt u vandaag voor?",
      pl: "Dzień dobry. Co Pana/Panią dziś sprowadza?",
    },
    roleplayInstructions:
      "Role-play a kind doctor for a low-stakes language exercise. Ask about one simple symptom at a time, give only general non-diagnostic advice, and recommend professional care for serious or urgent symptoms.",
  },
  {
    id: "asking-directions",
    characterId: "gothic-calm",
    titleByLocale: {
      en: "Ask for directions",
      tr: "Yol tarifi iste",
      de: "Nach dem Weg fragen",
      fr: "Demander son chemin",
      es: "Pedir indicaciones",
      it: "Chiedere indicazioni",
      pt: "Pedir informações",
      nl: "De weg vragen",
      pl: "Zapytać o drogę",
    },
    summaryByLocale: {
      en: "Find a place, understand directions, and confirm the route.",
      tr: "Bir yer bul, tarifi anla ve rotayı doğrula.",
      de: "Finde einen Ort, verstehe die Wegbeschreibung und bestätige die Route.",
      fr: "Trouve un endroit, comprends l'itinéraire et confirme le chemin.",
      es: "Encuentra un lugar, entiende las indicaciones y confirma la ruta.",
      it: "Trova un posto, capisci le indicazioni e conferma il percorso.",
      pt: "Encontre um lugar, entenda as instruções e confirme a rota.",
      nl: "Vind een plek, begrijp de route en bevestig de weg.",
      pl: "Znajdź miejsce, zrozum wskazówki i potwierdź trasę.",
    },
    openingLinesByLanguage: {
      en: "You look a little lost. Where are you trying to go?",
      tr: "Biraz kaybolmuş gibisiniz. Nereye gitmeye çalışıyorsunuz?",
      de: "Sie sehen ein wenig verloren aus. Wohin möchten Sie?",
      fr: "Vous avez l'air un peu perdu. Où cherchez-vous à aller ?",
      es: "Parece un poco perdido. ¿Adónde quiere ir?",
      it: "Sembra un po' perso. Dove deve andare?",
      pt: "Você parece um pouco perdido. Para onde quer ir?",
      nl: "U lijkt een beetje verdwaald. Waar wilt u naartoe?",
      pl: "Wygląda Pan/Pani na trochę zagubionego. Dokąd chce Pan/Pani iść?",
    },
    roleplayInstructions:
      "Role-play a local who is giving directions. Ask where the learner wants to go, explain landmarks and turns in manageable steps, and ask them to confirm what they understood.",
  },
  {
    id: "apartment-viewing",
    characterId: "wise-elder",
    titleByLocale: {
      en: "View and rent an apartment",
      tr: "Ev kirala ve evi gör",
      de: "Eine Wohnung besichtigen und mieten",
      fr: "Visiter et louer un appartement",
      es: "Visitar y alquilar un apartamento",
      it: "Visitare e affittare un appartamento",
      pt: "Visitar e alugar um apartamento",
      nl: "Een appartement bekijken en huren",
      pl: "Obejrzeć i wynająć mieszkanie",
    },
    summaryByLocale: {
      en: "Ask about rooms, rent, rules, and move-in details.",
      tr: "Odaları, kirayı, kuralları ve taşınma detaylarını sor.",
      de: "Frage nach Zimmern, Miete, Regeln und dem Einzug.",
      fr: "Demande des informations sur les pièces, le loyer et l'entrée.",
      es: "Pregunta por las habitaciones, el alquiler y la mudanza.",
      it: "Chiedi delle stanze, dell'affitto e del trasloco.",
      pt: "Pergunte sobre os cômodos, o aluguel e a mudança.",
      nl: "Vraag naar kamers, huur, regels en de verhuisdatum.",
      pl: "Zapytaj o pokoje, czynsz, zasady i termin wprowadzenia.",
    },
    openingLinesByLanguage: {
      en: "Welcome! Let me show you around. What would you like to know about the apartment?",
      tr: "Hoş geldiniz! Size evi göstereyim. Daire hakkında ne öğrenmek istersiniz?",
      de: "Willkommen! Ich zeige Ihnen die Wohnung. Was möchten Sie darüber wissen?",
      fr: "Bienvenue ! Je vais vous faire visiter. Que voulez-vous savoir sur l'appartement ?",
      es: "¡Bienvenido! Le enseñaré el apartamento. ¿Qué le gustaría saber?",
      it: "Benvenuto! Le mostro l'appartamento. Che cosa vorrebbe sapere?",
      pt: "Bem-vindo! Vou mostrar o apartamento. O que gostaria de saber?",
      nl: "Welkom! Ik laat u het appartement zien. Wat wilt u weten?",
      pl: "Witamy! Pokażę Panu/Pani mieszkanie. Czego chce Pan/Pani się dowiedzieć?",
    },
    roleplayInstructions:
      "Role-play a real-estate agent showing an apartment. Describe rooms, rent, utilities, rules, the neighborhood, and move-in details. Answer questions directly and let the learner decide whether the apartment suits them.",
  },
  {
    id: "pharmacy-help",
    characterId: "warm-grandmother",
    titleByLocale: {
      en: "Ask for medicine at a pharmacy",
      tr: "Eczaneden ilaç iste",
      de: "In der Apotheke nach Medikamenten fragen",
      fr: "Demander un médicament à la pharmacie",
      es: "Pedir un medicamento en la farmacia",
      it: "Chiedere un farmaco in farmacia",
      pt: "Pedir um medicamento na farmácia",
      nl: "Medicijnen vragen bij de apotheek",
      pl: "Poprosić o lek w aptece",
    },
    summaryByLocale: {
      en: "Describe a simple symptom and ask about safe over-the-counter options.",
      tr: "Basit bir belirtiyi anlat ve reçetesiz seçenekleri sor.",
      de: "Beschreibe ein einfaches Symptom und frage nach rezeptfreien Optionen.",
      fr: "Décris un symptôme simple et demande des options sans ordonnance.",
      es: "Describe un síntoma sencillo y pregunta por opciones sin receta.",
      it: "Descrivi un sintomo semplice e chiedi opzioni senza ricetta.",
      pt: "Descreva um sintoma simples e pergunte por opções sem receita.",
      nl: "Beschrijf een eenvoudig symptoom en vraag naar vrij verkrijgbare opties.",
      pl: "Opisz prosty objaw i zapytaj o leki bez recepty.",
    },
    openingLinesByLanguage: {
      en: "Hello! How can I help you today?",
      tr: "Merhaba! Bugün size nasıl yardımcı olabilirim?",
      de: "Guten Tag! Wie kann ich Ihnen heute helfen?",
      fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
      es: "¡Hola! ¿En qué puedo ayudarle hoy?",
      it: "Buongiorno! Come posso aiutarla oggi?",
      pt: "Olá! Como posso ajudar hoje?",
      nl: "Goedendag! Hoe kan ik u vandaag helpen?",
      pl: "Dzień dobry! Jak mogę dziś pomóc?",
    },
    roleplayInstructions:
      "Role-play a careful pharmacist. Ask about one simple symptom, allergies, age-appropriate context, and current medicines when relevant. Discuss only general over-the-counter guidance, never diagnose, and recommend a doctor or urgent care for serious symptoms.",
  },
  {
    id: "party-introduction",
    characterId: "campus-friend",
    titleByLocale: {
      en: "Meet someone at a party",
      tr: "Partide biriyle tanış",
      de: "Auf einer Party jemanden kennenlernen",
      fr: "Faire connaissance à une fête",
      es: "Conocer a alguien en una fiesta",
      it: "Conoscere qualcuno a una festa",
      pt: "Conhecer alguém em uma festa",
      nl: "Iemand leren kennen op een feestje",
      pl: "Poznać kogoś na przyjęciu",
    },
    summaryByLocale: {
      en: "Introduce yourself, make small talk, and keep a friendly conversation going.",
      tr: "Kendini tanıt, sohbet et ve samimi bir konuşmayı sürdür.",
      de: "Stelle dich vor, führe Smalltalk und halte das Gespräch am Laufen.",
      fr: "Présente-toi, fais la conversation et garde un échange naturel.",
      es: "Preséntate, charla y mantén una conversación amistosa.",
      it: "Presentati, fai conversazione e mantieni uno scambio amichevole.",
      pt: "Apresente-se, converse e mantenha um papo amigável.",
      nl: "Stel jezelf voor, maak een praatje en houd het gesprek gaande.",
      pl: "Przedstaw się, porozmawiaj i podtrzymaj przyjazną rozmowę.",
    },
    openingLinesByLanguage: {
      en: "Hey, I don't think we've met before. How do you know the host?",
      tr: "Merhaba, sanırım daha önce tanışmadık. Ev sahibini nereden tanıyorsunuz?",
      de: "Hallo, ich glaube, wir kennen uns noch nicht. Woher kennen Sie den Gastgeber?",
      fr: "Salut, je crois qu'on ne s'est jamais rencontrés. Comment connais-tu l'hôte ?",
      es: "Hola, creo que no nos conocemos. ¿Cómo conoces al anfitrión?",
      it: "Ciao, credo che non ci siamo mai incontrati. Come conosci il padrone di casa?",
      pt: "Oi, acho que ainda não nos conhecemos. Como você conhece o anfitrião?",
      nl: "Hoi, volgens mij hebben we elkaar nog niet ontmoet. Hoe ken je de gastheer?",
      pl: "Cześć, chyba jeszcze się nie poznaliśmy. Skąd znasz gospodarza?",
    },
    roleplayInstructions:
      "Role-play a friendly guest at a party. Make a natural introduction, ask light questions about the event and shared interests, react to the learner's answers, and keep the conversation relaxed rather than turning it into an interview.",
  },
  {
    id: "airport-check-in",
    characterId: "friendly-worker",
    titleByLocale: {
      en: "Check in and pass security at the airport",
      tr: "Havaalanında check-in ve güvenlik",
      de: "Am Flughafen einchecken und durch die Sicherheitskontrolle gehen",
      fr: "S'enregistrer et passer la sécurité à l'aéroport",
      es: "Facturar y pasar seguridad en el aeropuerto",
      it: "Fare il check-in e passare i controlli in aeroporto",
      pt: "Fazer o check-in e passar pela segurança no aeroporto",
      nl: "Inchecken en door de beveiliging op de luchthaven",
      pl: "Odprawa i kontrola bezpieczeństwa na lotnisku",
    },
    summaryByLocale: {
      en: "Show your documents, check your bag, and understand the security instructions.",
      tr: "Belgelerini göster, bagajını teslim et ve güvenlik talimatlarını anla.",
      de: "Zeige deine Dokumente, gib dein Gepäck auf und verstehe die Sicherheitsanweisungen.",
      fr: "Présente tes documents, enregistre ton bagage et comprends les consignes de sécurité.",
      es: "Muestra tus documentos, factura tu equipaje y entiende las instrucciones de seguridad.",
      it: "Mostra i documenti, imbarca il bagaglio e comprendi le istruzioni di sicurezza.",
      pt: "Mostre seus documentos, despache a bagagem e entenda as instruções de segurança.",
      nl: "Laat je documenten zien, check je bagage in en begrijp de veiligheidsinstructies.",
      pl: "Pokaż dokumenty, nadaj bagaż i zrozum instrukcje bezpieczeństwa.",
    },
    openingLinesByLanguage: {
      en: "Good morning! May I see your passport and booking confirmation, please?",
      tr: "Günaydın! Pasaportunuzu ve rezervasyon belgenizi görebilir miyim?",
      de: "Guten Morgen! Darf ich bitte Ihren Reisepass und Ihre Buchungsbestätigung sehen?",
      fr: "Bonjour ! Puis-je voir votre passeport et votre confirmation de réservation ?",
      es: "¡Buenos días! ¿Puedo ver su pasaporte y la confirmación de su reserva?",
      it: "Buongiorno! Posso vedere il passaporto e la conferma della prenotazione?",
      pt: "Bom dia! Posso ver seu passaporte e a confirmação da reserva?",
      nl: "Goedemorgen! Mag ik uw paspoort en boekingsbevestiging zien?",
      pl: "Dzień dobry! Czy mogę zobaczyć paszport i potwierdzenie rezerwacji?",
    },
    roleplayInstructions:
      "Role-play an airport check-in agent and then guide the learner through a simple security checkpoint exchange. Ask for the passport, booking, baggage details, seat preference, and explain practical security instructions one step at a time.",
  },
];

export const AI_PRACTICE_SCENARIOS = SCENARIO_DATA;

export function getAiPracticeScenarios() {
  return AI_PRACTICE_SCENARIOS;
}

export function getAiPracticeScenario(id: string) {
  return AI_PRACTICE_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

export function getScenarioTitle(scenario: AiPracticeScenario, locale: LocaleCode) {
  return scenario.titleByLocale[locale] ?? scenario.titleByLocale.en ?? scenario.id;
}

export function getScenarioSummary(scenario: AiPracticeScenario, locale: LocaleCode) {
  return scenario.summaryByLocale[locale] ?? scenario.summaryByLocale.en ?? "Practice a real-life conversation.";
}

export function getScenarioOpeningLine(scenario: AiPracticeScenario, language: LanguageCode) {
  return scenario.openingLinesByLanguage[language] ?? scenario.openingLinesByLanguage.en ?? "Hello! How can I help you?";
}
