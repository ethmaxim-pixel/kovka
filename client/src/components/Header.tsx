import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, Package, ShoppingCart, Heart, Trash2, Sun, Moon, PhoneCall, ChevronDown } from "lucide-react";
import CallbackDialog from "./CallbackDialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/*
 * Header Component - Kovka Dvorik
 * Design: Elegant dark aesthetic with gold accents
 * Features: Two-row layout, responsive navigation, mobile menu, cart, favorites
 */

// Main navigation links
const mainNavLinks = [
  { href: "/catalog", label: "Каталог" },
  { href: "/examples", label: "Примеры работ" },
  { href: "/delivery", label: "Оплата и доставка" },
  { href: "/contacts", label: "Контакты" },
];

// Secondary navigation links (in dropdown on smaller screens)
const moreNavLinks = [
  { href: "/partners", label: "Партнерам" },
  { href: "/blog", label: "Блог" },
  { href: "/sales", label: "Акции" },
];

// All navigation links for mobile
const allNavLinks = [...mainNavLinks, ...moreNavLinks];

// Social links
const socialLinks = [
  {
    href: "https://vk.com/",
    label: "VK",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.657 4 8.18c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.456 2.27 4.607 2.862 4.607.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.15-3.574 2.15-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
      </svg>
    )
  },
  {
    href: "https://t.me/",
    label: "Telegram",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    )
  },
  {
    href: "https://wa.me/79591110000",
    label: "WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    )
  },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [location] = useLocation();

  const { items: cartItems, totalItems: cartCount, totalPrice, removeItem: removeCartItem, updateQuantity } = useCart();
  const { items: favoriteItems, totalItems: favoritesCount, removeItem: removeFavorite } = useFavorites();
  const { theme, toggleTheme, switchable } = useTheme();

  // Cart Sheet Content (reusable)
  const CartSheetContent = () => (
    <>
      <SheetHeader className="px-6 pt-6">
        <SheetTitle className="text-foreground font-[family-name:var(--font-heading)]">
          Корзина ({cartCount})
        </SheetTitle>
      </SheetHeader>
      <div className="mt-4 px-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Корзина пуста</p>
            <p className="text-sm mt-1">Добавьте товары из каталога</p>
          </div>
        ) : (
          cartItems.map((item) => (
            <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.id}`} className="text-sm font-medium hover:text-primary line-clamp-2">
                  {item.name}
                </Link>
                <p className="text-primary font-bold mt-1">{item.price.toLocaleString()} ₽</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >-</button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >+</button>
                </div>
              </div>
              <button
                onClick={() => removeCartItem(item.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
      {cartItems.length > 0 && (
        <div className="mx-6 mt-6 pt-4 border-t border-border">
          <div className="flex justify-between items-center mb-4">
            <span className="text-muted-foreground">Итого:</span>
            <span className="text-xl font-bold text-gold-gradient">{totalPrice.toLocaleString()} ₽</span>
          </div>
          <Link href="/cart">
            <Button className="w-full btn-gold rounded-lg">Оформить заказ</Button>
          </Link>
        </div>
      )}
    </>
  );

  // Favorites Sheet Content (reusable)
  const FavoritesSheetContent = () => (
    <>
      <SheetHeader className="px-6 pt-6">
        <SheetTitle className="text-foreground font-[family-name:var(--font-heading)]">
          Избранное ({favoritesCount})
        </SheetTitle>
      </SheetHeader>
      <div className="mt-4 px-6 space-y-4 max-h-[70vh] overflow-y-auto">
        {favoriteItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Избранное пусто</p>
            <p className="text-sm mt-1">Добавьте товары из каталога</p>
          </div>
        ) : (
          favoriteItems.map((item) => (
            <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.id}`} className="text-sm font-medium hover:text-primary line-clamp-2">
                  {item.name}
                </Link>
                <p className="text-primary font-bold mt-1">{item.price.toLocaleString()} ₽</p>
              </div>
              <button
                onClick={() => removeFavorite(item.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top Bar - Contact Info (hidden on mobile) */}
      <div className="hidden md:block bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="container">
          <div className="flex items-center justify-between h-9 text-xs">
            {/* Left: Phone */}
            <a
              href="tel:+79591110000"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-medium">+7 959 111 00 00</span>
            </a>

            {/* Right: Social + Theme */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                    aria-label={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
              {switchable && (
                <button
                  onClick={toggleTheme}
                  className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  aria-label={theme === "dark" ? "Светлая тема" : "Темная тема"}
                >
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center bg-white rounded-lg p-1 overflow-hidden">
                <img
                  src="/images/logo.jpg"
                  alt="Ковка в Дворик"
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm md:text-base font-bold text-gold-gradient font-[family-name:var(--font-heading)] leading-tight">
                  Ковка в Дворик
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight hidden lg:block">
                  Элементы художественной ковки
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {mainNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 xl:px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    location === link.href
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* More dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="px-2.5 xl:px-3 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all flex items-center gap-1">
                  Ещё
                  <ChevronDown className="w-3.5 h-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  {moreNavLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={`w-full cursor-pointer ${
                          location === link.href ? "text-primary" : ""
                        }`}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Mobile Theme Toggle */}
              {switchable && (
                <button
                  onClick={toggleTheme}
                  className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
                  aria-label={theme === "dark" ? "Светлая тема" : "Темная тема"}
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}

              {/* Favorites */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
                    <Heart className="w-5 h-5" />
                    {favoritesCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-primary text-[9px] font-bold text-primary-foreground rounded-full flex items-center justify-center px-1">
                        {favoritesCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md bg-card border-border">
                  <FavoritesSheetContent />
                </SheetContent>
              </Sheet>

              {/* Cart */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-primary text-[9px] font-bold text-primary-foreground rounded-full flex items-center justify-center px-1">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md bg-card border-border">
                  <CartSheetContent />
                </SheetContent>
              </Sheet>

              {/* Desktop CTA Buttons */}
              <div className="hidden md:flex items-center gap-2 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md font-medium border-primary/50 hover:bg-primary/10 text-xs h-8 px-3"
                  onClick={() => setCallbackOpen(true)}
                >
                  <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                  <span className="hidden xl:inline">Обратный звонок</span>
                  <span className="xl:hidden">Звонок</span>
                </Button>
                <Link href="/catalog">
                  <Button
                    size="sm"
                    className="btn-gold rounded-md font-medium text-xs h-8 px-3"
                  >
                    <Package className="w-3.5 h-3.5 mr-1.5" />
                    <span className="hidden xl:inline">Перейти в каталог</span>
                    <span className="xl:hidden">Каталог</span>
                  </Button>
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 text-foreground hover:text-primary transition-colors ml-1"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-background/98 backdrop-blur-md border-b border-border overflow-hidden"
          >
            <nav className="container py-3">
              <div className="grid grid-cols-2 gap-1">
                {allNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-center ${
                      location === link.href
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                {/* Phone */}
                <a
                  href="tel:+79591110000"
                  className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary"
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">+7 959 111 00 00</span>
                </a>

                {/* Social Links */}
                <div className="flex items-center justify-center gap-4">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors p-2"
                      aria-label={social.label}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg font-medium border-primary/50 hover:bg-primary/10 h-10"
                    onClick={() => { setIsMenuOpen(false); setCallbackOpen(true); }}
                  >
                    <PhoneCall className="w-4 h-4 mr-1.5" />
                    Звонок
                  </Button>
                  <Link href="/catalog" onClick={() => setIsMenuOpen(false)}>
                    <Button
                      size="sm"
                      className="btn-gold rounded-lg font-medium h-10 w-full"
                    >
                      <Package className="w-4 h-4 mr-1.5" />
                      Каталог
                    </Button>
                  </Link>
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <CallbackDialog open={callbackOpen} onOpenChange={setCallbackOpen} />
    </header>
  );
}
