import { motion } from "framer-motion";
import { Tag, Clock, Percent, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Sales Page - Kovka Dvorik
 * Features: Current promotions, discounts, special offers
 */

const promotions = [
  {
    id: 1,
    title: "Скидка 15% на балясины",
    description: "При заказе от 50 штук получите скидку 15% на все виды балясин",
    image: "/images/category-balusters.jpg",
    discount: "15%",
    validUntil: "31 января 2025",
    code: "BALUSTER15"
  },
  {
    id: 2,
    title: "Бесплатная доставка",
    description: "Бесплатная доставка по России при заказе от 30 000 ₽",
    image: "/images/forged-elements-display.jpg",
    discount: "Бесплатно",
    validUntil: "Постоянная акция",
    code: null
  },
  {
    id: 3,
    title: "Подарок при первом заказе",
    description: "Получите набор декоративных элементов в подарок при первом заказе от 10 000 ₽",
    image: "/images/category-leaves.jpg",
    discount: "Подарок",
    validUntil: "15 февраля 2025",
    code: "FIRSTORDER"
  },
  {
    id: 4,
    title: "Распродажа волют",
    description: "Скидки до 25% на волюты и завитки из прошлогодней коллекции",
    image: "/images/category-scrolls.jpg",
    discount: "до 25%",
    validUntil: "Пока есть в наличии",
    code: null
  },
];

const benefits = [
  {
    icon: Percent,
    title: "Регулярные скидки",
    description: "Следите за нашими акциями и экономьте на покупках"
  },
  {
    icon: Gift,
    title: "Подарки клиентам",
    description: "Дарим приятные бонусы постоянным покупателям"
  },
  {
    icon: Tag,
    title: "Промокоды",
    description: "Используйте промокоды для дополнительных скидок"
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Sales() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        {/* Hero Section */}
        <section className="container mb-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-[family-name:var(--font-heading)]">
              Акции и <span className="text-gold-gradient">спецпредложения</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Выгодные предложения на кованые элементы. Не упустите возможность сэкономить!
            </p>
          </motion.div>
        </section>

        {/* Benefits */}
        <section className="container mb-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-6 rounded-2xl bg-card border border-border/50 text-center card-hover"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Promotions Grid */}
        <section className="py-16 bg-card/50">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Текущие <span className="text-gold-gradient">акции</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {promotions.map((promo) => (
                <motion.div
                  key={promo.id}
                  variants={fadeInUp}
                  className="group rounded-2xl bg-card border border-border/50 overflow-hidden card-hover"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                        {promo.discount}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2 font-[family-name:var(--font-heading)]">
                      {promo.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {promo.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{promo.validUntil}</span>
                      </div>
                      {promo.code && (
                        <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/30">
                          <span className="text-sm font-mono text-primary">{promo.code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="py-20">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-3xl mx-auto p-8 md:p-12 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 text-center"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Не пропустите <span className="text-gold-gradient">выгодные предложения</span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Подпишитесь на рассылку и первыми узнавайте о новых акциях и скидках
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/catalog">
                  <Button size="lg" className="btn-gold rounded-lg font-semibold px-8">
                    Перейти в каталог
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/contacts">
                  <Button size="lg" variant="outline" className="rounded-lg font-semibold px-8 border-primary/50 hover:bg-primary/10">
                    Связаться с нами
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
