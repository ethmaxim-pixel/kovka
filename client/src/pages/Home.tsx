import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  FileText,
  Phone,
  Package,
  Wrench,
  Shield,
  Truck,
  ArrowRight,
  MapPin,
  Clock,
  Mail,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PhoneMaskedInput from "@/components/PhoneMaskedInput";
import { trpc } from "@/lib/trpc";
import { SEO } from "@/components/SEO";

/*
 * Home Page - Kovka Dvorik
 * Design: "Мастерская Художника" — Craft-Driven Dark Aesthetic
 * Sections: Hero, Features, Categories, Price List, Projects, Quick Links, Contact Form, Map, Footer
 */


// Subcategory name → image mapping (fallback when DB has no image)
const subcategoryImageMap: Record<string, string> = {
  "Балясины": "/images/cat-balyasiny.png",
  "Вензеля и кольца": "/images/cat-venzelya.png",
  "Вензеля": "/images/cat-venzelya.png",
  "Кольца": "/images/cat-venzelya.png",
  "Виноград": "/images/cat-vinograd.png",
  "Кованый виноград": "/images/cat-vinograd.png",
  "Декоративные панели": "/images/cat-paneli.png",
  "Панели": "/images/cat-paneli.png",
  "Цветы": "/images/cat-cvety.png",
  "Цветы, накладки": "/images/cat-cvety.png",
  "Накладки": "/images/cat-cvety.png",
  "Пики": "/images/cat-piki.png",
  "Корзинки": "/images/cat-korzinki.png",
  "Листья": "/images/cat-listya.png",
  "Наконечники": "/images/cat-nakonechniki.png",
  "Основания балясин": "/images/cat-osnovaniya.png",
  "Основания": "/images/cat-osnovaniya.png",
  "Краски, патина": "/images/cat-kraski.png",
  "Краски": "/images/cat-kraski.png",
  "Патина": "/images/cat-kraski.png",
  "Полусферы": "/images/cat-polusfery.png",
  "Поручни": "/images/cat-poruchni.png",
  "Поручни, окончания": "/images/cat-poruchni.png",
  "Окончания": "/images/cat-poruchni.png",
  "Розы": "/images/cat-rozy.png",
  "Розы, заклепки": "/images/cat-rozy.png",
  "Заклепки": "/images/cat-rozy.png",
  "Ручки и петли": "/images/cat-ruchki.png",
  "Ручки": "/images/cat-ruchki.png",
  "Петли": "/images/cat-ruchki.png",
  "Шары": "/images/cat-shary.png",
  "Шары, сферы": "/images/cat-shary.png",
  "Сферы": "/images/cat-shary.png",
  "Эксклюзивная ковка": "/images/cat-exclusive.png",
  "Эксклюзив": "/images/cat-exclusive.png",
  "Колпаки и переходы": "/images/cat-kolpaki.png",
  "Колпаки": "/images/cat-kolpaki.png",
  "Переходы": "/images/cat-kolpaki.png",
  "Животные в ковке": "/images/cat-zhivotnye.png",
  "Животные": "/images/cat-zhivotnye.png",
  "Вставки в балясины": "/images/cat-vstavki.png",
  "Вставки": "/images/cat-vstavki.png",
  "Заглушки на столбы": "/images/cat-zaglushki.png",
  "Заглушки": "/images/cat-zaglushki.png",
  "Пластиковые заглушки": "/images/cat-zaglushki.png",
  "Декоративные элементы": "/images/cat-paneli.png",
  "Цифры": "/images/cat-nakonechniki.png",
  "Ящики почтовые": "/images/cat-ruchki.png",
  "Художественный прокат": "/images/cat-prokat.png",
  "Прокат": "/images/cat-prokat.png",
  "Профильная труба": "/images/cat-prokat.png",
  "Металлопрокат": "/images/cat-prokat.png",
};

function getSubcategoryImage(name: string): string {
  if (subcategoryImageMap[name]) return subcategoryImageMap[name];
  // Fuzzy match: check if any key is contained in the name or vice versa
  for (const [key, value] of Object.entries(subcategoryImageMap)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return value;
    }
  }
  return "";
}

// Projects data
const projects = [
  { id: 1, category: "Скамейки", image: "/images/bench-example.jpg", description: "Образцы применения кованых элементов" },
  { id: 2, category: "Мангалы", image: "/images/mangal-example.jpg", description: "Образцы применения кованых элементов" },
  { id: 3, category: "Лестницы", image: "/images/balustrade-stairs.jpg", description: "Образцы применения кованых элементов" },
  { id: 4, category: "Ворота", image: "/images/finished-gate.jpg", description: "Образцы применения кованых элементов" },
];

// Quick links data
const quickLinks = [
  { href: "/catalog", title: "Каталог товаров", icon: Package },
  { href: "/partners", title: "Условия для партнеров", icon: Wrench },
  { href: "/delivery", title: "Доставка и оплата", icon: Truck },
  { href: "/sales", title: "Акции и распродажи", icon: Shield },
  { href: "/blog", title: "Читать блог", icon: FileText },
  { href: "/examples", title: "Примеры работ", icon: ArrowRight },
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function Home() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    message: "",
    consent: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("Все");

  // Fetch category tree from DB
  const { data: categoryTree } = trpc.catalog.categories.list.useQuery();

  // Build tree: main categories with children
  const tree = useMemo(() => {
    if (!categoryTree) return [];
    const roots = categoryTree.filter((c: any) => !c.parentId);
    return roots.map((root: any) => ({
      ...root,
      children: categoryTree
        .filter((c: any) => c.parentId === root.id)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru')),
    }));
  }, [categoryTree]);

  // Get subcategories for selected main category
  const displayedSubcategories = useMemo(() => {
    if (selectedMainCategory === "Все") {
      return tree.flatMap((root: any) =>
        (root.children || []).map((sub: any) => ({ ...sub, parentName: root.name }))
      );
    }
    const found = tree.find((c: any) => c.name === selectedMainCategory);
    return (found?.children || []).map((sub: any) => ({ ...sub, parentName: found?.name }));
  }, [tree, selectedMainCategory]);

  const submitContactMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      toast.success("Заявка отправлена! Мы свяжемся с вами в ближайшее время.");
      setFormData({ name: "", phone: "", message: "", consent: false });
    },
    onError: () => {
      toast.error("Ошибка при отправке заявки. Попробуйте позже.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) {
      toast.error("Необходимо согласие на обработку персональных данных");
      return;
    }
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Заполните имя и телефон");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitContactMutation.mutateAsync({
        name: formData.name,
        phone: formData.phone,
        message: formData.message || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO />
      <Header />
      
      {/* Hero Section - Screen 1 */}
      <section className="relative min-h-[auto] lg:min-h-screen flex items-center pt-24 pb-12 lg:pt-20 lg:pb-0 hero-metal-bg">
        {/* Metal pattern overlay */}
        <div className="absolute inset-0 z-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="metalPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                {/* Scrollwork pattern */}
                <path d="M20,50 Q30,20 50,20 Q70,20 80,50 Q70,80 50,80 Q30,80 20,50" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary"/>
                <circle cx="50" cy="50" r="5" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-primary"/>
                <path d="M10,10 Q20,5 30,10" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-primary"/>
                <path d="M70,90 Q80,95 90,90" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-primary"/>
                <circle cx="15" cy="85" r="3" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-primary"/>
                <circle cx="85" cy="15" r="3" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-primary"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#metalPattern)"/>
          </svg>
        </div>
        
        <div className="container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - Text content (on mobile: order-2, image first) */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="max-w-2xl order-2 lg:order-1"
            >
              <motion.h1
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 font-[family-name:var(--font-heading)]"
              >
                <span className="text-gold-gradient">Кованые элементы</span>
                <br />
                оптом и в розницу
              </motion.h1>
              
              <motion.p
                variants={fadeInUp}
                className="text-lg md:text-xl text-muted-foreground mb-8"
              >
                Более 1000 наименований кованых элементов и готовых изделий. 
                Балясины, волюты, листья, виноград и другие элементы художественной ковки.
              </motion.p>
              
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4"
              >
                <Link href="/catalog" className="w-full sm:w-auto">
                  <Button size="lg" className="btn-gold rounded-lg text-base font-semibold px-8 w-full sm:w-auto">
                    <Package className="w-5 h-5 mr-2" />
                    Перейти в каталог
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-lg text-base font-semibold px-8 border-primary/50 hover:bg-primary/10 w-full sm:w-auto"
                  onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Связаться
                </Button>
              </motion.div>
            </motion.div>
            
            {/* Right side - Hero image (on mobile: order-1, shown first) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex justify-center items-center order-1 lg:order-2"
            >
              <div className="relative">
                <img
                  src="/images/hero-statue.png"
                  alt="Кованая скульптура"
                  className="w-full max-w-[280px] lg:max-w-lg h-auto object-contain drop-shadow-2xl"
                />
                {/* Decorative glow effect */}
                <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl -z-10" />
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Scroll indicator - hidden on mobile to prevent overlap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-primary/50 flex justify-center pt-2">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section - Screen 2 */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { icon: Package, title: "Обширный каталог", desc: "Более 1000 кованых элементов от производителя" },
              { icon: Wrench, title: "Индивидуальные проекты", desc: "Выполним нестандартные изделия под заказ" },
              { icon: Shield, title: "Гарантия качества", desc: "Соответствуем требованиям и стандартам качества" },
              { icon: Truck, title: "Быстрая доставка", desc: "Доставка по всей России в кратчайшие сроки" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-6 rounded-2xl bg-card border border-border/50 card-hover group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories Section - Screen 3 */}
      <section className="py-20 lg:py-28 bg-card/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-[family-name:var(--font-heading)]">
              Выберите <span className="text-gold-gradient">кованые элементы</span>
              <br />для вашего проекта
            </h2>
          </motion.div>

          {/* Category tabs */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-2 mb-10"
          >
            <Button
              variant={selectedMainCategory === "Все" ? "default" : "outline"}
              className={`rounded-lg ${
                selectedMainCategory === "Все"
                  ? "btn-gold"
                  : "border-border/50 hover:bg-primary/10 hover:border-primary/50"
              }`}
              onClick={() => setSelectedMainCategory("Все")}
            >
              Все
            </Button>
            {tree.map((mainCat: any) => (
              <Button
                key={mainCat.id}
                variant={selectedMainCategory === mainCat.name ? "default" : "outline"}
                className={`rounded-lg ${
                  selectedMainCategory === mainCat.name
                    ? "btn-gold"
                    : "border-border/50 hover:bg-primary/10 hover:border-primary/50"
                }`}
                onClick={() => setSelectedMainCategory(mainCat.name)}
              >
                {mainCat.name}
              </Button>
            ))}
          </motion.div>

          {/* Subcategory cards */}
          <motion.div
            key={selectedMainCategory}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6"
          >
            {displayedSubcategories.map((sub: any) => (
              <motion.div key={sub.id} variants={fadeInUp}>
                <Link
                  href={`/catalog?category=${encodeURIComponent(sub.parentName)}&subcategory=${encodeURIComponent(sub.name)}`}
                  className="block group"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden card-hover bg-card border border-border/50">
                    {(sub.image || getSubcategoryImage(sub.name)) ? (
                      <img
                        src={sub.image || getSubcategoryImage(sub.name)}
                        alt={sub.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center">
                        <Package className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                      <h3 className="text-xs md:text-sm font-semibold text-foreground font-[family-name:var(--font-heading)]">
                        {sub.name}
                      </h3>
                    </div>
                    <div className="absolute inset-0 border border-primary/0 group-hover:border-primary/50 rounded-xl transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {displayedSubcategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Загрузка категорий...
            </div>
          )}

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-10"
          >
            <Link href="/catalog">
              <Button size="lg" className="btn-gold rounded-lg font-semibold px-8">
                Перейти в каталог
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Projects Section - Screen 5 */}
      <section className="py-20 lg:py-28 bg-card/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-[family-name:var(--font-heading)]">
              Готовые проекты с <span className="text-gold-gradient">нашими элементами</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Посмотрите, как наши кованые элементы используются в реальных проектах
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {projects.map((project) => (
              <motion.div key={project.id} variants={fadeInUp}>
                <Link href="/examples" className="block group">
                  <div className="rounded-xl overflow-hidden card-hover bg-card border border-border/50">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={project.image}
                        alt={project.category}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4 md:p-6">
                      <h3 className="text-lg md:text-xl font-bold mb-1 font-[family-name:var(--font-heading)] group-hover:text-primary transition-colors">
                        {project.category}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-10"
          >
            <Link href="/examples">
              <Button size="lg" variant="outline" className="rounded-lg font-semibold px-8 border-primary/50 hover:bg-primary/10">
                Смотреть все примеры
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Quick Links Section - Screen 6 */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {quickLinks.map((link, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link href={link.href} className="block group">
                  <div className="p-6 rounded-xl bg-card border border-border/50 card-hover flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <link.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold font-[family-name:var(--font-heading)]">
                        {link.title}
                      </h3>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact Form Section - Screen 7 */}
      <section id="contact-form" className="py-20 lg:py-28 bg-card/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="max-w-2xl mx-auto"
          >
            <div className="p-8 md:p-12 rounded-2xl bg-card border border-border/50">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-3 font-[family-name:var(--font-heading)]">
                  Остались <span className="text-gold-gradient">вопросы?</span>
                </h2>
                <p className="text-muted-foreground">
                  Оставьте данные, мы свяжемся с вами в ближайшее время
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Input
                    placeholder="Ваше имя"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-12 bg-background border-border/50 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <PhoneMaskedInput
                    value={formData.phone}
                    onChange={(phone) => setFormData({ ...formData, phone })}
                    className="h-12 bg-background border-border/50 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Ваше сообщение"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="min-h-[120px] bg-background border-border/50 rounded-lg resize-none"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={formData.consent}
                    onCheckedChange={(checked) => setFormData({ ...formData, consent: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="consent" className="text-sm text-muted-foreground">
                    Я согласен на обработку персональных данных в соответствии с{" "}
                    <a href="#" className="text-primary hover:underline">
                      политикой конфиденциальности
                    </a>
                  </label>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full btn-gold rounded-lg font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    "Отправка..."
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Отправить
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Map & Contacts Section - Screen 8 */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-8 font-[family-name:var(--font-heading)]">
                Контактная <span className="text-gold-gradient">информация</span>
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Телефон</h3>
                    <a href="tel:+79591313298" className="text-lg text-gold-gradient hover:underline">
                      +7 (959) 131-32-98
                    </a>
                    <p className="text-sm text-muted-foreground mt-1">Звоните в рабочее время</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <a href="mailto:info@kovka-dvorik.ru" className="text-lg text-gold-gradient hover:underline">
                      info@kovka-dvorik.ru
                    </a>
                    <p className="text-sm text-muted-foreground mt-1">Ответим в течение 24 часов</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Адрес</h3>
                    <p className="text-lg">г. Луганск, ул. Лутугинская</p>
                    <p className="text-sm text-muted-foreground mt-1">Офис и склад</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Режим работы</h3>
                    <p className="text-lg">Пн-Пт: 9:00-18:00</p>
                    <p className="text-muted-foreground">Сб-Вс: 10:00-16:00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="aspect-video lg:aspect-square rounded-xl overflow-hidden bg-card border border-border/50">
              <iframe
                src="https://yandex.ru/map-widget/v1/?ll=39.3078%2C48.5734&z=15&pt=39.3078%2C48.5734%2Cpm2rdm"
                className="w-full h-full border-0"
                allowFullScreen
                title="Ковка в Дворик на карте"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
