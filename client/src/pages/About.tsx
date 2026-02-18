import { motion } from "framer-motion";
import { Award, Users, Package, Clock, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * About Page - Kovka Dvorik
 * Features: Company info, history, team, values
 */

const stats = [
  { value: "10+", label: "Лет на рынке", icon: Clock },
  { value: "8000+", label: "Товаров в каталоге", icon: Package },
  { value: "5000+", label: "Довольных клиентов", icon: Users },
  { value: "100%", label: "Гарантия качества", icon: Award },
];

const values = [
  {
    title: "Качество",
    description: "Мы тщательно контролируем качество каждого изделия, от сырья до готовой продукции."
  },
  {
    title: "Надежность",
    description: "Работаем только с проверенными производителями и гарантируем соответствие заявленным характеристикам."
  },
  {
    title: "Клиентоориентированность",
    description: "Индивидуальный подход к каждому клиенту, помощь в выборе и консультации на всех этапах."
  },
  {
    title: "Развитие",
    description: "Постоянно расширяем ассортимент и следим за новыми тенденциями в художественной ковке."
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

export default function About() {
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
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-[family-name:var(--font-heading)]">
                О компании <span className="text-gold-gradient">Ковка в Дворик</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Мы — команда профессионалов, увлеченных искусством художественной ковки. 
                Более 10 лет мы помогаем нашим клиентам создавать уникальные интерьеры и экстерьеры 
                с помощью качественных кованых элементов.
              </p>
              <p className="text-muted-foreground">
                Наша миссия — сделать художественную ковку доступной для каждого, 
                предлагая широкий ассортимент качественных изделий по справедливым ценам.
              </p>
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden">
              <img
                src="/images/hero-forge.jpg"
                alt="Наша мастерская"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
            </div>
          </motion.div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-card/50">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center p-6 rounded-2xl bg-card border border-border/50"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <stat.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-gold-gradient mb-2 font-[family-name:var(--font-heading)]">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* History Section */}
        <section className="py-20">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-8 font-[family-name:var(--font-heading)]">
                Наша <span className="text-gold-gradient">история</span>
              </h2>
              <div className="space-y-6 text-muted-foreground text-left">
                <p>
                  Компания «Ковка в Дворик» была основана в 2014 году группой энтузиастов, 
                  увлеченных искусством художественной ковки. Начав с небольшого ассортимента 
                  базовых элементов, мы постепенно расширяли каталог, прислушиваясь к потребностям 
                  наших клиентов.
                </p>
                <p>
                  Сегодня мы предлагаем более 8000 наименований кованых элементов: от классических 
                  балясин и волют до эксклюзивных декоративных панелей и художественных композиций. 
                  Мы работаем напрямую с лучшими производителями, что позволяет гарантировать 
                  высокое качество при доступных ценах.
                </p>
                <p>
                  За годы работы мы заслужили доверие тысяч клиентов — от частных мастеров 
                  до крупных строительных компаний. Наша команда всегда готова помочь с выбором, 
                  проконсультировать по техническим вопросам и обеспечить быструю доставку в любой 
                  регион России.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Values Section */}
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
                Наши <span className="text-gold-gradient">ценности</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-6 rounded-2xl bg-card border border-border/50 card-hover"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                        {value.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {value.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Team Image Section */}
        <section className="py-20">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-4xl mx-auto"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <img
                  src="/images/craftsman-work.jpg"
                  alt="Наша команда за работой"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h3 className="text-2xl font-bold mb-2 font-[family-name:var(--font-heading)]">
                    Мастерство в каждой детали
                  </h3>
                  <p className="text-muted-foreground">
                    Наши специалисты с любовью относятся к своему делу
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
