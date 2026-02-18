import { useState, useMemo, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PeriodSelector, { usePeriod } from "./PeriodSelector";
import {
  Search,
  Plus,
  ShoppingCart,
  X,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Check,
  Minus,
  User,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Star,
  Camera,
} from "lucide-react";

const BarcodeScanner = lazy(() => import("@/components/admin/BarcodeScanner"));

interface CartItem {
  productName: string;
  productArticle: string;
  productCategory?: string;
  quantity: number;
  price: string;
  image?: string;
}

const paymentMethods = [
  { id: "cash" as const, label: "Наличные", icon: Banknote },
  { id: "card" as const, label: "Карта", icon: CreditCard },
  { id: "transfer" as const, label: "Перевод", icon: ArrowRightLeft },
];

const ratingTags = ["Вежливый", "Приятный в общении", "Знает что хочет", "Оптовый покупатель", "Торгуется", "Сложный клиент", "Грубый"];

type SubTab = "sale" | "history";

interface ShopSalesTabProps {
  prefillOrderId?: number | null;
  onPrefillComplete?: () => void;
}

export default function ShopSalesTab({ prefillOrderId, onPrefillComplete }: ShopSalesTabProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("sale");

  // Search mode
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // New sale mode
  const [isCreating, setIsCreating] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "other">("cash");
  const [comment, setComment] = useState("");

  // Cash change calculation
  const [cashGiven, setCashGiven] = useState("");

  // Product search for cart
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Complete existing order
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null);
  const [completePayment, setCompletePayment] = useState<"cash" | "card" | "transfer" | "other">("cash");

  // History
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 20;
  const { range: historyRange, handleChange: handleHistoryPeriod } = usePeriod("30d");
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historyPayment, setHistoryPayment] = useState<"cash" | "card" | "transfer" | "other" | "all">("all");

  // Sale details
  const [viewingSaleId, setViewingSaleId] = useState<number | null>(null);

  // Rating dialog
  const [ratingDialog, setRatingDialog] = useState<{ orderId: number; customerId?: number | null } | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingSelectedTags, setRatingSelectedTags] = useState<string[]>([]);
  const [ratingComment, setRatingComment] = useState("");

  // Refs for click-outside
  const productSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside & Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setShowProductResults(false);
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerResults(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProductResults(false);
        setShowCustomerResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Debounce helpers
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    clearTimeout((window as Record<string, unknown>).__shopSearchTimer as number);
    (window as Record<string, unknown>).__shopSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const handleProductSearchChange = (val: string) => {
    setProductSearch(val);
    setShowProductResults(val.length >= 2);
    clearTimeout((window as Record<string, unknown>).__prodSearchTimer as number);
    (window as Record<string, unknown>).__prodSearchTimer = setTimeout(() => setDebouncedProductSearch(val), 300);
  };

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearch(val);
    setShowCustomerResults(val.length >= 2);
    clearTimeout((window as Record<string, unknown>).__custSearchTimer as number);
    (window as Record<string, unknown>).__custSearchTimer = setTimeout(() => setDebouncedCustomerSearch(val), 300);
  };

  const handleHistorySearchChange = (val: string) => {
    setHistorySearch(val);
    clearTimeout((window as Record<string, unknown>).__histSearchTimer as number);
    (window as Record<string, unknown>).__histSearchTimer = setTimeout(() => {
      setDebouncedHistorySearch(val);
      setHistoryPage(1);
    }, 300);
  };

  // Queries
  const { data: searchResults } = trpc.shop.searchOrders.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 1 }
  );
  const { data: todaySales, refetch: refetchToday } = trpc.shop.todaySales.useQuery();
  const { data: recentSalesData, refetch: refetchRecent } = trpc.shop.recentSales.useQuery(
    {
      page: historyPage,
      limit: historyLimit,
      dateFrom: historyRange.dateFrom.toISOString(),
      dateTo: historyRange.dateTo.toISOString(),
      search: debouncedHistorySearch || undefined,
      paymentMethod: historyPayment,
    }
  );
  const { data: productResults } = trpc.shop.searchProducts.useQuery(
    { query: debouncedProductSearch },
    { enabled: debouncedProductSearch.length >= 2 }
  );
  const { data: customerResults } = trpc.shop.searchCustomers.useQuery(
    { query: debouncedCustomerSearch },
    { enabled: debouncedCustomerSearch.length >= 2 }
  );
  const { data: saleDetails } = trpc.stats.orderDetails.useQuery(
    { orderId: viewingSaleId! },
    { enabled: viewingSaleId !== null }
  );

  // Load order details when completing an order inline
  const { data: completingOrderData } = trpc.stats.orderDetails.useQuery(
    { orderId: completingOrderId! },
    { enabled: !!completingOrderId }
  );

  // Prefill from website order
  const { data: prefillOrder } = trpc.stats.orderDetails.useQuery(
    { orderId: prefillOrderId! },
    { enabled: !!prefillOrderId }
  );
  const [prefillActive, setPrefillActive] = useState(false);

  useEffect(() => {
    if (prefillOrder && prefillOrderId && !prefillActive) {
      setPrefillActive(true);
      setIsCreating(true);
      setCustomerName(prefillOrder.customerName || "");
      setCustomerPhone(prefillOrder.customerPhone || "");
      setPaymentMethod((prefillOrder as any).isLegalEntity ? "transfer" : "cash");
      setComment(`Заказ #${prefillOrder.id} с сайта`);
      if (prefillOrder.items && prefillOrder.items.length > 0) {
        setCart(prefillOrder.items.map((item: any) => ({
          productName: item.productName,
          productArticle: item.productArticle,
          productCategory: item.productCategory || undefined,
          quantity: item.quantity,
          price: item.price,
          image: item.productImages?.[0] || undefined,
        })));
      }
    }
  }, [prefillOrder, prefillOrderId]);

  // Prefill from completing order (inline)
  const [completingFilled, setCompletingFilled] = useState(false);
  useEffect(() => {
    if (completingOrderData && completingOrderId && !completingFilled) {
      setCompletingFilled(true);
      setCustomerName(completingOrderData.customerName || "");
      setCustomerPhone(completingOrderData.customerPhone || "");
      setPaymentMethod("cash");
      setComment(`Заказ #${completingOrderData.id}`);
      if (completingOrderData.items && completingOrderData.items.length > 0) {
        setCart(completingOrderData.items.map((item: any) => ({
          productName: item.productName,
          productArticle: item.productArticle,
          productCategory: item.productCategory || undefined,
          quantity: item.quantity,
          price: item.price,
          image: item.productImages?.[0] || undefined,
        })));
      }
    }
  }, [completingOrderData, completingOrderId]);

  // Mutations
  const createSaleMutation = trpc.shop.createSale.useMutation({
    onSuccess: (data) => {
      toast.success(`Продажа #${data.orderId} оформлена`);
      const orderId = data.orderId;
      const custId = selectedCustomerId;
      resetForm();
      refetchToday();
      refetchRecent();
      // Show rating dialog
      setRatingDialog({ orderId, customerId: custId });
    },
    onError: (err) => toast.error(err.message),
  });

  const [actHtml, setActHtml] = useState<string | null>(null);

  const generateActMutation = trpc.stats.generateAct.useMutation({
    onSuccess: ({ actHtml }) => {
      toast.success("Акт выполненных работ сформирован");
      setActHtml(actHtml);
    },
    onError: (err) => toast.error("Ошибка генерации акта: " + err.message),
  });

  const openActDoc = (mode: "print" | "open") => {
    if (!actHtml) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(actHtml);
      win.document.close();
      if (mode === "print") setTimeout(() => win.print(), 300);
    }
  };

  const completeSaleMutation = trpc.shop.completeSale.useMutation({
    onSuccess: () => {
      toast.success("Продажа оформлена");
      const orderId = prefillOrderId || completingOrderId;
      const custId = selectedCustomerId;
      // Auto-generate act for юр.лицо orders
      const orderData = prefillOrderId ? prefillOrder : completingOrderData;
      const isLegal = (orderData as any)?.isLegalEntity;
      setCompletingOrderId(null);
      setPrefillActive(false);
      resetForm();
      refetchToday();
      refetchRecent();
      if (onPrefillComplete) onPrefillComplete();
      if (orderId) setRatingDialog({ orderId, customerId: custId });
      if (isLegal && orderId) {
        generateActMutation.mutate({ orderId });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const rateCustomerMutation = trpc.shop.rateCustomer.useMutation({
    onSuccess: () => {
      toast.success("Оценка сохранена");
      closeRatingDialog();
    },
    onError: () => {
      toast.error("Не удалось сохранить оценку");
      closeRatingDialog();
    },
  });

  const closeRatingDialog = () => {
    setRatingDialog(null);
    setRatingValue(0);
    setRatingHover(0);
    setRatingSelectedTags([]);
    setRatingComment("");
  };

  const handleSubmitRating = () => {
    if (!ratingDialog || ratingValue === 0) return;
    rateCustomerMutation.mutate({
      orderId: ratingDialog.orderId,
      customerId: ratingDialog.customerId || undefined,
      rating: ratingValue,
      tags: ratingSelectedTags.length > 0 ? ratingSelectedTags : undefined,
      comment: ratingComment.trim() || undefined,
    });
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0),
    [cart]
  );

  const cashChange = useMemo(() => {
    const given = parseFloat(cashGiven);
    if (!given || given < cartTotal) return null;
    return given - cartTotal;
  }, [cashGiven, cartTotal]);

  const resetForm = () => {
    setIsCreating(false);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedCustomerId(null);
    setCart([]);
    setPaymentMethod("cash");
    setComment("");
    setCashGiven("");
    setProductSearch("");
    setCustomerSearch("");
    setPrefillActive(false);
    setCompletingOrderId(null);
    setCompletingFilled(false);
  };

  const addToCart = (product: { name: string; article: string; category: string | null; priceMin: string | null; priceMax: string | null; images?: string[] | null }) => {
    const existing = cart.find((c) => c.productArticle === product.article);
    if (existing) {
      setCart(cart.map((c) => c.productArticle === product.article ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        productName: product.name,
        productArticle: product.article,
        productCategory: product.category || undefined,
        quantity: 1,
        price: product.priceMin || "0",
        image: product.images?.[0] || undefined,
      }]);
    }
    setProductSearch("");
    setShowProductResults(false);
  };

  const trpcUtils = trpc.useUtils();
  const handleBarcodeScan = useCallback(async (code: string) => {
    setShowBarcodeScanner(false);
    try {
      const product = await trpcUtils.shop.findByBarcode.fetch({ barcode: code });
      if (product) {
        addToCart(product as any);
        toast.success(`${product.name} добавлен`);
      } else {
        toast.error(`Товар не найден: ${code}`);
      }
    } catch {
      toast.error("Ошибка поиска по штрихкоду");
    }
  }, [trpcUtils, addToCart]);

  const updateCartItem = (article: string, field: "quantity" | "price", value: number | string) => {
    setCart(cart.map((c) => c.productArticle === article ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (article: string) => {
    setCart(cart.filter((c) => c.productArticle !== article));
  };

  const handleCreateSale = () => {
    if (cart.length === 0) {
      toast.error("Добавьте товары в корзину");
      return;
    }
    if (prefillActive && prefillOrderId) {
      completeSaleMutation.mutate({ orderId: prefillOrderId, paymentMethod, items: cart });
      return;
    }
    if (completingOrderId) {
      completeSaleMutation.mutate({ orderId: completingOrderId, paymentMethod, items: cart });
      return;
    }
    createSaleMutation.mutate({
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerId: selectedCustomerId || undefined,
      items: cart,
      paymentMethod,
      comment: comment.trim() || undefined,
    });
  };

  const selectCustomer = (c: { id: number; name: string | null; phone: string }) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone);
    setCustomerSearch("");
    setShowCustomerResults(false);
  };

  const handleStartCompleteOrder = (orderId: number) => {
    setCompletingOrderId(orderId);
    setIsCreating(true);
    setSearchQuery("");
    setDebouncedSearch("");
  };

  const todayTotal = useMemo(
    () => (todaySales || []).reduce((s, o) => s + parseFloat(o.totalAmount), 0),
    [todaySales]
  );

  const payLabel: Record<string, string> = { cash: "Наличные", card: "Карта", transfer: "Перевод", other: "Другое" };

  return (
    <div className="shop-sales">
      <style>{shopSalesStyles}</style>

      {/* Header */}
      <div className="section-header-main">
        <div>
          <h2 className="page-title">Продажи</h2>
          <p className="page-subtitle">Оформление и история продаж</p>
        </div>
        {activeTab === "sale" && !isCreating && (
          <button className="ss-btn ss-btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={18} /> Новая продажа
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      {!isCreating && (
        <div className="st-page-tabs">
          <button
            className={`st-page-tab ${activeTab === "sale" ? "st-page-tab-active" : ""}`}
            onClick={() => setActiveTab("sale")}
          >
            Продажа
          </button>
          <button
            className={`st-page-tab ${activeTab === "history" ? "st-page-tab-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            История продаж
          </button>
        </div>
      )}

      {/* ===== SALE TAB ===== */}
      {activeTab === "sale" && (
        <>
          {/* Search existing orders */}
          {!isCreating && (
            <div className="ss-search-section">
              <div className="ss-search-box">
                <Search size={18} className="ss-search-icon" />
                <input
                  type="text"
                  className="ss-search-input"
                  placeholder="Поиск заказа: телефон, имя или номер заказа..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {searchQuery && (
                  <button className="ss-search-clear" onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }}>
                    <X size={16} />
                  </button>
                )}
              </div>

              {debouncedSearch && searchResults && searchResults.length > 0 && (
                <div className="ss-search-results">
                  <div className="ss-results-title">Найденные заказы ({searchResults.length})</div>
                  {searchResults.map((order) => (
                    <div key={order.id} className="ss-order-card">
                      <div className="ss-order-info">
                        <div className="ss-order-top">
                          <span className="ss-order-id">#{order.id}</span>
                          <span className="ss-order-status ss-status-processing">В работе</span>
                          <span className="ss-order-source">{order.source === "website" ? "Сайт" : "Магазин"}</span>
                        </div>
                        <div className="ss-order-customer">{order.customerName} — {order.customerPhone}</div>
                        <div className="ss-order-details">
                          {order.itemsCount} поз. · {parseFloat(order.totalAmount).toLocaleString("ru-RU")} ₽ · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                      <button className="ss-btn ss-btn-success" onClick={() => handleStartCompleteOrder(order.id)}>
                        <Check size={16} /> Оформить
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {debouncedSearch && searchResults && searchResults.length === 0 && (
                <div className="ss-empty">Заказы не найдены</div>
              )}

              {/* Today summary */}
              <div className="ss-today-summary">
                <div className="ss-today-summary-icon"><ShoppingCart size={18} /></div>
                <span>Сегодня: <strong>{(todaySales || []).length}</strong> продаж на <strong>{todayTotal.toLocaleString("ru-RU")} ₽</strong></span>
              </div>
            </div>
          )}


          {/* New sale form */}
          {isCreating && (
            <div className="ss-new-sale">
              <div className="ss-form-header">
                <h3>{prefillActive ? `Оформление заказа #${prefillOrderId}` : completingOrderId ? `Оформление заказа #${completingOrderId}` : "Новая продажа"}</h3>
                <button className="ss-btn ss-btn-ghost" onClick={() => { resetForm(); if (onPrefillComplete) onPrefillComplete(); }}><X size={18} /> Отмена</button>
              </div>

              <div className="ss-section">
                <div className="ss-section-title"><User size={16} /> Клиент</div>
                <div className="ss-customer-search" ref={customerSearchRef}>
                  <input type="text" className="ss-input" placeholder="Поиск клиента по имени или телефону..." value={customerSearch} onChange={(e) => handleCustomerSearchChange(e.target.value)} />
                  {showCustomerResults && customerResults && customerResults.length > 0 && (
                    <div className="ss-dropdown">
                      {customerResults.map((c) => (
                        <button key={c.id} className="ss-dropdown-item" onClick={() => selectCustomer(c)}>
                          <span>{c.name || "—"}</span>
                          <span className="ss-dropdown-sub">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ss-customer-fields">
                  <input type="text" className="ss-input" placeholder="Имя (необязательно)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  <input type="text" className="ss-input" placeholder="Телефон (необязательно)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
              </div>

              <div className="ss-section">
                <div className="ss-section-title"><ShoppingCart size={16} /> Товары</div>
                <div className="ss-product-search" ref={productSearchRef} style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <input type="text" className="ss-input" style={{ flex: 1, minWidth: 0 }} placeholder="Поиск товара / штрихкод..." value={productSearch} onChange={(e) => handleProductSearchChange(e.target.value)} />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    style={{ background: "#C75D3C", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
                    title="Сканировать штрихкод"
                  >
                    <Camera size={18} />
                  </button>
                  {showProductResults && productResults && productResults.length > 0 && (
                    <div className="ss-dropdown">
                      {productResults.map((p) => (
                        <button key={p.id} className="ss-dropdown-item ss-dropdown-with-img" onClick={() => addToCart(p)}>
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="ss-dropdown-thumb" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="ss-dropdown-thumb-empty"><Package size={16} /></div>
                          )}
                          <div>
                            <span>{p.name}</span>
                            <span className="ss-dropdown-sub">{p.article} · {p.priceMin ? `от ${parseFloat(p.priceMin).toLocaleString("ru-RU")} ₽` : "—"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="ss-cart">
                    <div className="ss-cart-header">
                      <span>Товар</span><span>Кол-во</span><span>Цена</span><span>Итого</span><span></span>
                    </div>
                    {cart.map((item) => (
                      <div key={item.productArticle} className="ss-cart-row">
                        <div className="ss-cart-name">
                          {item.image && (
                            <div className="ss-cart-img-wrap">
                              <img src={item.image} alt="" className="ss-cart-img" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                              <div className="ss-cart-img-zoom"><img src={item.image} alt={item.productName} /></div>
                            </div>
                          )}
                          <div>
                            <span>{item.productName}</span>
                            <span className="ss-cart-article">{item.productArticle}</span>
                          </div>
                        </div>
                        <div className="ss-cart-qty">
                          <button className="ss-qty-btn" onClick={() => updateCartItem(item.productArticle, "quantity", Math.max(1, item.quantity - 1))}><Minus size={14} /></button>
                          <input type="number" className="ss-qty-input" value={item.quantity} min={1} onChange={(e) => updateCartItem(item.productArticle, "quantity", parseInt(e.target.value) || 1)} />
                          <button className="ss-qty-btn" onClick={() => updateCartItem(item.productArticle, "quantity", item.quantity + 1)}><Plus size={14} /></button>
                        </div>
                        <input type="number" className="ss-price-input" value={item.price} onChange={(e) => updateCartItem(item.productArticle, "price", e.target.value)} />
                        <span className="ss-cart-total">{(parseFloat(item.price) * item.quantity).toLocaleString("ru-RU")} ₽</span>
                        <button className="ss-cart-remove" onClick={() => removeFromCart(item.productArticle)}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ss-section">
                <div className="ss-section-title"><CreditCard size={16} /> Оплата</div>
                <div className="ss-payment-pills">
                  {paymentMethods.map((pm) => (
                    <button key={pm.id} className={`ss-payment-pill ${paymentMethod === pm.id ? "active" : ""}`} onClick={() => setPaymentMethod(pm.id)}>
                      <pm.icon size={16} /> {pm.label}
                    </button>
                  ))}
                </div>
                {paymentMethod === "cash" && cart.length > 0 && (
                  <div className="ss-cash-change">
                    <div className="ss-cash-row">
                      <label className="ss-label">Сколько дал клиент:</label>
                      <input
                        type="number"
                        className="ss-input ss-cash-input"
                        placeholder="0"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                      />
                    </div>
                    {cashChange !== null && (
                      <div className="ss-cash-result">
                        Сдача: <strong>{cashChange.toLocaleString("ru-RU")} ₽</strong>
                      </div>
                    )}
                    {cashGiven && parseFloat(cashGiven) < cartTotal && (
                      <div className="ss-cash-warn">Недостаточно средств</div>
                    )}
                  </div>
                )}
              </div>

              <div className="ss-submit-bar">
                <div className="ss-submit-total">
                  Итого: <strong>{cartTotal.toLocaleString("ru-RU")} ₽</strong>
                  <span className="ss-submit-count">{cart.reduce((s, i) => s + i.quantity, 0)} поз.</span>
                </div>
                <button className="ss-btn ss-btn-primary ss-btn-lg" disabled={(prefillActive ? completeSaleMutation.isPending : createSaleMutation.isPending) || cart.length === 0} onClick={handleCreateSale}>
                  {(prefillActive ? completeSaleMutation.isPending : createSaleMutation.isPending) ? "Оформление..." : "Оформить продажу"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeTab === "history" && (
        <>
          <div className="ss-history-filters">
            <PeriodSelector defaultPreset="30d" onChange={handleHistoryPeriod} />
            <div className="ss-history-filters-row">
              <div className="ss-search-box ss-history-search">
                <Search size={16} className="ss-search-icon" />
                <input
                  type="text"
                  className="ss-search-input"
                  placeholder="Поиск: клиент, телефон, номер..."
                  value={historySearch}
                  onChange={(e) => handleHistorySearchChange(e.target.value)}
                />
                {historySearch && (
                  <button className="ss-search-clear" onClick={() => { setHistorySearch(""); setDebouncedHistorySearch(""); setHistoryPage(1); }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="ss-history-pay-filter">
                {([
                  { id: "all", label: "Все" },
                  { id: "cash", label: "Наличные" },
                  { id: "card", label: "Карта" },
                  { id: "transfer", label: "Перевод" },
                ] as const).map((f) => (
                  <button key={f.id} className={`ss-filter-pill ${historyPayment === f.id ? "active" : ""}`} onClick={() => { setHistoryPayment(f.id); setHistoryPage(1); }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ss-history-summary">
            <div className="ss-history-summary-item">
              <span className="ss-history-summary-label">Продаж</span>
              <strong>{recentSalesData?.total || 0}</strong>
            </div>
            <div className="ss-history-summary-item">
              <span className="ss-history-summary-label">Сумма</span>
              <strong className="ss-history-summary-amount">{(recentSalesData?.totalAmount || 0).toLocaleString("ru-RU")} ₽</strong>
            </div>
          </div>

          <div className="ss-history">
            {(recentSalesData?.sales || []).length === 0 ? (
              <div className="ss-empty">Продаж за выбранный период нет</div>
            ) : (
              <>
                <div className="ss-history-table">
                  <div className="ss-history-thead">
                    <span>№</span><span>Клиент</span><span>Позиций</span><span>Оплата</span><span>Дата</span><span>Сумма</span>
                  </div>
                  {(recentSalesData?.sales || []).map((sale) => (
                    <div key={sale.id} className="ss-history-row ss-history-clickable" onClick={() => setViewingSaleId(sale.id)}>
                      <span className="ss-history-id">#{sale.id}</span>
                      <span className="ss-history-customer">{sale.customerName}</span>
                      <span className="ss-history-items">{sale.itemsCount} шт.</span>
                      <span className="ss-history-payment">{payLabel[sale.paymentMethod || "cash"] || "—"}</span>
                      <span className="ss-history-date">
                        {new Date(sale.createdAt).toLocaleDateString("ru-RU")}{" "}
                        <span className="ss-history-time">{new Date(sale.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      <span className="ss-history-amount">{parseFloat(sale.totalAmount).toLocaleString("ru-RU")} ₽</span>
                    </div>
                  ))}
                </div>

                {(recentSalesData?.total || 0) > historyLimit && (
                  <div className="ss-pagination">
                    <button className="ss-btn ss-btn-ghost ss-btn-sm" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft size={16} /> Назад
                    </button>
                    <span className="ss-pagination-info">{historyPage} / {Math.ceil((recentSalesData?.total || 0) / historyLimit)}</span>
                    <button className="ss-btn ss-btn-ghost ss-btn-sm" disabled={historyPage >= Math.ceil((recentSalesData?.total || 0) / historyLimit)} onClick={() => setHistoryPage((p) => p + 1)}>
                      Вперёд <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Sale details dialog */}
      {viewingSaleId && (
        <div className="ss-overlay" onClick={() => setViewingSaleId(null)}>
          <div className="ss-detail-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ss-detail-header">
              <h3><Eye size={18} /> Продажа #{viewingSaleId}</h3>
              <button className="ss-detail-close" onClick={() => setViewingSaleId(null)}><X size={18} /></button>
            </div>
            {saleDetails ? (
              <>
                <div className="ss-detail-meta">
                  <div className="ss-detail-meta-row"><span className="ss-detail-label">Клиент</span><span className="ss-detail-value">{saleDetails.customerName || "Неизвестный клиент"}</span></div>
                  <div className="ss-detail-meta-row"><span className="ss-detail-label">Телефон</span><span className="ss-detail-value">{saleDetails.customerPhone || "—"}</span></div>
                  <div className="ss-detail-meta-row"><span className="ss-detail-label">Дата</span><span className="ss-detail-value">{new Date(saleDetails.createdAt).toLocaleDateString("ru-RU")} {new Date(saleDetails.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div>
                  <div className="ss-detail-meta-row"><span className="ss-detail-label">Оплата</span><span className="ss-detail-value">{payLabel[saleDetails.paymentMethod || "cash"] || "—"}</span></div>
                  {saleDetails.comment && (<div className="ss-detail-meta-row"><span className="ss-detail-label">Комментарий</span><span className="ss-detail-value">{saleDetails.comment}</span></div>)}
                </div>

                <div className="ss-detail-items-title"><Package size={16} /> Товары</div>
                {saleDetails.items && saleDetails.items.length > 0 ? (
                  <div className="ss-detail-items">
                    <div className="ss-detail-items-head"><span>Товар</span><span>Кол-во</span><span>Цена</span><span>Сумма</span></div>
                    {saleDetails.items.map((item: any, idx: number) => (
                      <div key={idx} className="ss-detail-item-row">
                        <div className="ss-detail-item-name"><span>{item.productName}</span><span className="ss-detail-item-article">{item.productArticle}</span></div>
                        <span className="ss-detail-item-qty">{item.quantity}</span>
                        <span className="ss-detail-item-price">{parseFloat(item.price).toLocaleString("ru-RU")} ₽</span>
                        <span className="ss-detail-item-total">{(parseFloat(item.price) * item.quantity).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ))}
                  </div>
                ) : (<div className="ss-empty">Нет позиций</div>)}

                <div className="ss-detail-total-bar"><span>Итого</span><strong>{parseFloat(saleDetails.totalAmount).toLocaleString("ru-RU")} ₽</strong></div>
              </>
            ) : (<div className="ss-empty">Загрузка...</div>)}
          </div>
        </div>
      )}

      {/* Rating dialog */}
      {ratingDialog && (
        <div className="ss-overlay" onClick={closeRatingDialog}>
          <div className="ss-rating-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ss-rating-header">
              <h3><Star size={18} /> Оцените клиента</h3>
              <button className="ss-detail-close" onClick={closeRatingDialog}><X size={18} /></button>
            </div>
            <p className="ss-rating-subtitle">Продажа #{ratingDialog.orderId} — необязательно</p>

            <div className="ss-rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`ss-star ${star <= (ratingHover || ratingValue) ? "ss-star-filled" : ""}`}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => setRatingValue(star)}
                >
                  <Star size={28} fill={star <= (ratingHover || ratingValue) ? "#F59E0B" : "none"} />
                </button>
              ))}
            </div>

            <div className="ss-rating-tags">
              {ratingTags.map((tag) => (
                <button
                  key={tag}
                  className={`ss-rating-tag ${ratingSelectedTags.includes(tag) ? "active" : ""}`}
                  onClick={() => setRatingSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea
              className="ss-input ss-textarea"
              placeholder="Комментарий (необязательно)"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              rows={2}
            />

            <div className="ss-dialog-actions">
              <button className="ss-btn ss-btn-ghost" onClick={closeRatingDialog}>Пропустить</button>
              <button
                className="ss-btn ss-btn-primary"
                disabled={ratingValue === 0 || rateCustomerMutation.isPending}
                onClick={handleSubmitRating}
              >
                {rateCustomerMutation.isPending ? "..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowBarcodeScanner(false)} />
        </Suspense>
      )}

      {/* Act document dialog */}
      {actHtml && (
        <div className="ss-overlay" onClick={() => setActHtml(null)}>
          <div className="ss-detail-dialog" style={{ maxWidth: 420, padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "#2D2A26", marginBottom: 6 }}>Акт выполненных работ</h3>
            <p style={{ fontSize: 13, color: "#8B7E74", marginBottom: 20 }}>Акт сформирован. Выберите действие:</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="ss-btn"
                style={{ flex: 1, border: "1px solid #E8CCBF", color: "#C75D3C", background: "#fff" }}
                onClick={() => { openActDoc("open"); }}
              >
                Сохранить в PDF
              </button>
              <button
                className="ss-btn ss-btn-primary"
                style={{ flex: 1 }}
                onClick={() => { openActDoc("print"); }}
              >
                Печать
              </button>
            </div>
            <button
              className="ss-btn"
              style={{ width: "100%", marginTop: 8, border: "1px solid #E8E4DF", color: "#6B6560", background: "#fff" }}
              onClick={() => setActHtml(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const shopSalesStyles = `
.shop-sales { display: flex; flex-direction: column; gap: 24px; }

.ss-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.ss-btn-primary { background: #C75D3C; color: white; }
.ss-btn-primary:hover { background: #B5502F; }
.ss-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ss-btn-success { background: #10B981; color: white; }
.ss-btn-success:hover { background: #059669; }
.ss-btn-success:disabled { opacity: 0.5; cursor: not-allowed; }
.ss-btn-ghost { background: transparent; color: #6B5E54; border: 1px solid #E8E4DF; }
.ss-btn-ghost:hover { background: #F5F0EB; }
.ss-btn-lg { padding: 12px 24px; font-size: 16px; }

.ss-search-section { display: flex; flex-direction: column; gap: 16px; }
.ss-search-box { position: relative; display: flex; align-items: center; }
.ss-search-icon { position: absolute; left: 14px; color: #B5B0AA; pointer-events: none; }
.ss-search-input { width: 100%; padding: 12px 40px 12px 42px; border: 1px solid #E8E4DF; border-radius: 10px; font-size: 15px; background: white; outline: none; transition: border-color 0.2s; color: #3D3530; }
.ss-search-input::placeholder { color: #B5B0AA; }
.ss-search-input:focus { border-color: #C75D3C; }
.ss-search-clear { position: absolute; right: 12px; background: none; border: none; cursor: pointer; color: #B5B0AA; padding: 4px; }

.ss-search-results { display: flex; flex-direction: column; gap: 8px; }
.ss-results-title { font-size: 13px; font-weight: 600; color: #6B5E54; }

.ss-order-card { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: white; border: 1px solid #E8E4DF; border-radius: 10px; gap: 16px; }
.ss-order-info { flex: 1; }
.ss-order-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.ss-order-id { font-weight: 600; color: #3D3530; font-size: 14px; }
.ss-order-status { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 20px; }
.ss-status-new, .ss-status-processing { background: #FFF7ED; color: #D97706; }
.ss-order-source { font-size: 11px; color: #B5B0AA; background: #F5F0EB; padding: 2px 8px; border-radius: 20px; }
.ss-order-customer { font-size: 14px; color: #3D3530; }
.ss-order-details { font-size: 12px; color: #9A938C; margin-top: 2px; }

.ss-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.ss-dialog { background: white; border-radius: 14px; padding: 24px; width: 400px; max-width: 90vw; }
.ss-dialog h3 { margin: 0 0 16px; font-size: 18px; color: #3D3530; }
.ss-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

.ss-new-sale { display: flex; flex-direction: column; gap: 20px; }
.ss-form-header { display: flex; justify-content: space-between; align-items: center; }
.ss-form-header h3 { margin: 0; font-size: 18px; color: #3D3530; }

.ss-section { background: white; border: 1px solid #E8E4DF; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.ss-section-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #3D3530; }

.ss-input { width: 100%; padding: 10px 14px; border: 1px solid #E8E4DF; border-radius: 8px; font-size: 14px; outline: none; background: #FAF8F5; box-sizing: border-box; color: #3D3530; }
.ss-input:focus { border-color: #C75D3C; background: white; color: #3D3530; }
.ss-input::placeholder { color: #B5B0AA; }
.ss-textarea { resize: vertical; font-family: inherit; }
.ss-label { font-size: 13px; font-weight: 500; color: #6B5E54; margin-bottom: 4px; display: block; }

.ss-customer-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ss-customer-search { position: relative; }

.ss-product-search { position: relative; }
.ss-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #E8E4DF; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); z-index: 50; max-height: 240px; overflow-y: auto; margin-top: 4px; }
.ss-dropdown-item { display: flex; flex-direction: column; width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #3D3530; }
.ss-dropdown-item:hover { background: #FFF7ED; }
.ss-dropdown-sub { font-size: 12px; color: #9A938C; }
.ss-dropdown-with-img { flex-direction: row; align-items: center; gap: 10px; }
.ss-dropdown-with-img > div { display: flex; flex-direction: column; }
.ss-dropdown-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid #E8E4DF; flex-shrink: 0; background: #FAF8F5; }
.ss-dropdown-thumb-empty { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #E8E4DF; flex-shrink: 0; background: #F5F0EB; color: #B5B0AA; }

.ss-cart { border: 1px solid #E8E4DF; border-radius: 8px; overflow: visible; }
.ss-cart-header { display: grid; grid-template-columns: 2fr 120px 100px 100px 36px; padding: 8px 12px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 8px 8px 0 0; }
.ss-cart-row { display: grid; grid-template-columns: 2fr 120px 100px 100px 36px; padding: 10px 12px; align-items: center; border-top: 1px solid #F0EDE8; position: relative; }
.ss-cart-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ss-cart-name > div:last-child { min-width: 0; }
.ss-cart-name > div:last-child span:first-child { font-size: 14px; color: #3D3530; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-cart-article { font-size: 11px; color: #9A938C; }
.ss-cart-img-wrap { position: relative; flex-shrink: 0; width: 40px; height: 40px; z-index: 10; }
.ss-cart-img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #E8E4DF; cursor: pointer; }
.ss-cart-img-zoom { display: none; position: absolute; left: 48px; top: 50%; transform: translateY(-50%); z-index: 200; background: white; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.22); padding: 4px; pointer-events: none; }
.ss-cart-img-zoom img { width: 220px; height: 220px; object-fit: cover; border-radius: 8px; display: block; }
.ss-cart-img-wrap:hover .ss-cart-img-zoom { display: block; }
.ss-cart-qty { display: flex; align-items: center; gap: 4px; }
.ss-qty-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid #E8E4DF; border-radius: 6px; background: white; cursor: pointer; color: #6B5E54; }
.ss-qty-btn:hover { background: #F5F0EB; }
.ss-qty-input { width: 40px; text-align: center; border: 1px solid #E8E4DF; border-radius: 6px; padding: 4px; font-size: 14px; color: #3D3530; }
.ss-price-input { width: 90px; border: 1px solid #E8E4DF; border-radius: 6px; padding: 6px 8px; font-size: 14px; text-align: right; color: #3D3530; }
.ss-cart-total { font-size: 14px; font-weight: 600; color: #3D3530; text-align: right; }
.ss-cart-remove { background: none; border: none; cursor: pointer; color: #B5B0AA; padding: 4px; }
.ss-cart-remove:hover { color: #E53E3E; }

.ss-payment-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.ss-payment-pill { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid #E8E4DF; border-radius: 8px; background: white; cursor: pointer; font-size: 14px; color: #6B5E54; transition: all 0.2s; }
.ss-payment-pill:hover { border-color: #C75D3C; }
.ss-payment-pill.active { border-color: #C75D3C; background: #FFF7ED; color: #C75D3C; font-weight: 500; }
.ss-payment-select { margin-bottom: 8px; }

/* Cash change */
.ss-cash-change { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: #FAF8F5; border-radius: 8px; border: 1px solid #E8E4DF; }
.ss-cash-row { display: flex; align-items: center; gap: 12px; }
.ss-cash-row .ss-label { margin-bottom: 0; white-space: nowrap; }
.ss-cash-input { width: 140px !important; flex-shrink: 0; text-align: right; font-size: 16px !important; font-weight: 500; }
.ss-cash-result { font-size: 16px; color: #10B981; font-weight: 600; }
.ss-cash-result strong { font-size: 18px; }
.ss-cash-warn { font-size: 13px; color: #E53E3E; }

.ss-submit-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: white; border: 1px solid #E8E4DF; border-radius: 12px; }
.ss-submit-total { font-size: 18px; color: #3D3530; }
.ss-submit-total strong { font-size: 22px; }
.ss-submit-count { font-size: 13px; color: #9A938C; margin-left: 8px; }

.ss-today-summary { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; font-size: 14px; color: #166534; }
.ss-today-summary-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #DCFCE7; border-radius: 8px; color: #16A34A; }
.ss-today-summary strong { font-weight: 700; }

/* History filters */
.ss-history-filters { display: flex; flex-direction: column; gap: 12px; }
.ss-history-filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.ss-history-search { flex: 1; min-width: 200px; }
.ss-history-pay-filter { display: flex; gap: 6px; flex-wrap: wrap; }
.ss-filter-pill { padding: 6px 14px; border: 1px solid #E8E4DF; border-radius: 20px; background: white; font-size: 13px; color: #6B5E54; cursor: pointer; transition: all 0.2s; }
.ss-filter-pill:hover { border-color: #C75D3C; }
.ss-filter-pill.active { border-color: #C75D3C; background: #FFF7ED; color: #C75D3C; font-weight: 500; }

/* History summary */
.ss-history-summary { display: flex; gap: 16px; }
.ss-history-summary-item { flex: 1; padding: 14px 18px; background: white; border: 1px solid #E8E4DF; border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.ss-history-summary-label { font-size: 12px; color: #9A938C; text-transform: uppercase; letter-spacing: 0.04em; }
.ss-history-summary-item strong { font-size: 20px; color: #3D3530; }
.ss-history-summary-amount { color: #10B981 !important; }

.ss-history { background: white; border: 1px solid #E8E4DF; border-radius: 12px; padding: 16px; }
.ss-history-table { border: 1px solid #F0EDE8; border-radius: 8px; overflow: hidden; }
.ss-history-thead { display: grid; grid-template-columns: 60px 1.5fr 80px 100px 130px 100px; padding: 8px 12px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; text-transform: uppercase; letter-spacing: 0.04em; }
.ss-history-row { display: grid; grid-template-columns: 60px 1.5fr 80px 100px 130px 100px; padding: 10px 12px; border-top: 1px solid #F0EDE8; align-items: center; transition: background 0.15s; }
.ss-history-row:hover { background: #FAF8F5; }
.ss-history-clickable { cursor: pointer; }
.ss-history-id { font-weight: 600; color: #3D3530; font-size: 13px; }
.ss-history-customer { font-size: 14px; color: #3D3530; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-history-items { font-size: 13px; color: #6B5E54; }
.ss-history-payment { font-size: 12px; color: #9A938C; }
.ss-history-date { font-size: 13px; color: #6B5E54; }
.ss-history-time { color: #B5B0AA; }
.ss-history-amount { font-size: 14px; font-weight: 600; color: #10B981; text-align: right; }

.ss-pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 12px; }
.ss-pagination-info { font-size: 13px; color: #6B5E54; }
.ss-btn-sm { padding: 6px 12px; font-size: 13px; }

.ss-empty { text-align: center; padding: 24px; color: #9A938C; font-size: 14px; }

.ss-detail-dialog { background: white; border-radius: 14px; padding: 24px; width: 560px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.ss-detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ss-detail-header h3 { margin: 0; font-size: 18px; color: #3D3530; display: flex; align-items: center; gap: 8px; }
.ss-detail-close { background: none; border: none; cursor: pointer; color: #9A938C; padding: 4px; border-radius: 6px; transition: all 0.15s; }
.ss-detail-close:hover { background: #F5F0EB; color: #3D3530; }

.ss-detail-meta { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: #FAF8F5; border-radius: 10px; margin-bottom: 16px; }
.ss-detail-meta-row { display: flex; justify-content: space-between; align-items: center; }
.ss-detail-label { font-size: 13px; color: #9A938C; }
.ss-detail-value { font-size: 14px; color: #3D3530; font-weight: 500; }

.ss-detail-items-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #3D3530; margin-bottom: 8px; }
.ss-detail-items { border: 1px solid #F0EDE8; border-radius: 8px; overflow: hidden; }
.ss-detail-items-head { display: grid; grid-template-columns: 2fr 70px 90px 90px; padding: 8px 12px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; text-transform: uppercase; letter-spacing: 0.04em; }
.ss-detail-item-row { display: grid; grid-template-columns: 2fr 70px 90px 90px; padding: 10px 12px; border-top: 1px solid #F0EDE8; align-items: center; }
.ss-detail-item-name span:first-child { display: block; font-size: 14px; color: #3D3530; }
.ss-detail-item-article { font-size: 11px; color: #9A938C; }
.ss-detail-item-qty { font-size: 14px; color: #6B5E54; text-align: center; }
.ss-detail-item-price { font-size: 14px; color: #6B5E54; text-align: right; }
.ss-detail-item-total { font-size: 14px; font-weight: 600; color: #3D3530; text-align: right; }

.ss-detail-total-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: linear-gradient(135deg, #C75D3C 0%, #E27D60 100%); border-radius: 10px; margin-top: 16px; color: white; font-size: 16px; }
.ss-detail-total-bar strong { font-size: 20px; }

/* Rating dialog */
.ss-rating-dialog { background: white; border-radius: 14px; padding: 24px; width: 440px; max-width: 90vw; }
.ss-rating-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.ss-rating-header h3 { margin: 0; font-size: 18px; color: #3D3530; display: flex; align-items: center; gap: 8px; }
.ss-rating-subtitle { font-size: 13px; color: #9A938C; margin: 0 0 16px; }
.ss-rating-stars { display: flex; gap: 6px; justify-content: center; margin-bottom: 16px; }
.ss-star { background: none; border: none; cursor: pointer; padding: 4px; color: #D1CCC6; transition: all 0.15s; border-radius: 4px; }
.ss-star:hover { transform: scale(1.15); }
.ss-star-filled { color: #F59E0B; }
.ss-rating-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.ss-rating-tag { padding: 5px 12px; border: 1px solid #E8E4DF; border-radius: 20px; background: white; font-size: 13px; color: #6B5E54; cursor: pointer; transition: all 0.2s; }
.ss-rating-tag:hover { border-color: #C75D3C; }
.ss-rating-tag.active { border-color: #C75D3C; background: #FFF7ED; color: #C75D3C; font-weight: 500; }

@media (max-width: 768px) {
  .ss-cart-header, .ss-cart-row { grid-template-columns: 1.5fr 100px 80px 80px 32px; }
  .ss-customer-fields { grid-template-columns: 1fr; }
  .ss-history-thead, .ss-history-row { grid-template-columns: 50px 1fr 70px 100px; }
  .ss-history-payment, .ss-history-items { display: none; }
  .ss-history-filters-row { flex-direction: column; }
  .ss-history-search { width: 100%; }
  .ss-tabs { flex-wrap: wrap; gap: 4px; }
  .ss-tab { padding: 6px 12px; font-size: 12px; }
  .ss-new-sale-form { padding: 16px; }
  .ss-form-header h3 { font-size: 16px; }
  .ss-product-search-wrap { flex-direction: column; }
  .ss-product-search-wrap input { width: 100%; }
  .ss-cart-header { font-size: 11px; padding: 6px 8px; }
  .ss-cart-row { padding: 6px 8px; font-size: 12px; }
  .ss-cart-footer { padding: 10px 8px; }
  .ss-payment-pills { flex-wrap: wrap; }
  .ss-payment-pill { padding: 6px 10px; font-size: 12px; }
  .ss-btn { padding: 8px 14px; font-size: 13px; }
  .ss-btn-lg { padding: 10px 16px; }
  .ss-today-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
  .ss-today-stat { padding: 12px; }
  .ss-today-value { font-size: 18px; }
  .ss-detail-dialog { max-width: 95vw; margin: 8px; padding: 16px; }
  .ss-detail-items-head, .ss-detail-items-row { font-size: 11px; }
}

@media (max-width: 480px) {
  .ss-cart-header, .ss-cart-row { grid-template-columns: 1fr 60px 60px 28px; }
  .ss-cart-header > :nth-child(3), .ss-cart-row > :nth-child(3) { display: none; }
  .ss-today-stats { grid-template-columns: 1fr; }
  .ss-history-thead, .ss-history-row { grid-template-columns: 50px 1fr 80px; }
  .ss-history-date { display: none; }
}
`;
