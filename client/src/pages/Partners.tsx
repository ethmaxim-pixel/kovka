import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Percent, Truck, Clock, Users, FileText, Phone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CallbackDialog from "@/components/CallbackDialog";

/*
 * Partners Page - Kovka Dvorik
 * Features: Partnership benefits, conditions, registration form
 */

const benefits = [
  {
    icon: Percent,
    title: "Оптовые скидки",
    description: "Скидки до 30% при оптовых закупках. Чем больше заказ — тем выгоднее цена."
  },
  {
    icon: Truck,
    title: "Бесплатная доставка",
    description: "Бесплатная доставка по России при заказе от 50 000 ₽."
  },
  {
    icon: Clock,
    title: "Приоритетная обработка",
    description: "Ваши заказы обрабатываются в первую очередь."
  },
  {
    icon: Users,
    title: "Персональный менеджер",
    description: "Выделенный менеджер для решения всех вопросов."
  },
];

const discountTiers = [
  { volume: "от 30 000 ₽", discount: "5%" },
  { volume: "от 50 000 ₽", discount: "10%" },
  { volume: "от 100 000 ₽", discount: "15%" },
  { volume: "от 200 000 ₽", discount: "20%" },
  { volume: "от 500 000 ₽", discount: "25%" },
  { volume: "от 1 000 000 ₽", discount: "30%" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Partners() {
  const [callbackOpen, setCallbackOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        {/* Hero Section */}
        <section className="container mb-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-[family-name:var(--font-heading)]">
              Станьте <span className="text-gold-gradient">партнером</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Выгодные условия сотрудничества для кузнечных мастерских, строительных компаний и дизайнеров интерьеров
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-gold rounded-lg font-semibold px-8" onClick={() => setCallbackOpen(true)}>
                <FileText className="w-5 h-5 mr-2" />
                Стать партнером
              </Button>
              <Link href="/contacts">
                <Button size="lg" variant="outline" className="rounded-lg font-semibold px-8 border-primary/50 hover:bg-primary/10">
                  <Phone className="w-5 h-5 mr-2" />
                  Связаться с нами
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-card/50">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Преимущества <span className="text-gold-gradient">партнерства</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-6 rounded-2xl bg-card border border-border/50 card-hover"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
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
          </div>
        </section>

        {/* Discount Tiers Section */}
        <section className="py-20">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-12">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                  Система <span className="text-gold-gradient">скидок</span>
                </h2>
                <p className="text-muted-foreground">
                  Размер скидки зависит от объема заказа
                </p>
              </div>

              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <div className="grid grid-cols-2 bg-primary/10 p-4">
                  <span className="font-semibold text-sm font-[family-name:var(--font-heading)]">Сумма заказа</span>
                  <span className="font-semibold text-sm text-right font-[family-name:var(--font-heading)]">Скидка</span>
                </div>
                {discountTiers.map((tier, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-2 p-4 ${
                      index !== discountTiers.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <span className="text-muted-foreground">{tier.volume}</span>
                    <span className="text-right font-semibold text-gold-gradient">{tier.discount}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* How to Become Partner */}
        <section className="py-20 bg-card/50">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Как стать <span className="text-gold-gradient">партнером</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            >
              {[
                { step: "01", title: "Оставьте заявку", desc: "Заполните форму или позвоните нам" },
                { step: "02", title: "Согласуйте условия", desc: "Обсудим детали сотрудничества" },
                { step: "03", title: "Начните работу", desc: "Получите доступ к оптовым ценам" },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gold-gradient font-[family-name:var(--font-heading)]">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
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
                Готовы начать <span className="text-gold-gradient">сотрудничество?</span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Свяжитесь с нами, и мы подберем оптимальные условия для вашего бизнеса
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="btn-gold rounded-lg font-semibold px-8" onClick={() => setCallbackOpen(true)}>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Оставить заявку
                </Button>
                <a href="tel:+79591110000">
                  <Button size="lg" variant="outline" className="rounded-lg font-semibold px-8 border-primary/50 hover:bg-primary/10 w-full sm:w-auto">
                    <Phone className="w-5 h-5 mr-2" />
                    +7 959 111 00 00
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <CallbackDialog open={callbackOpen} onOpenChange={setCallbackOpen} />
      <Footer />
    </div>
  );
}
