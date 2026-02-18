import { useState } from "react";
import { motion } from "framer-motion";
import { Truck, CreditCard, Package, MapPin, Clock, Shield, CheckCircle, Calculator } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";

/*
 * Delivery Page - Kovka Dvorik
 * Features: Delivery options, payment methods, shipping info
 */

const deliveryMethods = [
  {
    icon: Truck,
    title: "Транспортная компания",
    description: "Доставка по всей России через надежные транспортные компании",
    details: ["Деловые Линии", "ПЭК", "СДЭК", "Байкал Сервис"],
    time: "3-14 дней"
  },
  {
    icon: Package,
    title: "Самовывоз",
    description: "Заберите заказ самостоятельно с нашего склада",
    details: ["г. Луганск, ул. Лутугинская", "Пн-Пт: 9:00-18:00", "Сб: 10:00-16:00"],
    time: "В день заказа"
  },
  {
    icon: MapPin,
    title: "Курьерская доставка",
    description: "Доставка курьером по городу и области",
    details: ["Луганск и область", "Донецк и область"],
    time: "1-3 дня"
  },
];

const paymentMethods = [
  {
    title: "Банковский перевод",
    description: "Оплата по счету для юридических лиц",
    icon: CreditCard
  },
  {
    title: "Наличные",
    description: "Оплата при получении или в офисе",
    icon: CreditCard
  },
  {
    title: "Банковская карта",
    description: "Visa, MasterCard, МИР",
    icon: CreditCard
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

export default function Delivery() {
  const [distance, setDistance] = useState("");
  const [weight, setWeight] = useState("");
  const [orderTotal, setOrderTotal] = useState("");
  const [calcTriggered, setCalcTriggered] = useState(false);

  const distNum = parseFloat(distance) || 0;
  const weightNum = parseFloat(weight) || 0;
  const totalNum = parseFloat(orderTotal) || 0;

  const { data: calcResult } = trpc.delivery.calculate.useQuery(
    {
      distanceKm: distNum,
      weightKg: weightNum > 0 ? weightNum : undefined,
      orderTotal: totalNum > 0 ? totalNum : undefined,
    },
    { enabled: calcTriggered && distNum > 0 }
  );

  const handleCalc = () => {
    if (distNum > 0) setCalcTriggered(true);
  };

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
              Доставка и <span className="text-gold-gradient">оплата</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Удобные способы доставки и оплаты для вашего комфорта
            </p>
          </motion.div>
        </section>

        {/* Delivery Methods */}
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
                Способы <span className="text-gold-gradient">доставки</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {deliveryMethods.map((method, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-6 rounded-2xl bg-card border border-border/50 card-hover"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <method.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                    {method.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {method.description}
                  </p>
                  <ul className="space-y-2 mb-4">
                    {method.details.map((detail, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{method.time}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Shipping Info */}
        <section className="py-16">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-3xl mx-auto"
            >
              <div className="p-8 rounded-2xl bg-card border border-border/50">
                <h3 className="text-xl font-semibold mb-6 font-[family-name:var(--font-heading)]">
                  Важная информация о доставке
                </h3>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Стоимость доставки</strong> рассчитывается индивидуально 
                    в зависимости от веса, объема заказа и региона доставки.
                  </p>
                  <p>
                    <strong className="text-foreground">Бесплатная доставка</strong> при заказе от 50 000 ₽ 
                    до терминала транспортной компании в вашем городе.
                  </p>
                  <p>
                    <strong className="text-foreground">Упаковка:</strong> Все изделия тщательно упаковываются 
                    для защиты от повреждений при транспортировке.
                  </p>
                  <p>
                    <strong className="text-foreground">Страхование:</strong> По желанию клиента груз может быть 
                    застрахован на полную стоимость.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Delivery Calculator */}
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
                Калькулятор <span className="text-gold-gradient">доставки</span>
              </h2>
              <p className="text-muted-foreground">Рассчитайте стоимость доставки нашим транспортом</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-xl mx-auto"
            >
              <div className="p-8 rounded-2xl bg-card border border-border/50">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Расстояние (км) *</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="Например: 50"
                      value={distance}
                      onChange={(e) => { setDistance(e.target.value); setCalcTriggered(false); }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Вес груза (кг)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="Необязательно"
                      value={weight}
                      onChange={(e) => { setWeight(e.target.value); setCalcTriggered(false); }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Сумма заказа (₽)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="Для расчёта бесплатной доставки"
                      value={orderTotal}
                      onChange={(e) => { setOrderTotal(e.target.value); setCalcTriggered(false); }}
                    />
                  </div>
                  <button
                    onClick={handleCalc}
                    disabled={distNum <= 0}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calculator className="w-5 h-5" />
                    Рассчитать стоимость
                  </button>

                  {calcTriggered && calcResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 rounded-xl bg-primary/5 border border-primary/20"
                    >
                      {calcResult.available ? (
                        <>
                          <div className="text-2xl font-bold text-primary mb-1 font-[family-name:var(--font-heading)]">
                            {calcResult.cost === 0 ? "Бесплатно!" : `${calcResult.cost.toLocaleString("ru-RU")} ₽`}
                          </div>
                          {calcResult.message && (
                            <p className="text-sm text-primary/80 mb-3">{calcResult.message}</p>
                          )}
                          {calcResult.breakdown && calcResult.cost > 0 && (
                            <div className="text-sm text-muted-foreground space-y-1 pt-3 border-t border-primary/10">
                              <p>Базовая стоимость: {calcResult.breakdown.baseCost.toLocaleString("ru-RU")} ₽</p>
                              <p>За расстояние ({distNum} км): {calcResult.breakdown.distanceCost.toLocaleString("ru-RU")} ₽</p>
                              {calcResult.breakdown.weightSurcharge > 0 && (
                                <p>Надбавка за вес: {calcResult.breakdown.weightSurcharge.toLocaleString("ru-RU")} ₽</p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">{calcResult.message}</p>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="py-16">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Способы <span className="text-gold-gradient">оплаты</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            >
              {paymentMethods.map((method, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-6 rounded-2xl bg-card border border-border/50 card-hover text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <method.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-heading)]">
                    {method.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {method.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Guarantee Section */}
        <section className="py-16">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-3xl mx-auto p-8 md:p-12 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50"
            >
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 font-[family-name:var(--font-heading)]">
                    Гарантия качества
                  </h3>
                  <p className="text-muted-foreground">
                    Мы гарантируем качество всех кованых элементов. При обнаружении брака 
                    или повреждений при доставке — бесплатная замена или возврат средств.
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
