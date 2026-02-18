/**
 * Seed script: populates MySQL with all site data
 * Run: npx tsx server/bot/seed.ts
 */
import "dotenv/config";
import { getDb } from "../db";
import { products, productCategories, businessSettings, siteContent } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { syncKnowledgeBase } from "./qdrant";

// ========== CATEGORIES ==========
const categoriesData = [
  { name: "Балясины", slug: "balyasiny", sortOrder: 1 },
  { name: "Вензеля и волюты", slug: "venzelya", sortOrder: 2 },
  { name: "Виноград", slug: "vinograd", sortOrder: 3 },
  { name: "Гроздья", slug: "grozdya", sortOrder: 4 },
  { name: "Декор полосы", slug: "dekor-polosy", sortOrder: 5 },
  { name: "Корзинки", slug: "korzinki", sortOrder: 6 },
  { name: "Кольца и квадраты", slug: "kolca", sortOrder: 7 },
  { name: "Корни и стебли", slug: "korni", sortOrder: 8 },
  { name: "Листья", slug: "listya", sortOrder: 9 },
  { name: "Литые элементы", slug: "litye", sortOrder: 10 },
  { name: "Навершия", slug: "navershiya", sortOrder: 11 },
  { name: "Накладки", slug: "nakladki", sortOrder: 12 },
  { name: "Основания", slug: "osnovaniya", sortOrder: 13 },
  { name: "Пики", slug: "piki", sortOrder: 14 },
  { name: "Поручни", slug: "poruchni", sortOrder: 15 },
  { name: "Розетки", slug: "rozetki", sortOrder: 16 },
  { name: "Столбы и трубы", slug: "stolby", sortOrder: 17 },
  { name: "Цветы", slug: "cvety", sortOrder: 18 },
  { name: "Штампованные элементы", slug: "shtampovannye", sortOrder: 19 },
  { name: "Кованые ворота", slug: "vorota", sortOrder: 20 },
  { name: "Кованые ограждения", slug: "ograzhdeniya", sortOrder: 21 },
  { name: "Кованые перила", slug: "perila", sortOrder: 22 },
];

// ========== PRODUCTS ==========
const productsData = [
  {
    article: "BAL-001",
    name: "Балясина кованая прямая",
    description: "Классическая прямая балясина из кованого металла. Идеально подходит для лестничных ограждений и перил. Высококачественная сталь с элементами ручной ковки.",
    category: "Балясины",
    priceMin: "450",
    priceMax: "1200",
    priceUnit: "шт",
    materials: "Сталь Ст3",
    dimensions: "900×40мм",
    weight: "2.5 кг",
    tags: ["балясина", "лестница", "перила", "ковка"],
  },
  {
    article: "BAL-002",
    name: "Балясина с витым элементом",
    description: "Декоративная балясина с витым центральным элементом. Придает ограждениям изысканный вид. Ручная ковка центрального элемента.",
    category: "Балясины",
    priceMin: "650",
    priceMax: "1800",
    priceUnit: "шт",
    materials: "Сталь Ст3",
    dimensions: "900×40мм",
    weight: "3.0 кг",
    tags: ["балясина", "витая", "декоративная"],
  },
  {
    article: "BAL-003",
    name: "Балясина с корзинкой",
    description: "Элегантная балясина с декоративным элементом \"корзинка\" в центре. Популярное решение для классических интерьеров и экстерьеров.",
    category: "Балясины",
    priceMin: "800",
    priceMax: "2200",
    priceUnit: "шт",
    materials: "Сталь Ст3",
    dimensions: "900×40мм",
    weight: "3.5 кг",
    tags: ["балясина", "корзинка", "классика"],
  },
  {
    article: "VOL-001",
    name: "Волюта S-образная",
    description: "Классическая S-образная волюта для декоративных элементов. Универсальный элемент художественной ковки, применяемый в ограждениях, воротах и мебели.",
    category: "Вензеля и волюты",
    priceMin: "150",
    priceMax: "450",
    priceUnit: "шт",
    materials: "Полоса 40×4мм",
    dimensions: "200×100мм",
    weight: "0.5 кг",
    tags: ["волюта", "декор", "завиток"],
  },
  {
    article: "VOL-002",
    name: "Вензель двойной",
    description: "Двойной симметричный вензель для художественного оформления. Широко используется в кованых воротах, заборах и балконных ограждениях.",
    category: "Вензеля и волюты",
    priceMin: "250",
    priceMax: "700",
    priceUnit: "шт",
    materials: "Полоса 40×4мм",
    dimensions: "300×200мм",
    weight: "0.8 кг",
    tags: ["вензель", "двойной", "декор"],
  },
  {
    article: "VIN-001",
    name: "Лист виноградный малый",
    description: "Декоративный виноградный лист малого размера. Используется для оформления ворот, перил, мебели, светильников. Точная детализация прожилок.",
    category: "Виноград",
    priceMin: "80",
    priceMax: "250",
    priceUnit: "шт",
    materials: "Сталь 2мм",
    dimensions: "80×60мм",
    weight: "0.1 кг",
    tags: ["виноград", "лист", "декор"],
  },
  {
    article: "VIN-002",
    name: "Гроздь винограда",
    description: "Объемная гроздь винограда из литого металла. Высокодетализированное украшение для ворот, калиток и ограждений. Классический элемент художественной ковки.",
    category: "Виноград",
    priceMin: "350",
    priceMax: "900",
    priceUnit: "шт",
    materials: "Чугун/сталь",
    dimensions: "150×80мм",
    weight: "0.6 кг",
    tags: ["виноград", "гроздь", "литье"],
  },
  {
    article: "LIST-001",
    name: "Лист дубовый кованый",
    description: "Кованый дубовый лист с текстурной поверхностью. Универсальный элемент декора. Создается методом горячей штамповки с последующей ручной доводкой.",
    category: "Листья",
    priceMin: "60",
    priceMax: "180",
    priceUnit: "шт",
    materials: "Сталь 2мм",
    dimensions: "120×70мм",
    weight: "0.15 кг",
    tags: ["лист", "дубовый", "декор"],
  },
  {
    article: "LIST-002",
    name: "Лист кленовый",
    description: "Декоративный кленовый лист из кованого металла. Детальная проработка формы. Применяется в составе композиций для заборов, ворот, решеток.",
    category: "Листья",
    priceMin: "70",
    priceMax: "200",
    priceUnit: "шт",
    materials: "Сталь 2мм",
    dimensions: "100×90мм",
    weight: "0.12 кг",
    tags: ["лист", "кленовый", "штамповка"],
  },
  {
    article: "PIK-001",
    name: "Пика кованая классическая",
    description: "Классическая кованая пика для завершения прутков ограждений. Традиционная остроконечная форма. Надевается на пруток или приваривается.",
    category: "Пики",
    priceMin: "35",
    priceMax: "120",
    priceUnit: "шт",
    materials: "Сталь",
    dimensions: "100×30мм",
    weight: "0.1 кг",
    tags: ["пика", "навершие", "ограждение"],
  },
  {
    article: "PIK-002",
    name: "Пика гранёная",
    description: "Граненая четырехсторонняя пика с декоративным рельефом. Элегантное завершение для кованых заборов и ограждений.",
    category: "Пики",
    priceMin: "50",
    priceMax: "150",
    priceUnit: "шт",
    materials: "Сталь",
    dimensions: "120×35мм",
    weight: "0.15 кг",
    tags: ["пика", "граненая", "забор"],
  },
  {
    article: "ROZ-001",
    name: "Розетка декоративная круглая",
    description: "Декоративная круглая розетка для соединения элементов ковки. Скрывает сварные швы и придает конструкции законченный вид.",
    category: "Розетки",
    priceMin: "40",
    priceMax: "130",
    priceUnit: "шт",
    materials: "Сталь штампованная",
    dimensions: "Ø80мм",
    weight: "0.1 кг",
    tags: ["розетка", "декор", "соединение"],
  },
  {
    article: "ROZ-002",
    name: "Розетка цветочная",
    description: "Цветочная розетка с лепестками. Декоративный элемент для ворот, калиток, перил. Изготавливается методом горячей штамповки.",
    category: "Розетки",
    priceMin: "55",
    priceMax: "170",
    priceUnit: "шт",
    materials: "Сталь",
    dimensions: "Ø100мм",
    weight: "0.15 кг",
    tags: ["розетка", "цветок", "штамповка"],
  },
  {
    article: "KOR-001",
    name: "Корзинка кованая малая",
    description: "Декоративная кованая корзинка (фонарик) малого размера. Создается из 4-х прутков методом горячей скрутки. Центральный элемент балясин.",
    category: "Корзинки",
    priceMin: "120",
    priceMax: "350",
    priceUnit: "шт",
    materials: "Пруток 12мм",
    dimensions: "150×50мм",
    weight: "0.4 кг",
    tags: ["корзинка", "фонарик", "скрутка"],
  },
  {
    article: "KOR-002",
    name: "Корзинка кованая большая",
    description: "Декоративная кованая корзинка большого размера для массивных ограждений. Создает эффект объема и легкости в тяжелых конструкциях.",
    category: "Корзинки",
    priceMin: "200",
    priceMax: "550",
    priceUnit: "шт",
    materials: "Пруток 14мм",
    dimensions: "250×80мм",
    weight: "0.7 кг",
    tags: ["корзинка", "большая", "декор"],
  },
  {
    article: "NAV-001",
    name: "Навершие шар полый",
    description: "Полое навершие в форме шара для столбов ограждений и ворот. Полый шар с гладкой поверхностью. Надевается на трубу квадратного или круглого сечения.",
    category: "Навершия",
    priceMin: "90",
    priceMax: "280",
    priceUnit: "шт",
    materials: "Сталь",
    dimensions: "Ø60мм",
    weight: "0.2 кг",
    tags: ["навершие", "шар", "столб"],
  },
  {
    article: "STOLB-001",
    name: "Столб кованый с основанием",
    description: "Кованый столб с декоративным основанием для ограждений и перил. Включает монтажную пластину для крепления к полу или фундаменту.",
    category: "Столбы и трубы",
    priceMin: "1500",
    priceMax: "4500",
    priceUnit: "шт",
    materials: "Труба 60×60мм",
    dimensions: "1000мм",
    weight: "5.0 кг",
    tags: ["столб", "основание", "труба"],
  },
  {
    article: "POR-001",
    name: "Поручень кованый фигурный",
    description: "Фигурный поручень для перил и ограждений. Профилированная поверхность обеспечивает удобный хват. Поставляется отрезками по 3 метра.",
    category: "Поручни",
    priceMin: "400",
    priceMax: "1200",
    priceUnit: "м.п.",
    materials: "Сталь профилированная",
    dimensions: "50×30мм, L=3000мм",
    weight: "3.5 кг/м.п.",
    tags: ["поручень", "перила", "профиль"],
  },
  {
    article: "NAKL-001",
    name: "Накладка декоративная квадратная",
    description: "Декоративная квадратная накладка для маскировки сварных швов и крепёжных узлов. Штампованная с рельефным орнаментом.",
    category: "Накладки",
    priceMin: "25",
    priceMax: "80",
    priceUnit: "шт",
    materials: "Сталь 2мм",
    dimensions: "60×60мм",
    weight: "0.05 кг",
    tags: ["накладка", "квадрат", "декор"],
  },
  {
    article: "SHTP-001",
    name: "Элемент штампованный \"Ромб\"",
    description: "Штампованный декоративный элемент в форме ромба. Используется для заполнения пространств в ограждениях, воротах и решётках.",
    category: "Штампованные элементы",
    priceMin: "30",
    priceMax: "90",
    priceUnit: "шт",
    materials: "Сталь 3мм",
    dimensions: "100×50мм",
    weight: "0.08 кг",
    tags: ["штамповка", "ромб", "декор"],
  },
  {
    article: "CVET-001",
    name: "Цветок кованый роза",
    description: "Кованый цветок роза с лепестками ручной работы. Многослойная сборка лепестков создает объемный реалистичный вид. Элемент высшего уровня декора.",
    category: "Цветы",
    priceMin: "200",
    priceMax: "600",
    priceUnit: "шт",
    materials: "Сталь 1.5мм",
    dimensions: "Ø80мм",
    weight: "0.2 кг",
    tags: ["цветок", "роза", "ручная работа"],
  },
  {
    article: "KOLC-001",
    name: "Кольцо декоративное кованое",
    description: "Кованое декоративное кольцо для соединения элементов и украшения конструкций. Используется в ограждениях, перилах, мебели.",
    category: "Кольца и квадраты",
    priceMin: "40",
    priceMax: "120",
    priceUnit: "шт",
    materials: "Пруток 12мм",
    dimensions: "Ø100мм",
    weight: "0.15 кг",
    tags: ["кольцо", "декор", "соединение"],
  },
  {
    article: "OSN-001",
    name: "Основание столба фланцевое",
    description: "Фланцевое основание для монтажа кованых столбов. 4 отверстия под анкерные болты. Обеспечивает надёжное крепление к бетону или металлу.",
    category: "Основания",
    priceMin: "180",
    priceMax: "450",
    priceUnit: "шт",
    materials: "Сталь 8мм",
    dimensions: "150×150мм",
    weight: "0.8 кг",
    tags: ["основание", "фланец", "монтаж"],
  },
  {
    article: "LIT-001",
    name: "Элемент литой \"Львиная голова\"",
    description: "Литая львиная голова — классический декоративный элемент для ворот, калиток и дверей. Детальная проработка, высококачественное литье.",
    category: "Литые элементы",
    priceMin: "500",
    priceMax: "1500",
    priceUnit: "шт",
    materials: "Чугун",
    dimensions: "150×120мм",
    weight: "1.5 кг",
    tags: ["литье", "лев", "чугун", "декор"],
  },
  {
    article: "DEKOR-001",
    name: "Полоса декоративная \"Косичка\"",
    description: "Декоративная полоса с орнаментом \"косичка\". Применяется для обрамления панелей ворот, калиток и ограждений. Поставляется отрезками по 3 метра.",
    category: "Декор полосы",
    priceMin: "300",
    priceMax: "800",
    priceUnit: "м.п.",
    materials: "Полоса 30×5мм",
    dimensions: "L=3000мм",
    weight: "1.2 кг/м.п.",
    tags: ["полоса", "косичка", "обрамление"],
  },
];

// ========== BUSINESS SETTINGS ==========
const settingsData = [
  // Schedule
  { key: "schedule.weekdays", value: "Пн-Пт: 9:00 - 18:00", category: "schedule", description: "График работы в будние дни" },
  { key: "schedule.weekends", value: "Сб-Вс: 10:00 - 16:00", category: "schedule", description: "График работы в выходные" },
  { key: "schedule.holidays", value: "Праздники: по согласованию", category: "schedule", description: "График работы в праздничные дни" },
  // Contacts
  { key: "contacts.phone", value: "+7 (959) 111-00-00", category: "contacts", description: "Основной телефон" },
  { key: "contacts.phone2", value: "+7 (959) 222-00-00", category: "contacts", description: "Дополнительный телефон" },
  { key: "contacts.email", value: "info@kovka-dvorik.ru", category: "contacts", description: "Email для заявок" },
  { key: "contacts.whatsapp", value: "+7 (959) 111-00-00", category: "contacts", description: "WhatsApp" },
  { key: "contacts.telegram", value: "@kovka_dvorik", category: "contacts", description: "Telegram" },
  // Address
  { key: "address.city", value: "г. Луганск", category: "address", description: "Город" },
  { key: "address.street", value: "ул. Лутугинская, 42", category: "address", description: "Адрес" },
  { key: "address.full", value: "г. Луганск, ул. Лутугинская, 42", category: "address", description: "Полный адрес" },
  // Company
  { key: "company.name", value: 'Ковка в Дворик', category: "general", description: "Название компании" },
  { key: "company.founded", value: "2014", category: "general", description: "Год основания" },
  { key: "company.description", value: "Интернет-магазин элементов художественной ковки. Более 8000 наименований кованых элементов и готовых изделий оптом и в розницу.", category: "general", description: "Описание компании" },
  { key: "company.products_count", value: "8000+", category: "general", description: "Количество наименований" },
  { key: "company.clients_count", value: "5000+", category: "general", description: "Количество клиентов" },
  { key: "company.experience_years", value: "10+", category: "general", description: "Лет опыта" },
  // Delivery
  { key: "delivery.method1", value: "Самовывоз со склада — бесплатно", category: "delivery", description: "Способ доставки 1" },
  { key: "delivery.method2", value: "Доставка по городу — от 500₽", category: "delivery", description: "Способ доставки 2" },
  { key: "delivery.method3", value: "Доставка по России — по тарифам ТК", category: "delivery", description: "Способ доставки 3" },
  { key: "delivery.info", value: "Доставка осуществляется по всей территории. Возможен самовывоз со склада. Стоимость доставки зависит от объёма заказа и расстояния.", category: "delivery", description: "Общая информация о доставке" },
  // Payment
  { key: "payment.method1", value: "Наличные", category: "payment", description: "Способ оплаты 1" },
  { key: "payment.method2", value: "Банковский перевод", category: "payment", description: "Способ оплаты 2" },
  { key: "payment.method3", value: "Безналичный расчёт для юр. лиц", category: "payment", description: "Способ оплаты 3" },
  { key: "payment.info", value: "Для оптовых клиентов возможна отсрочка платежа. Минимальная сумма заказа для доставки — 5000₽.", category: "payment", description: "Общая информация об оплате" },
  // Promotions
  { key: "promo.wholesale", value: "Оптовая скидка от 10% при заказе от 50 000₽. Промокод: OPT10", category: "promo", description: "Оптовая скидка" },
  { key: "promo.first_order", value: "Скидка 5% на первый заказ. Промокод: FIRST5", category: "promo", description: "Скидка на первый заказ" },
  { key: "promo.seasonal", value: "Весенняя распродажа — скидки до 20% на готовые изделия. Промокод: VESNA20", category: "promo", description: "Сезонная акция" },
  { key: "promo.delivery_free", value: "Бесплатная доставка при заказе от 30 000₽. Промокод: FREE30", category: "promo", description: "Бесплатная доставка" },
  // Partner discounts
  { key: "partners.tier1", value: "Бронза: от 100 000₽ в год — скидка 5%", category: "partners", description: "Партнерская программа уровень 1" },
  { key: "partners.tier2", value: "Серебро: от 300 000₽ в год — скидка 10%", category: "partners", description: "Партнерская программа уровень 2" },
  { key: "partners.tier3", value: "Золото: от 500 000₽ в год — скидка 15%", category: "partners", description: "Партнерская программа уровень 3" },
  { key: "partners.tier4", value: "Платина: от 1 000 000₽ в год — скидка 20%", category: "partners", description: "Партнерская программа уровень 4" },
  { key: "partners.tier5", value: "Бриллиант: от 2 000 000₽ в год — скидка 25%", category: "partners", description: "Партнерская программа уровень 5" },
  { key: "partners.tier6", value: "Эксклюзив: от 5 000 000₽ в год — скидка 30%", category: "partners", description: "Партнерская программа уровень 6" },
  // Custom orders
  { key: "custom.info", value: "Изготовление на заказ: принимаем индивидуальные заказы по эскизам клиента. Возможно изготовление нестандартных размеров и форм. Срок от 3 до 14 рабочих дней.", category: "general", description: "Информация о заказах" },
  // Guarantees
  { key: "guarantee.info", value: "Гарантия качества на все изделия. Возможен обмен и возврат в течение 14 дней. Сертификаты соответствия на всю продукцию.", category: "general", description: "Гарантии" },
];

// ========== SITE CONTENT ==========
const contentData = [
  // Home page
  { key: "home.hero.title", value: "Ковка в Дворик", page: "home", section: "hero", description: "Главный заголовок" },
  { key: "home.hero.subtitle", value: "Интернет-магазин элементов художественной ковки", page: "home", section: "hero", description: "Подзаголовок" },
  { key: "home.hero.description", value: "Более 8000 наименований кованых элементов и готовых изделий. Балясины, волюты, листья, виноград и другие элементы художественной ковки оптом и в розницу.", page: "home", section: "hero", description: "Описание на главной" },
  { key: "home.advantages.quality", value: "Высокое качество: сертифицированная продукция из стали Ст3, чугуна и специальных сплавов", page: "home", section: "advantages", description: "Преимущество — качество" },
  { key: "home.advantages.assortment", value: "Широкий ассортимент: более 8000 наименований в 22 категориях", page: "home", section: "advantages", description: "Преимущество — ассортимент" },
  { key: "home.advantages.prices", value: "Доступные цены: от 25₽ за элемент, оптовые скидки до 30%", page: "home", section: "advantages", description: "Преимущество — цены" },
  { key: "home.advantages.delivery", value: "Быстрая доставка: самовывоз, по городу и по всей России", page: "home", section: "advantages", description: "Преимущество — доставка" },
  { key: "home.stats.products", value: "8000+ наименований товаров", page: "home", section: "stats", description: "Статистика — товары" },
  { key: "home.stats.clients", value: "5000+ довольных клиентов", page: "home", section: "stats", description: "Статистика — клиенты" },
  { key: "home.stats.experience", value: "10+ лет на рынке", page: "home", section: "stats", description: "Статистика — опыт" },
  // About page
  { key: "about.title", value: "О компании \"Ковка в Дворик\"", page: "about", section: "main", description: "Заголовок страницы О компании" },
  { key: "about.description", value: 'Компания "Ковка в Дворик" работает на рынке элементов художественной ковки с 2014 года. Мы предлагаем более 8000 наименований кованых элементов и готовых изделий для ограждений, ворот, перил, заборов и декора.', page: "about", section: "main", description: "Описание компании" },
  { key: "about.mission", value: "Наша миссия — сделать художественную ковку доступной для каждого. Мы предлагаем широкий ассортимент элементов по оптовым ценам, обеспечивая высокое качество и быструю доставку.", page: "about", section: "main", description: "Миссия компании" },
  { key: "about.team", value: "Наша команда — опытные специалисты по художественной ковке, консультанты и логисты, готовые помочь с выбором и оформлением заказа.", page: "about", section: "team", description: "О команде" },
  // Contacts page
  { key: "contacts.title", value: "Контакты", page: "contacts", section: "main", description: "Заголовок страницы Контакты" },
  { key: "contacts.description", value: "Свяжитесь с нами любым удобным способом. Мы всегда рады помочь с выбором, расчётом стоимости и оформлением заказа.", page: "contacts", section: "main", description: "Описание страницы Контакты" },
  // Delivery page
  { key: "delivery.title", value: "Доставка и оплата", page: "delivery", section: "main", description: "Заголовок страницы Доставка" },
  { key: "delivery.description", value: "Мы осуществляем доставку по городу и по всей России. Возможен самовывоз со склада. Стоимость доставки зависит от объёма заказа и расстояния.", page: "delivery", section: "main", description: "Описание доставки" },
  { key: "delivery.payment_description", value: "Принимаем оплату наличными, банковским переводом, безналичный расчёт для юридических лиц. Для оптовых клиентов возможна отсрочка платежа.", page: "delivery", section: "payment", description: "Описание оплаты" },
  // Catalog page
  { key: "catalog.title", value: "Каталог элементов художественной ковки", page: "catalog", section: "main", description: "Заголовок каталога" },
  { key: "catalog.description", value: "Полный каталог элементов художественной ковки: балясины, волюты, листья, виноград, пики, розетки, корзинки и другие декоративные элементы. Оптовые и розничные цены.", page: "catalog", section: "main", description: "Описание каталога" },
  { key: "catalog.categories_count", value: "22 категории товаров", page: "catalog", section: "stats", description: "Количество категорий" },
  // Sales page
  { key: "sales.title", value: "Акции и скидки", page: "sales", section: "main", description: "Заголовок страницы акций" },
  { key: "sales.description", value: "Актуальные акции и специальные предложения на элементы художественной ковки. Оптовые скидки, промокоды и сезонные распродажи.", page: "sales", section: "main", description: "Описание акций" },
  // Partners page
  { key: "partners.title", value: "Партнёрская программа", page: "partners", section: "main", description: "Заголовок страницы партнёров" },
  { key: "partners.description", value: "Станьте нашим партнером и получайте скидки до 30% на весь ассортимент. 6 уровней партнерской программы с накопительной системой скидок.", page: "partners", section: "main", description: "Описание партнерской программы" },
  // Examples page
  { key: "examples.title", value: "Примеры работ", page: "examples", section: "main", description: "Заголовок страницы примеров" },
  { key: "examples.description", value: "Портфолио выполненных проектов: кованые ворота, ограждения, перила, заборы, балконные решётки и другие изделия из нашего каталога.", page: "examples", section: "main", description: "Описание примеров" },
  // Portfolio projects
  { key: "examples.project1", value: "Кованые ворота с виноградной лозой — классический дизайн с элементами виноградной лозы и листьев", page: "examples", section: "projects", description: "Проект 1" },
  { key: "examples.project2", value: "Балконное ограждение — изящное ограждение с волютами и розетками для многоквартирного дома", page: "examples", section: "projects", description: "Проект 2" },
  { key: "examples.project3", value: "Лестничные перила для загородного дома — кованые перила с балясинами и поручнями", page: "examples", section: "projects", description: "Проект 3" },
  { key: "examples.project4", value: "Кованый забор — секционный забор с пиками и декоративными элементами", page: "examples", section: "projects", description: "Проект 4" },
  { key: "examples.project5", value: "Входная группа ресторана — художественная ковка для фасада и входной зоны", page: "examples", section: "projects", description: "Проект 5" },
  { key: "examples.project6", value: "Кованая мебель для сада — скамейки, столы и стулья с коваными элементами", page: "examples", section: "projects", description: "Проект 6" },
  { key: "examples.project7", value: "Оконные решётки — декоративные кованые решётки с цветочными мотивами", page: "examples", section: "projects", description: "Проект 7" },
  { key: "examples.project8", value: "Козырёк над входом — кованый козырёк с поликарбонатом и декоративным орнаментом", page: "examples", section: "projects", description: "Проект 8" },
];

async function seed() {
  console.log("[Seed] Starting database seed...");

  const db = await getDb();
  if (!db) {
    console.error("[Seed] Database not available!");
    process.exit(1);
  }

  // 1. Seed categories
  console.log("[Seed] Inserting categories...");
  let catCount = 0;
  for (const cat of categoriesData) {
    try {
      const existing = await db.select().from(productCategories).where(eq(productCategories.slug, cat.slug)).limit(1);
      if (existing.length === 0) {
        await db.insert(productCategories).values(cat);
        catCount++;
      }
    } catch (e) {
      console.error(`[Seed] Category "${cat.name}" error:`, e);
    }
  }
  console.log(`[Seed] Categories: ${catCount} inserted`);

  // 2. Seed products
  console.log("[Seed] Inserting products...");
  let prodCount = 0;
  for (const prod of productsData) {
    try {
      const existing = await db.select().from(products).where(eq(products.article, prod.article)).limit(1);
      if (existing.length === 0) {
        await db.insert(products).values({
          article: prod.article,
          name: prod.name,
          description: prod.description,
          category: prod.category,
          priceMin: prod.priceMin,
          priceMax: prod.priceMax,
          priceUnit: prod.priceUnit,
          materials: prod.materials,
          dimensions: prod.dimensions,
          weight: prod.weight,
          isActive: true,
          tags: prod.tags,
        });
        prodCount++;
      }
    } catch (e) {
      console.error(`[Seed] Product "${prod.article}" error:`, e);
    }
  }
  console.log(`[Seed] Products: ${prodCount} inserted`);

  // 3. Seed business settings
  console.log("[Seed] Inserting business settings...");
  let settCount = 0;
  for (const setting of settingsData) {
    try {
      const existing = await db.select().from(businessSettings).where(eq(businessSettings.key, setting.key)).limit(1);
      if (existing.length === 0) {
        await db.insert(businessSettings).values({
          key: setting.key,
          value: setting.value,
          category: setting.category,
          description: setting.description,
          type: "string",
        });
        settCount++;
      }
    } catch (e) {
      console.error(`[Seed] Setting "${setting.key}" error:`, e);
    }
  }
  console.log(`[Seed] Business settings: ${settCount} inserted`);

  // 4. Seed site content
  console.log("[Seed] Inserting site content...");
  let contCount = 0;
  for (const content of contentData) {
    try {
      const existing = await db.select().from(siteContent).where(eq(siteContent.key, content.key)).limit(1);
      if (existing.length === 0) {
        await db.insert(siteContent).values({
          key: content.key,
          value: content.value,
          page: content.page,
          section: content.section,
          description: content.description,
        });
        contCount++;
      }
    } catch (e) {
      console.error(`[Seed] Content "${content.key}" error:`, e);
    }
  }
  console.log(`[Seed] Site content: ${contCount} inserted`);

  // 5. Sync to Qdrant
  console.log("[Seed] Syncing knowledge base to Qdrant...");
  try {
    const result = await syncKnowledgeBase();
    console.log(`[Seed] Qdrant sync: ${result.synced} points, ${result.errors.length} errors`);
    if (result.errors.length > 0) {
      console.error("[Seed] Qdrant errors:", result.errors);
    }
  } catch (e) {
    console.error("[Seed] Qdrant sync error:", e);
  }

  console.log("[Seed] Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
