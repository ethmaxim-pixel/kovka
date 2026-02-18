import { useState } from "react";
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
  Download,
  MapPin,
  Clock,
  CheckCircle,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { SEO } from "@/components/SEO";

/*
 * Home Page - Kovka Dvorik
 * Design: "Мастерская Художника" — Craft-Driven Dark Aesthetic
 * Sections: Hero, Features, Categories, Price List, Projects, Quick Links, Contact Form, Map, Footer
 */

// Categories data - 22 категории
const categories = [
  { id: "balyasiny", name: "Балясины", image: "/images/cat-balyasiny.png" },
  { id: "venzelya", name: "Вензеля, кольца", image: "/images/cat-venzelya.png" },
  { id: "vinograd", name: "Кованый виноград", image: "/images/cat-vinograd.png" },
  { id: "vstavki", name: "Вставки в балясины", image: "/images/cat-vstavki.png" },
  { id: "paneli", name: "Декоративные панели", image: "/images/cat-paneli.png" },
  { id: "zaglushki", name: "Заглушки на столбы", image: "/images/cat-zaglushki.png" },
  { id: "korzinki", name: "Корзинки", image: "/images/cat-korzinki.png" },
  { id: "listya", name: "Листья", image: "/images/cat-listya.png" },
  { id: "nakonechniki", name: "Наконечники", image: "/images/cat-nakonechniki.png" },
  { id: "osnovaniya", name: "Основания балясин", image: "/images/cat-osnovaniya.png" },
  { id: "kraski", name: "Краски, патина", image: "/images/cat-kraski.png" },
  { id: "piki", name: "Пики", image: "/images/cat-piki.png" },
  { id: "polusfery", name: "Полусферы", image: "/images/cat-polusfery.png" },
  { id: "poruchni", name: "Поручни, окончания", image: "/images/cat-poruchni.png" },
  { id: "rozy", name: "Розы, заклепки", image: "/images/cat-rozy.png" },
  { id: "ruchki", name: "Ручки и петли", image: "/images/cat-ruchki.png" },
  { id: "prokat", name: "Художественный прокат", image: "/images/cat-prokat.png" },
  { id: "cvety", name: "Цветы, накладки", image: "/images/cat-cvety.png" },
  { id: "shary", name: "Шары, сферы", image: "/images/cat-shary.png" },
  { id: "exclusive", name: "Эксклюзивная ковка", image: "/images/cat-exclusive.png" },
  { id: "kolpaki", name: "Колпаки и переходы", image: "/images/cat-kolpaki.png" },
  { id: "zhivotnye", name: "Животные в ковке", image: "/images/cat-zhivotnye.png" },
];

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
      <section className="relative min-h-screen flex items-center pt-20 hero-metal-bg">
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
            {/* Left side - Text content */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="max-w-2xl"
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
                Более 8000 наименований кованых элементов и готовых изделий. 
                Балясины, волюты, листья, виноград и другие элементы художественной ковки.
              </motion.p>
              
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Button size="lg" className="btn-gold rounded-lg text-base font-semibold px-8">
                  <FileText className="w-5 h-5 mr-2" />
                  Скачать прайс
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-lg text-base font-semibold px-8 border-primary/50 hover:bg-primary/10"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Связаться
                </Button>
              </motion.div>
            </motion.div>
            
            {/* Right side - Hero image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:flex justify-center items-center"
            >
              <div className="relative">
                <img
                  src="/images/hero-statue.png"
                  alt="Кованая скульптура"
                  className="w-full max-w-lg h-auto object-contain drop-shadow-2xl"
                />
                {/* Decorative glow effect */}
                <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl -z-10" />
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
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
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-[family-name:var(--font-heading)]">
              Выберите <span className="text-gold-gradient">кованые элементы</span>
              <br />для вашего проекта
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
          >
            {categories.map((category) => (
              <motion.div key={category.id} variants={fadeInUp}>
                <Link
                  href={`/catalog?category=${category.id}`}
                  className="block group"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden card-hover">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-sm md:text-base font-semibold text-foreground font-[family-name:var(--font-heading)]">
                        {category.name}
                      </h3>
                    </div>
                    <div className="absolute inset-0 border border-primary/0 group-hover:border-primary/50 rounded-xl transition-colors" />
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
            <Link href="/catalog">
              <Button size="lg" className="btn-gold rounded-lg font-semibold px-8">
                Перейти в каталог
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Price List Section - Screen 4 */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="max-w-3xl mx-auto"
          >
            <div className="relative p-8 md:p-12 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
              
              <div className="relative flex flex-col md:flex-row items-center gap-8">
                <div className="w-32 h-40 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-16 h-16 text-primary" />
                </div>
                
                <div className="text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-bold mb-3 font-[family-name:var(--font-heading)]">
                    Скачать <span className="text-gold-gradient">прайс-лист</span>
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Полный каталог с ценами на все кованые элементы. Доступен в форматах PDF и Excel.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                    <Button className="btn-gold rounded-lg font-medium">
                      <Download className="w-4 h-4 mr-2" />
                      PDF-файл
                    </Button>
                    <Button variant="outline" className="rounded-lg font-medium border-primary/50 hover:bg-primary/10">
                      <Download className="w-4 h-4 mr-2" />
                      Таблица XLS
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
                  <div className="relative aspect-video rounded-xl overflow-hidden card-hover">
                    <img
                      src={project.image}
                      alt={project.category}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-xl font-bold mb-1 font-[family-name:var(--font-heading)]">
                        {project.category}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    </div>
                    <div className="absolute inset-0 border border-primary/0 group-hover:border-primary/50 rounded-xl transition-colors" />
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
      <section className="py-20 lg:py-28 bg-card/50">
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
                  <Input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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

      {/* Map Section - Screen 8 */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6 font-[family-name:var(--font-heading)]">
                Находимся по адресу:
              </h2>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-lg">г. Луганск, ул. Лутугинская</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p>Пн-Пт: 9:00-18:00</p>
                    <p className="text-muted-foreground">Сб-Вс: 10:00-16:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <a href="tel:+79590001111" className="text-lg hover:text-primary transition-colors">
                    +7 (959) 000-11-11
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">5 мин. от центра</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">350 м. от остановки</span>
                </div>
              </div>
            </div>
            
            <div className="aspect-video lg:aspect-square rounded-xl overflow-hidden bg-card border border-border/50">
              <MapView
                className="w-full h-full"
                initialCenter={{ lat: 48.5734, lng: 39.3078 }}
                initialZoom={15}
                onMapReady={(map) => {
                  new window.google.maps.marker.AdvancedMarkerElement({
                    map,
                    position: { lat: 48.5734, lng: 39.3078 },
                    title: "Ковка в Дворик",
                  });
                }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
