import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Blog Page - Kovka Dvorik
 * Features: Blog posts list, categories
 */

const blogPosts = [
  {
    id: 1,
    title: "Как выбрать кованые элементы для лестницы",
    excerpt: "Подробное руководство по выбору балясин, перил и декоративных элементов для создания красивой кованой лестницы.",
    image: "/images/balustrade-stairs.jpg",
    date: "15 декабря 2024",
    readTime: "5 мин",
    category: "Советы"
  },
  {
    id: 2,
    title: "Тренды в художественной ковке 2024",
    excerpt: "Обзор современных тенденций в дизайне кованых изделий: от минимализма до классических орнаментов.",
    image: "/images/forged-elements-display.jpg",
    date: "10 декабря 2024",
    readTime: "7 мин",
    category: "Тренды"
  },
  {
    id: 3,
    title: "Уход за коваными изделиями",
    excerpt: "Практические советы по уходу и защите кованых элементов от коррозии и внешних воздействий.",
    image: "/images/finished-gate.jpg",
    date: "5 декабря 2024",
    readTime: "4 мин",
    category: "Советы"
  },
  {
    id: 4,
    title: "История художественной ковки",
    excerpt: "От древних кузнецов до современных мастеров: путешествие через века кузнечного искусства.",
    image: "/images/craftsman-work.jpg",
    date: "28 ноября 2024",
    readTime: "10 мин",
    category: "История"
  },
  {
    id: 5,
    title: "Кованые ворота: виды и особенности",
    excerpt: "Разбираемся в типах кованых ворот, их преимуществах и особенностях установки.",
    image: "/images/finished-gate.jpg",
    date: "20 ноября 2024",
    readTime: "6 мин",
    category: "Обзоры"
  },
  {
    id: 6,
    title: "Мангал своими руками: выбираем элементы",
    excerpt: "Как собрать красивый кованый мангал из готовых элементов художественной ковки.",
    image: "/images/mangal-example.jpg",
    date: "15 ноября 2024",
    readTime: "8 мин",
    category: "DIY"
  },
];

const categories = ["Все", "Советы", "Тренды", "История", "Обзоры", "DIY"];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState("Все");

  const filteredPosts = selectedCategory === "Все"
    ? blogPosts
    : blogPosts.filter(post => post.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        {/* Hero Section */}
        <section className="container mb-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-[family-name:var(--font-heading)]">
              Наш <span className="text-gold-gradient">блог</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Полезные статьи о художественной ковке, советы по выбору и уходу за изделиями
            </p>
          </motion.div>
        </section>

        {/* Categories */}
        <section className="container mb-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-2"
          >
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`rounded-lg ${
                  selectedCategory === category
                    ? "btn-gold"
                    : "border-border/50 hover:bg-primary/10 hover:border-primary/50"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </motion.div>
        </section>

        {/* Blog Posts Grid */}
        <section className="container">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredPosts.map((post) => (
              <motion.article
                key={post.id}
                variants={fadeInUp}
                className="group"
              >
                <div className="rounded-2xl bg-card border border-border/50 overflow-hidden card-hover">
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.readTime}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors font-[family-name:var(--font-heading)]">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <Button
                      variant="ghost"
                      className="p-0 h-auto text-primary hover:text-primary/80 hover:bg-transparent"
                      onClick={() => toast("Функция в разработке")}
                    >
                      Читать далее
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>

          {/* Load More */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mt-12"
          >
            <Button
              size="lg"
              variant="outline"
              className="rounded-lg font-semibold px-8 border-primary/50 hover:bg-primary/10"
              onClick={() => toast("Функция в разработке")}
            >
              Загрузить ещё
            </Button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}


