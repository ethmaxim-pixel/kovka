import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Examples Page - Kovka Dvorik
 * Features: Gallery of completed projects with lightbox
 */

const projectCategories = [
  { id: "all", name: "Все работы" },
  { id: "gates", name: "Ворота и калитки" },
  { id: "stairs", name: "Лестницы и перила" },
  { id: "furniture", name: "Мебель" },
  { id: "decor", name: "Декор" },
];

const projects = [
  { id: 1, category: "gates", title: "Кованые ворота для загородного дома", image: "/images/finished-gate.jpg" },
  { id: 2, category: "stairs", title: "Лестничные перила в классическом стиле", image: "/images/balustrade-stairs.jpg" },
  { id: 3, category: "furniture", title: "Садовая скамейка с орнаментом", image: "/images/bench-example.jpg" },
  { id: 4, category: "decor", title: "Мангал с декоративными элементами", image: "/images/mangal-example.jpg" },
  { id: 5, category: "gates", title: "Въездные ворота с виноградной лозой", image: "/images/finished-gate.jpg" },
  { id: 6, category: "stairs", title: "Винтовая лестница с коваными балясинами", image: "/images/balustrade-stairs.jpg" },
  { id: 7, category: "furniture", title: "Кованый столик для сада", image: "/images/bench-example.jpg" },
  { id: 8, category: "decor", title: "Декоративная решетка на окно", image: "/images/forged-elements-display.jpg" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Examples() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filteredProjects = projects.filter(
    (project) => selectedCategory === "all" || project.category === selectedCategory
  );

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  
  const goToPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === 0 ? filteredProjects.length - 1 : lightboxIndex - 1);
    }
  };
  
  const goToNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === filteredProjects.length - 1 ? 0 : lightboxIndex + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 pb-20">
        <div className="container">
          {/* Page Header */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-4 font-[family-name:var(--font-heading)]">
              Примеры <span className="text-gold-gradient">наших работ</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Посмотрите, как наши кованые элементы преображают интерьеры и экстерьеры
            </p>
          </motion.div>

          {/* Category Filters */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-2 mb-10"
          >
            {projectCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-lg ${
                  selectedCategory === category.id
                    ? "btn-gold"
                    : "border-border/50 hover:bg-primary/10 hover:border-primary/50"
                }`}
              >
                {category.name}
              </Button>
            ))}
          </motion.div>

          {/* Projects Grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                variants={fadeInUp}
                className="group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden card-hover">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                    <h3 className="text-sm font-medium text-foreground font-[family-name:var(--font-heading)]">
                      {project.title}
                    </h3>
                  </div>
                  <div className="absolute inset-0 border border-primary/0 group-hover:border-primary/50 rounded-xl transition-colors" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
            onClick={closeLightbox}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-foreground hover:text-primary"
              onClick={closeLightbox}
            >
              <X className="w-6 h-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-4xl max-h-[80vh] mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={filteredProjects[lightboxIndex].image}
                alt={filteredProjects[lightboxIndex].title}
                className="w-full h-full object-contain rounded-xl"
              />
              <p className="text-center mt-4 text-lg font-medium font-[family-name:var(--font-heading)]">
                {filteredProjects[lightboxIndex].title}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
