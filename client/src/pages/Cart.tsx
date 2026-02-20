import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Package, Phone, User, MessageSquare, CheckCircle, Percent, Truck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PhoneMaskedInput from "@/components/PhoneMaskedInput";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";

/*
 * Cart Page - Kovka Dvorik
 * Features: Cart items list, quantity controls, order form, discount calculator, delivery selection
 */

// Default discount tiers (can be overridden by admin settings)
const DEFAULT_DISCOUNT_TIERS = [
  { min: 30000, percent: 5 },
  { min: 50000, percent: 10 },
  { min: 100000, percent: 15 },
  { min: 200000, percent: 20 },
  { min: 500000, percent: 25 },
  { min: 1000000, percent: 30 },
];

const DEFAULT_FREE_DELIVERY_MIN = 30000;
const DEFAULT_DELIVERY_PRICE = 500;

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// Discount Progress Bar Component
function DiscountProgress({ totalPrice, tiers }: { totalPrice: number; tiers: typeof DEFAULT_DISCOUNT_TIERS }) {
  // Find current and next tier
  const currentTier = [...tiers].reverse().find(t => totalPrice >= t.min);
  const nextTier = tiers.find(t => totalPrice < t.min);

  if (!nextTier && currentTier) {
    // Max discount reached
    return (
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Percent className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-green-500">
            Ваша скидка: {currentTier.percent}%
          </span>
        </div>
        <div className="w-full bg-green-500/20 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full w-full" />
        </div>
        <p className="text-xs text-green-500/80 mt-2">Максимальная скидка достигнута!</p>
      </div>
    );
  }

  if (!nextTier) return null;

  const prevMin = currentTier ? currentTier.min : 0;
  const remaining = nextTier.min - totalPrice;
  const progress = totalPrice > 0 ? Math.min(((totalPrice - prevMin) / (nextTier.min - prevMin)) * 100, 100) : 0;

  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <Percent className="w-4 h-4 text-primary" />
        {currentTier ? (
          <span className="text-sm font-semibold">
            Ваша скидка: <span className="text-gold-gradient">{currentTier.percent}%</span>
          </span>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
            Скидка ещё не доступна
          </span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Добавьте товаров ещё на <span className="font-semibold text-foreground">{remaining.toLocaleString()} ₽</span> для скидки <span className="font-semibold text-gold-gradient">{nextTier.percent}%</span>
      </p>
    </div>
  );
}

export default function Cart() {
  const { items, removeItem, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const [isCheckout, setIsCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");

  // Fetch discount/delivery settings from DB
  const { data: settingsData } = trpc.settings.getMany.useQuery({
    keys: ["discount_tiers", "free_delivery_min", "delivery_price"],
  });

  // Parse settings with defaults
  const discountTiers = useMemo(() => {
    if (settingsData?.discount_tiers) {
      try {
        return JSON.parse(settingsData.discount_tiers) as typeof DEFAULT_DISCOUNT_TIERS;
      } catch { /* use default */ }
    }
    return DEFAULT_DISCOUNT_TIERS;
  }, [settingsData]);

  const freeDeliveryMin = settingsData?.free_delivery_min
    ? Number(settingsData.free_delivery_min)
    : DEFAULT_FREE_DELIVERY_MIN;

  const deliveryPrice = settingsData?.delivery_price
    ? Number(settingsData.delivery_price)
    : DEFAULT_DELIVERY_PRICE;

  // Calculate discount
  const currentDiscount = useMemo(() => {
    const tier = [...discountTiers].reverse().find(t => totalPrice >= t.min);
    return tier?.percent || 0;
  }, [totalPrice, discountTiers]);

  const discountAmount = Math.round(totalPrice * currentDiscount / 100);
  const priceAfterDiscount = totalPrice - discountAmount;

  // Calculate delivery cost
  const deliveryCost = useMemo(() => {
    if (deliveryType === "pickup") return 0;
    if (totalPrice >= freeDeliveryMin) return 0;
    return deliveryPrice;
  }, [deliveryType, totalPrice, freeDeliveryMin, deliveryPrice]);

  const finalPrice = priceAfterDiscount + deliveryCost;

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    comment: ""
  });
  const [errors, setErrors] = useState({
    name: "",
    phone: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = { name: "", phone: "" };
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = "Введите ваше имя";
      isValid = false;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Введите номер телефона";
      isValid = false;
    } else if (!/^[\d\s\+\-\(\)]{10,}$/.test(formData.phone.trim())) {
      newErrors.phone = "Введите корректный номер телефона";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // tRPC mutation for submitting order
  const submitOrderMutation = trpc.order.submit.useMutation({
    onSuccess: () => {
      setOrderSuccess(true);
      clearCart();
      toast.success("Заказ успешно оформлен! Мы свяжемся с вами в ближайшее время.");
    },
    onError: (error) => {
      console.error("Order submission error:", error);
      toast.error("Ошибка при оформлении заказа. Попробуйте позже.");
    },
  });

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare order items with article info
      const orderItems = items.map(item => ({
        id: item.id,
        name: item.name,
        article: item.article || `ART-${item.id}`,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));

      // Submit order via tRPC
      const deliveryInfo = deliveryType === "pickup" ? "Самовывоз" : "Доставка (ЛНР/ДНР)";
      const discountInfo = currentDiscount > 0 ? `Скидка ${currentDiscount}%: -${discountAmount.toLocaleString()} ₽` : "";
      const fullComment = [
        formData.comment,
        `Способ получения: ${deliveryInfo}`,
        discountInfo,
        deliveryCost > 0 ? `Доставка: от ${deliveryCost.toLocaleString()} ₽` : "",
      ].filter(Boolean).join("\n");

      await submitOrderMutation.mutateAsync({
        name: formData.name,
        phone: formData.phone,
        comment: fullComment || undefined,
        items: orderItems,
        total: finalPrice,
      });
    } catch (error) {
      // Error handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success state
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-28 pb-20">
          <div className="container max-w-2xl">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Заказ <span className="text-gold-gradient">оформлен!</span>
              </h1>
              <p className="text-muted-foreground mb-8">
                Спасибо за ваш заказ! Наш менеджер свяжется с вами в ближайшее время для подтверждения.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button variant="outline" className="border-primary/50 hover:bg-primary/10">
                    На главную
                  </Button>
                </Link>
                <Link href="/catalog">
                  <Button className="btn-gold">
                    Продолжить покупки
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-28 pb-20">
          <div className="container max-w-2xl">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                <ShoppingCart className="w-10 h-10 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-[family-name:var(--font-heading)]">
                Корзина <span className="text-gold-gradient">пуста</span>
              </h1>
              <p className="text-muted-foreground mb-8">
                Добавьте товары из каталога, чтобы оформить заказ
              </p>
              <Link href="/catalog">
                <Button className="btn-gold">
                  Перейти в каталог
                </Button>
              </Link>
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

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
            className="mb-8"
          >
            <Link href="/catalog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              Вернуться в каталог
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-heading)]">
              Корзина <span className="text-gold-gradient">({totalItems})</span>
            </h1>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="lg:col-span-2 space-y-4"
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 rounded-xl bg-card border border-border/50"
                >
                  {/* Product Image */}
                  <Link href={`/product/${item.id}`} className="shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  </Link>
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.id}`}>
                      <h3 className="font-medium text-sm hover:text-primary transition-colors line-clamp-2 font-[family-name:var(--font-heading)]">
                        {item.name}
                      </h3>
                    </Link>
                    <p className="text-lg font-bold text-gold-gradient mt-1">
                      {item.price.toLocaleString()} ₽
                    </p>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center border border-border/50 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 hover:bg-muted/50 transition-colors rounded-l-lg"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1.5 hover:bg-muted/50 transition-colors rounded-r-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        = {(item.price * item.quantity).toLocaleString()} ₽
                      </span>
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Удалить товар"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </motion.div>

            {/* Order Summary / Checkout Form */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="lg:col-span-1"
            >
              <div className="sticky top-28 space-y-4">
                {/* Discount Progress */}
                <DiscountProgress totalPrice={totalPrice} tiers={discountTiers} />

                {/* Order Summary Card */}
                <div className="p-6 rounded-xl bg-card border border-border/50">
                {!isCheckout ? (
                  <>
                    <h2 className="text-xl font-bold mb-6 font-[family-name:var(--font-heading)]">
                      Итого
                    </h2>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Товаров:</span>
                        <span>{totalItems} шт.</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Сумма:</span>
                        <span>{totalPrice.toLocaleString()} ₽</span>
                      </div>
                      {currentDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-500 flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            Скидка {currentDiscount}%:
                          </span>
                          <span className="text-green-500">-{discountAmount.toLocaleString()} ₽</span>
                        </div>
                      )}

                      {/* Delivery selection */}
                      <div className="border-t border-border/50 pt-3">
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Truck className="w-4 h-4" />
                          Доставка
                        </p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <input
                              type="radio"
                              name="delivery"
                              checked={deliveryType === "pickup"}
                              onChange={() => setDeliveryType("pickup")}
                              className="accent-primary"
                            />
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">Самовывоз</span>
                            <span className="ml-auto text-sm text-green-500 font-medium">Бесплатно</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <input
                              type="radio"
                              name="delivery"
                              checked={deliveryType === "delivery"}
                              onChange={() => setDeliveryType("delivery")}
                              className="accent-primary"
                            />
                            <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">Доставка (ЛНР/ДНР)</span>
                            <span className="ml-auto text-sm font-medium">
                              {totalPrice >= freeDeliveryMin ? (
                                <span className="text-green-500">Бесплатно</span>
                              ) : (
                                <span>от {deliveryPrice.toLocaleString()} ₽</span>
                              )}
                            </span>
                          </label>
                        </div>
                        {deliveryType === "delivery" && totalPrice < freeDeliveryMin && (
                          <p className="text-[11px] text-muted-foreground mt-1 pl-2">
                            Бесплатная доставка от {freeDeliveryMin.toLocaleString()} ₽
                          </p>
                        )}
                      </div>

                      <div className="border-t border-border/50 pt-3">
                        {deliveryCost > 0 && (
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Доставка:</span>
                            <span>от {deliveryCost.toLocaleString()} ₽</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="font-medium">К оплате:</span>
                          <span className="text-xl font-bold text-gold-gradient">
                            {finalPrice.toLocaleString()} ₽
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full btn-gold"
                      onClick={() => setIsCheckout(true)}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Оформить заказ
                    </Button>

                    <button
                      onClick={() => {
                        clearCart();
                        toast.info("Корзина очищена");
                      }}
                      className="w-full mt-3 text-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Очистить корзину
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleSubmitOrder}>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold font-[family-name:var(--font-heading)]">
                        Оформление
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsCheckout(false)}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        Назад
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      {/* Name Field */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <User className="w-4 h-4 inline mr-2" />
                          Ваше имя <span className="text-destructive">*</span>
                        </label>
                        <Input
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Введите ваше имя"
                          className={`bg-background border-border/50 ${errors.name ? "border-destructive" : ""}`}
                        />
                        {errors.name && (
                          <p className="text-xs text-destructive mt-1">{errors.name}</p>
                        )}
                      </div>

                      {/* Phone Field */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Номер телефона <span className="text-destructive">*</span>
                        </label>
                        <PhoneMaskedInput
                          value={formData.phone}
                          onChange={(phone) => {
                            setFormData(prev => ({ ...prev, phone }));
                            if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
                          }}
                          className={`bg-background border-border/50 ${errors.phone ? "border-destructive" : ""}`}
                          required
                        />
                        {errors.phone && (
                          <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                        )}
                      </div>

                      {/* Comment Field */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <MessageSquare className="w-4 h-4 inline mr-2" />
                          Комментарий к заказу
                        </label>
                        <Textarea
                          name="comment"
                          value={formData.comment}
                          onChange={handleInputChange}
                          placeholder="Дополнительная информация по заказу..."
                          className="bg-background border-border/50 min-h-[80px]"
                        />
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="border-t border-border/50 pt-4 mb-6 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Товары:</span>
                        <span>{totalPrice.toLocaleString()} ₽</span>
                      </div>
                      {currentDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-500">Скидка {currentDiscount}%:</span>
                          <span className="text-green-500">-{discountAmount.toLocaleString()} ₽</span>
                        </div>
                      )}
                      {deliveryCost > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Доставка:</span>
                          <span>от {deliveryCost.toLocaleString()} ₽</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Доставка:</span>
                        <span>{deliveryType === "pickup" ? "Самовывоз" : "Доставка ЛНР/ДНР"}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border/50">
                        <span className="font-medium">К оплате:</span>
                        <span className="text-xl font-bold text-gold-gradient">
                          {finalPrice.toLocaleString()} ₽
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Наш менеджер свяжется с вами для подтверждения заказа.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full btn-gold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Оформляем...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Подтвердить заказ
                        </>
                      )}
                    </Button>
                  </form>
                )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
