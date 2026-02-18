import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Ruler,
  Weight,
  Hash,
  Check,
  Clock,
  Share2,
  Truck,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { SEO, ProductSchema, BreadcrumbSchema } from "@/components/SEO";
import { trpc } from "@/lib/trpc";

/*
 * Product Page - Kovka Dvorik
 * Design: Dark aesthetic with gold accents
 * Features: Product details, quantity calculator, add to cart, favorites
 */

// Extended product data with all parameters
const productsData = [
  { 
    id: 1, 
    name: "Балясина кованая БК-01", 
    category: "balyasiny", 
    categoryName: "Балясины",
    price: 1200, 
    image: "/images/cat-balyasiny.png",
    article: "БК-01",
    weight: "2.5 кг",
    size: "900 x 40 x 40 мм",
    inStock: true,
    description: "Кованая балясина классического дизайна. Идеально подходит для лестничных ограждений, балконов и террас. Изготовлена из высококачественной стали методом горячей ковки.",
    features: ["Горячая ковка", "Антикоррозийное покрытие", "Ручная работа"]
  },
  { 
    id: 2, 
    name: "Балясина витая БВ-02", 
    category: "balyasiny", 
    categoryName: "Балясины",
    price: 1500, 
    image: "/images/cat-balyasiny.png",
    article: "БВ-02",
    weight: "3.0 кг",
    size: "900 x 45 x 45 мм",
    inStock: true,
    description: "Витая балясина с элегантным спиральным узором. Придаст изысканность любому интерьеру. Подходит для классических и современных стилей оформления.",
    features: ["Витой узор", "Премиум качество", "Универсальный дизайн"]
  },
  { 
    id: 3, 
    name: "Вензель декоративный ВД-01", 
    category: "venzelya", 
    categoryName: "Вензеля, кольца",
    price: 800, 
    image: "/images/cat-venzelya.png",
    article: "ВД-01",
    weight: "0.8 кг",
    size: "200 x 150 x 12 мм",
    inStock: true,
    description: "Декоративный вензель для украшения ворот, калиток и ограждений. Элегантный завиток придаст законченный вид любому кованому изделию.",
    features: ["Декоративный элемент", "Легкий монтаж", "Универсальное применение"]
  },
  { 
    id: 4, 
    name: "Кольцо кованое КК-03", 
    category: "venzelya", 
    categoryName: "Вензеля, кольца",
    price: 650, 
    image: "/images/cat-venzelya.png",
    article: "КК-03",
    weight: "0.5 кг",
    size: "Ø 100 мм",
    inStock: false,
    description: "Кованое кольцо для соединения элементов и декоративного оформления. Может использоваться как самостоятельный декоративный элемент.",
    features: ["Соединительный элемент", "Декоративное применение", "Прочная сталь"]
  },
  { 
    id: 5, 
    name: "Виноград кованый ВК-01", 
    category: "vinograd", 
    categoryName: "Кованый виноград",
    price: 450, 
    image: "/images/cat-vinograd.png",
    article: "ВК-01",
    weight: "0.3 кг",
    size: "80 x 60 x 30 мм",
    inStock: true,
    description: "Кованая гроздь винограда для декоративного оформления. Реалистичное исполнение придаст изделию природную красоту.",
    features: ["Реалистичный дизайн", "Детализация", "Природный мотив"]
  },
  { 
    id: 6, 
    name: "Гроздь винограда ГВ-02", 
    category: "vinograd", 
    categoryName: "Кованый виноград",
    price: 750, 
    image: "/images/cat-vinograd.png",
    article: "ГВ-02",
    weight: "0.6 кг",
    size: "120 x 80 x 40 мм",
    inStock: true,
    description: "Большая гроздь винограда с детализированными ягодами. Идеально подходит для украшения ворот и ограждений в классическом стиле.",
    features: ["Крупный размер", "Высокая детализация", "Классический стиль"]
  },
  { 
    id: 7, 
    name: "Панель декоративная ПД-01", 
    category: "paneli", 
    categoryName: "Декоративные панели",
    price: 3500, 
    image: "/images/cat-paneli.png",
    article: "ПД-01",
    weight: "5.0 кг",
    size: "500 x 500 x 15 мм",
    inStock: true,
    description: "Декоративная кованая панель с геометрическим узором. Может использоваться для ворот, ограждений, перил и интерьерного декора.",
    features: ["Геометрический узор", "Универсальное применение", "Премиум качество"]
  },
  { 
    id: 8, 
    name: "Цветок кованый ЦК-01", 
    category: "cvety", 
    categoryName: "Цветы, накладки",
    price: 550, 
    image: "/images/cat-cvety.png",
    article: "ЦК-01",
    weight: "0.4 кг",
    size: "150 x 150 x 30 мм",
    inStock: true,
    description: "Кованый цветок для декоративного оформления. Реалистичные лепестки и изящная форма украсят любое кованое изделие.",
    features: ["Флористический мотив", "Изящная форма", "Ручная работа"]
  },
  { 
    id: 9, 
    name: "Пика кованая ПК-01", 
    category: "piki", 
    categoryName: "Пики",
    price: 350, 
    image: "/images/cat-piki.png",
    article: "ПК-01",
    weight: "0.25 кг",
    size: "150 x 30 x 30 мм",
    inStock: true,
    description: "Кованая пика для завершения ограждений и ворот. Классическая форма обеспечивает эстетичный и защитный эффект.",
    features: ["Защитный элемент", "Классическая форма", "Прочная сталь"]
  },
  { 
    id: 10, 
    name: "Корзинка кованая КК-01", 
    category: "korzinki", 
    categoryName: "Корзинки",
    price: 1800, 
    image: "/images/cat-korzinki.png",
    article: "КК-01",
    weight: "1.5 кг",
    size: "200 x 100 x 100 мм",
    inStock: true,
    description: "Декоративная кованая корзинка для украшения перил и ограждений. Изящное плетение создает эффект легкости и воздушности.",
    features: ["Плетеный узор", "Декоративный элемент", "Изящный дизайн"]
  },
  { 
    id: 11, 
    name: "Лист кованый ЛК-01", 
    category: "listya", 
    categoryName: "Листья",
    price: 320, 
    image: "/images/cat-listya.png",
    article: "ЛК-01",
    weight: "0.15 кг",
    size: "100 x 60 x 5 мм",
    inStock: true,
    description: "Кованый лист для декоративного оформления. Реалистичная текстура и форма придадут изделию природную красоту.",
    features: ["Природный мотив", "Реалистичная текстура", "Легкий монтаж"]
  },
  { 
    id: 12, 
    name: "Наконечник НК-01", 
    category: "nakonechniki", 
    categoryName: "Наконечники",
    price: 250, 
    image: "/images/cat-nakonechniki.png",
    article: "НК-01",
    weight: "0.2 кг",
    size: "80 x 25 x 25 мм",
    inStock: true,
    description: "Декоративный наконечник для завершения прутьев и стоек. Придает изделию законченный и аккуратный вид.",
    features: ["Завершающий элемент", "Аккуратный вид", "Универсальный размер"]
  },
  { 
    id: 13, 
    name: "Основание балясины ОБ-01", 
    category: "osnovaniya", 
    categoryName: "Основания балясин",
    price: 450, 
    image: "/images/cat-osnovaniya.png",
    article: "ОБ-01",
    weight: "0.8 кг",
    size: "80 x 80 x 50 мм",
    inStock: true,
    description: "Декоративное основание для балясин. Обеспечивает надежное крепление и эстетичный внешний вид.",
    features: ["Надежное крепление", "Декоративный вид", "Стандартный размер"]
  },
  { 
    id: 14, 
    name: "Краска патина КП-01", 
    category: "kraski", 
    categoryName: "Краски, патина",
    price: 1200, 
    image: "/images/cat-kraski.png",
    article: "КП-01",
    weight: "1.0 кг",
    size: "Банка 1 л",
    inStock: true,
    description: "Специальная краска-патина для кованых изделий. Создает эффект старины и защищает металл от коррозии.",
    features: ["Эффект старины", "Защита от коррозии", "Легкое нанесение"]
  },
  { 
    id: 15, 
    name: "Полусфера ПС-01", 
    category: "polusfery", 
    categoryName: "Полусферы",
    price: 180, 
    image: "/images/cat-polusfery.png",
    article: "ПС-01",
    weight: "0.1 кг",
    size: "Ø 50 мм",
    inStock: true,
    description: "Декоративная полусфера для украшения и маскировки крепежа. Придает изделию завершенный вид.",
    features: ["Маскировка крепежа", "Декоративный элемент", "Различные размеры"]
  },
  { 
    id: 16, 
    name: "Поручень ПР-01", 
    category: "poruchni", 
    categoryName: "Поручни, окончания",
    price: 2500, 
    image: "/images/cat-poruchni.png",
    article: "ПР-01",
    weight: "3.5 кг",
    size: "1000 x 60 x 40 мм",
    inStock: false,
    description: "Кованый поручень для лестниц и ограждений. Эргономичная форма обеспечивает удобный хват.",
    features: ["Эргономичная форма", "Удобный хват", "Премиум качество"]
  },
  { 
    id: 17, 
    name: "Роза кованая РК-01", 
    category: "rozy", 
    categoryName: "Розы, заклепки",
    price: 650, 
    image: "/images/cat-rozy.png",
    article: "РК-01",
    weight: "0.35 кг",
    size: "100 x 100 x 40 мм",
    inStock: true,
    description: "Кованая роза для декоративного оформления. Реалистичные лепестки создают эффект живого цветка.",
    features: ["Реалистичные лепестки", "Ручная работа", "Премиум декор"]
  },
  { 
    id: 18, 
    name: "Ручка дверная РД-01", 
    category: "ruchki", 
    categoryName: "Ручки и петли",
    price: 1800, 
    image: "/images/cat-ruchki.png",
    article: "РД-01",
    weight: "1.2 кг",
    size: "250 x 50 x 50 мм",
    inStock: true,
    description: "Кованая дверная ручка классического дизайна. Надежная конструкция и эстетичный внешний вид.",
    features: ["Классический дизайн", "Надежная конструкция", "Удобный хват"]
  },
  { 
    id: 19, 
    name: "Прокат художественный ПХ-01", 
    category: "prokat", 
    categoryName: "Художественный прокат",
    price: 850, 
    image: "/images/cat-prokat.png",
    article: "ПХ-01",
    weight: "2.0 кг",
    size: "1000 x 40 x 8 мм",
    inStock: true,
    description: "Художественный прокат с декоративным профилем. Используется для изготовления ограждений и декоративных элементов.",
    features: ["Декоративный профиль", "Универсальное применение", "Высокое качество"]
  },
  { 
    id: 20, 
    name: "Шар кованый ШК-01", 
    category: "shary", 
    categoryName: "Шары, сферы",
    price: 950, 
    image: "/images/cat-shary.png",
    article: "ШК-01",
    weight: "1.5 кг",
    size: "Ø 100 мм",
    inStock: true,
    description: "Кованый декоративный шар для украшения столбов и ограждений. Идеальная сферическая форма.",
    features: ["Идеальная форма", "Декоративный элемент", "Различные размеры"]
  },
  { 
    id: 21, 
    name: "Эксклюзивный элемент ЭЭ-01", 
    category: "exclusive", 
    categoryName: "Эксклюзивная ковка",
    price: 4500, 
    image: "/images/cat-exclusive.png",
    article: "ЭЭ-01",
    weight: "3.0 кг",
    size: "300 x 200 x 50 мм",
    inStock: false,
    description: "Эксклюзивный кованый элемент ручной работы. Уникальный дизайн для особых проектов.",
    features: ["Уникальный дизайн", "Ручная работа", "Эксклюзив"]
  },
  { 
    id: 22, 
    name: "Колпак на столб КС-01", 
    category: "kolpaki", 
    categoryName: "Колпаки и переходы",
    price: 1200, 
    image: "/images/cat-kolpaki.png",
    article: "КС-01",
    weight: "1.8 кг",
    size: "150 x 150 x 100 мм",
    inStock: true,
    description: "Декоративный колпак для столбов ограждений. Защищает столб от осадков и придает завершенный вид.",
    features: ["Защита от осадков", "Декоративный вид", "Стандартные размеры"]
  },
  { 
    id: 23, 
    name: "Животное кованое ЖК-01", 
    category: "zhivotnye", 
    categoryName: "Животные в ковке",
    price: 5500, 
    image: "/images/cat-zhivotnye.png",
    article: "ЖК-01",
    weight: "4.0 кг",
    size: "400 x 300 x 150 мм",
    inStock: false,
    description: "Кованая фигура животного для декоративного оформления. Детализированное исполнение и реалистичный вид.",
    features: ["Детализация", "Реалистичный вид", "Ручная работа"]
  },
  { 
    id: 24, 
    name: "Вставка в балясину ВБ-01", 
    category: "vstavki", 
    categoryName: "Вставки в балясины",
    price: 380, 
    image: "/images/cat-vstavki.png",
    article: "ВБ-01",
    weight: "0.3 кг",
    size: "200 x 40 x 40 мм",
    inStock: true,
    description: "Декоративная вставка для балясин. Добавляет изящество и индивидуальность стандартным балясинам.",
    features: ["Декоративный элемент", "Легкий монтаж", "Индивидуальность"]
  },
  { 
    id: 25, 
    name: "Заглушка на столб ЗС-01", 
    category: "zaglushki", 
    categoryName: "Заглушки на столбы",
    price: 220, 
    image: "/images/cat-zaglushki.png",
    article: "ЗС-01",
    weight: "0.2 кг",
    size: "60 x 60 x 20 мм",
    inStock: true,
    description: "Заглушка для профильной трубы. Защищает от попадания влаги и придает аккуратный вид.",
    features: ["Защита от влаги", "Аккуратный вид", "Стандартные размеры"]
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Product() {
  const { id: slugOrId } = useParams();
  const [quantity, setQuantity] = useState(1);

  // Cart and Favorites hooks
  const { addItem: addToCart, isInCart } = useCart();
  const { toggleItem: toggleFavorite, isFavorite } = useFavorites();

  // Try to fetch from DB by slug or id
  const isNumericId = /^\d+$/.test(slugOrId || "");
  const { data: dbProductBySlug, isLoading: loadingSlug } = trpc.catalog.products.getBySlug.useQuery(
    { slug: slugOrId || "" },
    { enabled: !!slugOrId && !isNumericId }
  );
  const { data: dbProductById, isLoading: loadingId } = trpc.catalog.products.getPublicById.useQuery(
    { id: Number(slugOrId) },
    { enabled: !!slugOrId && isNumericId }
  );

  const dbProduct = dbProductBySlug || dbProductById;
  const isLoadingDb = loadingSlug || loadingId;

  // Map DB product to display format, fall back to hardcoded
  const product = useMemo(() => {
    if (dbProduct) {
      return {
        id: dbProduct.id,
        name: dbProduct.name,
        category: dbProduct.category || "",
        categoryName: dbProduct.category || "Товары",
        price: parseFloat(dbProduct.priceMin || "0"),
        image: (dbProduct.images as string[] | null)?.[0] || "/images/cat-balyasiny.png",
        article: dbProduct.article,
        weight: dbProduct.weight || "—",
        size: dbProduct.dimensions || "—",
        inStock: dbProduct.stockStatus !== "to_order",
        description: dbProduct.description || "",
        features: dbProduct.tags || [],
        metaTitle: (dbProduct as any).metaTitle as string | null,
        metaDescription: (dbProduct as any).metaDescription as string | null,
        slug: (dbProduct as any).slug as string | null,
      };
    }
    const hardcoded = productsData.find(p => p.id === Number(slugOrId));
    if (hardcoded) return { ...hardcoded, metaTitle: null, metaDescription: null, slug: null };
    return null;
  }, [dbProduct, slugOrId]);

  const isProductFavorite = product ? isFavorite(product.id) : false;
  const isProductInCart = product ? isInCart(product.id) : false;

  if (isLoadingDb) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20">
          <div className="container flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20">
          <div className="container">
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold mb-4">Товар не найден</h1>
              <Link href="/catalog">
                <Button className="btn-gold">Вернуться в каталог</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    }, quantity);
    toast.success(`${product.name} (${quantity} шт.) добавлен в корзину`);
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    toggleFavorite({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    if (!isProductFavorite) {
      toast.success(`${product.name} добавлен в избранное`);
    } else {
      toast.info(`${product.name} удален из избранного`);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Ссылка скопирована в буфер обмена");
  };

  const totalPrice = product.price * quantity;

  const breadcrumbItems = [
    { name: 'Главная', url: 'https://kovka-dvorik.ru/' },
    { name: 'Каталог', url: 'https://kovka-dvorik.ru/catalog' },
    { name: product.categoryName, url: `https://kovka-dvorik.ru/catalog?category=${product.category}` },
    { name: product.name, url: `https://kovkavdvorik.ru/product/${product.slug || product.id}` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={product.metaTitle || product.name}
        description={product.metaDescription || product.description}
        keywords={`${product.name}, ${product.categoryName}, кованые элементы, купить`}
        url={product.slug ? `https://kovkavdvorik.ru/product/${product.slug}` : undefined}
        type="product"
        product={{
          price: product.price,
          currency: 'RUB',
          availability: product.inStock ? 'in stock' : 'out of stock',
          sku: product.article,
        }}
      />
      <ProductSchema
        name={product.name}
        description={product.description}
        image={`https://kovka-dvorik.ru${product.image}`}
        sku={product.article}
        price={product.price}
        availability={product.inStock ? 'InStock' : 'OutOfStock'}
        category={product.categoryName}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <Header />
      
      <main className="pt-28 pb-20">
        <div className="container">
          {/* Breadcrumb */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="mb-6"
          >
            <Link 
              href="/catalog" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Вернуться в каталог</span>
            </Link>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Image */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="relative"
            >
              <div className="aspect-square bg-card rounded-2xl overflow-hidden border border-border/50">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-contain p-8"
                />
              </div>
              
              {/* Stock Badge */}
              <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${
                product.inStock 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                  : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              }`}>
                {product.inStock ? (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    В наличии
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Под заказ
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-lg backdrop-blur-sm transition-all ${
                    isProductFavorite 
                      ? "bg-primary/20 text-primary" 
                      : "bg-background/80 text-muted-foreground hover:text-primary"
                  }`}
                  aria-label="Добавить в избранное"
                >
                  <Heart className={`w-5 h-5 ${isProductFavorite ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-primary transition-all"
                  aria-label="Поделиться"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            {/* Product Info */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col"
            >
              {/* Category */}
              <Link 
                href={`/catalog?category=${product.category}`}
                className="text-sm text-primary hover:underline mb-2"
              >
                {product.categoryName}
              </Link>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                {product.name}
              </h1>

              {/* Price */}
              <div className="text-3xl font-bold text-gold-gradient mb-6">
                {product.price.toLocaleString()} ₽
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-card rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Артикул</div>
                    <div className="font-medium">{product.article}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Weight className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Вес</div>
                    <div className="font-medium">{product.weight}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Размер</div>
                    <div className="font-medium text-sm">{product.size}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Наличие</div>
                    <div className={`font-medium ${product.inStock ? "text-green-400" : "text-orange-400"}`}>
                      {product.inStock ? "В наличии" : "Под заказ"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity Calculator */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Количество:</span>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-14 h-10 flex items-center justify-center font-medium border-x border-border">
                      {quantity}
                    </div>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {quantity > 1 && (
                  <div className="text-sm text-muted-foreground">
                    Итого: <span className="text-foreground font-bold">{totalPrice.toLocaleString()} ₽</span>
                  </div>
                )}
              </div>

              {/* Add to Cart Button */}
              <Button 
                onClick={handleAddToCart}
                size="lg" 
                className={`rounded-lg text-base font-semibold w-full sm:w-auto mb-4 ${
                  isProductInCart ? "bg-green-600 hover:bg-green-700" : "btn-gold"
                }`}
              >
                <ShoppingCart className={`w-5 h-5 mr-2 ${isProductInCart ? "fill-current" : ""}`} />
                {isProductInCart ? "Добавить ещё" : "В корзину"}
              </Button>

              {/* Delivery Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Truck className="w-4 h-4" />
                <span>Доставка по всей России</span>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Описание</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Особенности</h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
