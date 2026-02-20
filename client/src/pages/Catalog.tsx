import { useState, useMemo } from "react";
import { useSearch, Link } from "wouter";
import { motion } from "framer-motion";
import { Search, Filter, Grid, List, ShoppingCart, Eye, Heart, Plus, Minus, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { SEO } from "@/components/SEO";
import { trpc } from "@/lib/trpc";

/*
 * Catalog Page - Kovka Dvorik
 * Features: Product grid, filters, search, category navigation, clickable product cards
 * Integration: Cart and Favorites contexts
 * Updated: Dynamic hierarchical categories from DB
 */


const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// Product type for catalog display
type CatalogProduct = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
  inStock: boolean;
  article: string;
  size: string;
  materials: string;
  weight: string;
  slug: string | null;
};

// Product Card Component with quantity selector
function ProductCard({ product, viewMode }: { product: CatalogProduct; viewMode: "grid" | "list" }) {
  const [quantity, setQuantity] = useState(1);
  const { addItem: addToCart, isInCart } = useCart();
  const { toggleItem: toggleFavorite, isFavorite } = useFavorites();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    }, quantity);
    toast.success(`${product.name} (${quantity} шт.) добавлен в корзину`);
    setQuantity(1);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    if (isFavorite(product.id)) {
      toast.info(`${product.name} удален из избранного`);
    } else {
      toast.success(`${product.name} добавлен в избранное`);
    }
  };

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantity(prev => Math.max(1, prev - 1));
  };

  const productUrl = `/product/${product.slug || product.id}`;

  if (viewMode === "list") {
    return (
      <Link
        href={productUrl}
        className="group flex rounded-xl bg-card border border-border/50 overflow-hidden card-hover"
      >
        <div className="relative w-48 shrink-0">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {/* Stock Badge */}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${
            product.inStock 
              ? "bg-green-500/20 text-green-400 border border-green-500/30" 
              : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
          }`}>
            {product.inStock ? "В наличии" : "Под заказ"}
          </div>
          {/* Favorite Button */}
          <button
            onClick={handleToggleFavorite}
            className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-all ${
              isFavorite(product.id)
                ? "bg-primary/20 text-primary"
                : "bg-background/80 text-muted-foreground hover:text-primary"
            }`}
            aria-label={isFavorite(product.id) ? "Удалить из избранного" : "Добавить в избранное"}
          >
            <Heart className={`w-4 h-4 ${isFavorite(product.id) ? "fill-current" : ""}`} />
          </button>
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-sm line-clamp-1 font-[family-name:var(--font-heading)] group-hover:text-primary transition-colors mb-1">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {product.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
            <span>Арт: {product.article}</span>
            <span>Размер: {product.size}</span>
            {product.materials !== "—" && <span>Материал: {product.materials}</span>}
            {product.weight !== "—" && <span>Вес: {product.weight}</span>}
          </div>
          <div className="mt-auto flex items-center justify-between">
            <span className="text-xl font-bold text-gold-gradient">
              {product.price.toLocaleString()} ₽
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border/50 rounded-lg">
                <button
                  onClick={decrementQuantity}
                  className="p-1.5 hover:bg-muted/50 transition-colors rounded-l-lg"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  onClick={incrementQuantity}
                  className="p-1.5 hover:bg-muted/50 transition-colors rounded-r-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Button
                size="sm"
                className="btn-gold rounded-lg transition-all"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                В корзину
              </Button>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={productUrl}
      className="group block rounded-xl bg-card border border-border/50 overflow-hidden card-hover"
    >
      <div className="relative aspect-square">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {/* Stock Badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${
          product.inStock 
            ? "bg-green-500/20 text-green-400 border border-green-500/30" 
            : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
        }`}>
          {product.inStock ? "В наличии" : "Под заказ"}
        </div>
        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-all ${
            isFavorite(product.id)
              ? "bg-primary/20 text-primary"
              : "bg-background/80 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100"
          }`}
          aria-label={isFavorite(product.id) ? "Удалить из избранного" : "Добавить в избранное"}
        >
          <Heart className={`w-4 h-4 ${isFavorite(product.id) ? "fill-current" : ""}`} />
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 left-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" className="flex-1 btn-gold rounded-lg text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Подробнее
          </Button>
        </div>
      </div>
      <div className="p-2.5 sm:p-4">
        {/* Name - 1 line */}
        <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 font-[family-name:var(--font-heading)] group-hover:text-primary transition-colors mb-1">
          {product.name}
        </h3>

        {/* Description - 2 lines (hidden on very small screens) */}
        <p className="hidden sm:block text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[2.5rem]">
          {product.description}
        </p>

        {/* Article and Characteristics */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
          <span>Арт: {product.article}</span>
          <span className="hidden sm:inline">{product.size !== "—" && `Размер: ${product.size}`}</span>
          {product.materials !== "—" && <span className="hidden sm:inline">Материал: {product.materials}</span>}
          {product.weight !== "—" && <span className="hidden sm:inline">Вес: {product.weight}</span>}
        </div>

        {/* Price */}
        <div className="text-base sm:text-lg font-bold text-gold-gradient mb-2 sm:mb-3">
          {product.price.toLocaleString()} ₽
        </div>

        {/* Quantity selector and Add to cart */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center border border-border/50 rounded-lg">
            <button
              onClick={decrementQuantity}
              className="p-1 sm:p-1.5 hover:bg-muted/50 transition-colors rounded-l-lg"
            >
              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="w-6 sm:w-8 text-center text-xs sm:text-sm font-medium">{quantity}</span>
            <button
              onClick={incrementQuantity}
              className="p-1 sm:p-1.5 hover:bg-muted/50 transition-colors rounded-r-lg"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="flex-1 rounded-lg transition-all btn-gold text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">В корзину</span>
            <span className="sm:hidden">Купить</span>
          </Button>
        </div>
      </div>
    </Link>
  );
}

export default function Catalog() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialCategory = params.get("category") || "all";
  const initialSubcategory = params.get("subcategory") || undefined;

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(initialSubcategory);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Кованные элементы"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch category tree from DB
  const { data: categoryTree } = trpc.catalog.categories.list.useQuery();

  // Build tree: main categories with children, sorted alphabetically
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

  const toggleExpand = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectCategory = (mainCat: string, subCat?: string) => {
    setSelectedCategory(mainCat);
    setSelectedSubcategory(subCat);
    if (mainCat !== "all") {
      setExpandedCategories(prev => { const next = new Set(prev); next.add(mainCat); return next; });
    }
    // Scroll to top of catalog when selecting a category
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch from DB
  const categoryForQuery = selectedCategory === "all" ? undefined : selectedCategory;
  const { data: dbData, isLoading } = trpc.catalog.products.publicList.useQuery({
    category: categoryForQuery,
    subcategory: selectedSubcategory,
    search: searchQuery || undefined,
    limit: 200,
  });

  // Map DB products to CatalogProduct format
  const filteredProducts = useMemo((): CatalogProduct[] => {
    if (!dbData?.products) return [];

    return dbData.products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      category: p.category || "",
      price: parseFloat(p.priceMin || "0"),
      image: (p.images as string[] | null)?.[0] || "/images/cat-balyasiny.png",
      inStock: p.stockStatus !== "to_order",
      article: p.article,
      size: p.dimensions || "—",
      materials: (p as any).materials || "—",
      weight: (p as any).weight || "—",
      slug: p.slug || null,
    }));
  }, [dbData]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Каталог кованых элементов"
        description="Каталог элементов художественной ковки: балясины, листья, виноград, пики, розы и другие кованые изделия. Более 8000 наименований."
        keywords="каталог ковки, кованые элементы купить, балясины, листья кованые, виноград кованый"
      />
      <Header />
      
      <main className="pt-28 pb-20">
        <div className="container">
          {/* Page Header */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-4 font-[family-name:var(--font-heading)]">
              Каталог <span className="text-gold-gradient">товаров</span>
            </h1>
            <p className="text-muted-foreground">
              Более 8000 наименований кованых элементов и готовых изделий
            </p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Filters */}
            <motion.aside
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="lg:w-64 shrink-0"
            >
              <div className="sticky top-28 space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск товаров..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card border-border/50 rounded-lg"
                  />
                </div>

                {/* Categories - Hierarchical */}
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 font-[family-name:var(--font-heading)]">
                    <Filter className="w-4 h-4" />
                    Категории
                  </h3>
                  <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                    {/* All products */}
                    <button
                      onClick={() => handleSelectCategory("all")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedCategory === "all"
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      Все товары
                    </button>

                    {/* Category tree */}
                    {tree.map((mainCat: any) => {
                      const isExpanded = expandedCategories.has(mainCat.name);
                      const isSelectedMain = selectedCategory === mainCat.name && !selectedSubcategory;
                      return (
                        <div key={mainCat.id}>
                          <div className="flex items-center">
                            <button
                              onClick={() => handleSelectCategory(mainCat.name)}
                              className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-all font-medium ${
                                selectedCategory === mainCat.name
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted/50"
                              }`}
                            >
                              {mainCat.name}
                            </button>
                            {mainCat.children?.length > 0 && (
                              <button
                                onClick={() => toggleExpand(mainCat.name)}
                                className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>
                          {isExpanded && mainCat.children?.length > 0 && (
                            <div className="ml-3 pl-2 border-l border-border/30 space-y-0.5">
                              {mainCat.children.map((sub: any) => (
                                <button
                                  key={sub.id}
                                  onClick={() => handleSelectCategory(mainCat.name, sub.name)}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                                    selectedSubcategory === sub.name
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                  }`}
                                >
                                  {sub.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.aside>

            {/* Products Grid */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Найдено: {filteredProducts.length} товаров
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className={viewMode === "grid" ? "text-primary" : "text-muted-foreground"}
                  >
                    <Grid className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className={viewMode === "list" ? "text-primary" : "text-muted-foreground"}
                  >
                    <List className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Products */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
                    : "space-y-4"
                }
              >
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={fadeInUp}
                  >
                    <ProductCard product={product} viewMode={viewMode} />
                  </motion.div>
                ))}
              </motion.div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Товары не найдены</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
