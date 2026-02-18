import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import PeriodSelector, { usePeriod } from "@/components/admin/PeriodSelector";
import {
  ShoppingCart,
  MessageSquare,
  RefreshCw,
  Trash2,
  UserSquare2,
  Boxes,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
  ExternalLink,
  Wallet,
  Warehouse,
  Plus,
  FileText,
  Search,
  X,
  Minus,
  Menu,
  Camera,
} from "lucide-react";
import CRMTab from "@/components/admin/CRMTab";
import CatalogTab from "@/components/admin/CatalogTab";
import FinanceTab from "@/components/admin/FinanceTab";
import ShopSalesTab from "@/components/admin/ShopSalesTab";
import DashboardTab from "@/components/admin/DashboardTab";
import SettingsTab from "@/components/admin/SettingsTab";
import WarehouseTab from "@/components/admin/WarehouseTab";
import AdminLogin from "@/pages/AdminLogin";
import { useAdminAuth } from "@/hooks/useAdminAuth";
const BarcodeScanner = lazy(() => import("@/components/admin/BarcodeScanner"));

const statusLabels: Record<string, string> = {
  processing: "В работе",
  completed: "Выполнен",
  cancelled: "Отменен",
  new: "В работе",
};

const statusStyles: Record<string, string> = {
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  new: "bg-amber-50 text-amber-700 border-amber-200",
};

type ActiveSection = "dashboard" | "orders" | "finance" | "crm" | "catalog" | "requests" | "settings" | "shop-sales" | "warehouse";

interface NavGroup {
  label: string;
  items: { id: ActiveSection; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Общее",
    items: [
      { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
    ],
  },
  {
    label: "Сайт",
    items: [
      { id: "orders", label: "Заказы", icon: ShoppingCart },
      { id: "requests", label: "Заявки", icon: MessageSquare },
    ],
  },
  {
    label: "Магазин",
    items: [
      { id: "shop-sales", label: "Продажи", icon: ShoppingCart },
      { id: "crm", label: "Клиенты", icon: UserSquare2 },
      { id: "warehouse", label: "Склад", icon: Warehouse },
    ],
  },
  {
    label: "Управление",
    items: [
      { id: "finance", label: "Финансы", icon: Wallet },
      { id: "catalog", label: "Каталог", icon: Boxes },
      { id: "settings", label: "Настройки", icon: Settings },
    ],
  },
];

const allMenuItems = navGroups.flatMap((g) => g.items);

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAuthenticated: adminAuthed, isLoading: adminAuthLoading, logout: adminLogout, login: adminLogin } = useAdminAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [orderStatus, setOrderStatus] = useState<"all" | "processing" | "completed" | "cancelled">("processing");
  const [ordersPage, setOrdersPage] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [prefillOrderId, setPrefillOrderId] = useState<number | null>(null);

  // New order dialog state
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderName, setNewOrderName] = useState("");
  const [newOrderPhone, setNewOrderPhone] = useState("");
  const [newOrderComment, setNewOrderComment] = useState("");
  const [newOrderCart, setNewOrderCart] = useState<{ productName: string; productArticle: string; productCategory?: string; quantity: number; price: string }[]>([]);
  const [newOrderProductSearch, setNewOrderProductSearch] = useState("");
  const [newOrderCustomerSearch, setNewOrderCustomerSearch] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Invoice dialog state
  const [invoiceOrderId, setInvoiceOrderId] = useState<number | null>(null);
  const [invoiceBuyerName, setInvoiceBuyerName] = useState("");
  const [invoiceBuyerInn, setInvoiceBuyerInn] = useState("");
  const [invoiceBuyerKpp, setInvoiceBuyerKpp] = useState("");
  const [invoiceBuyerAddress, setInvoiceBuyerAddress] = useState("");

  // Period selectors
  const ordersPeriod = usePeriod("30d");

  const ordersDateRange = useMemo(() => ({
    dateFrom: ordersPeriod.range.dateFrom.toISOString(),
    dateTo: ordersPeriod.range.dateTo.toISOString(),
  }), [ordersPeriod.range]);

  const canAccess = adminAuthed || user?.role === "admin";

  const { data: allOrdersData, refetch: refetchAllOrders } = trpc.stats.allOrders.useQuery(
    { page: ordersPage, limit: 10, status: orderStatus, ...ordersDateRange },
    { enabled: canAccess }
  );

  const { data: ordersByStatus } = trpc.stats.ordersByStatus.useQuery({ ...ordersDateRange }, {
    enabled: canAccess,
  });

  const { data: orderDetails } = trpc.stats.orderDetails.useQuery(
    { orderId: selectedOrderId! },
    { enabled: canAccess && selectedOrderId !== null }
  );

  const { data: contactRequestsData, refetch: refetchContactRequests } = trpc.stats.contactRequests.useQuery(
    { page: 1, limit: 50 },
    { enabled: canAccess }
  );

  const updateRequestStatusMutation = trpc.stats.updateRequestStatus.useMutation({
    onSuccess: () => { refetchContactRequests(); refetchBadges(); toast.success("Статус обновлён"); },
  });
  const deleteRequestMutation = trpc.stats.deleteRequest.useMutation({
    onSuccess: () => { refetchContactRequests(); refetchBadges(); toast.success("Заявка удалена"); },
  });

  const { data: badgeCounts, refetch: refetchBadges } = trpc.stats.notificationCounts.useQuery(undefined, {
    enabled: canAccess,
    refetchInterval: 30000,
  });

  const { data: lowStockCount } = trpc.warehouse.lowStockCount.useQuery(undefined, {
    enabled: canAccess,
    refetchInterval: 60000,
  });

  const [requestFilter, setRequestFilter] = useState<"all" | "new" | "processed">("all");


  const updateStatusMutation = trpc.stats.updateOrderStatus.useMutation({
    onSuccess: () => {
      refetchAllOrders();
      refetchBadges();
    },
  });

  const deleteOrderMutation = trpc.stats.deleteOrder.useMutation({
    onSuccess: () => {
      toast.success("Заказ удалён");
      setSelectedOrderId(null);
      refetchAllOrders();
      refetchBadges();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Search queries for new order dialog
  const { data: productSearchResults } = trpc.shop.searchProducts.useQuery(
    { query: newOrderProductSearch },
    { enabled: canAccess && newOrderProductSearch.length >= 2 }
  );
  const { data: customerSearchResults } = trpc.shop.searchCustomers.useQuery(
    { query: newOrderCustomerSearch },
    { enabled: canAccess && newOrderCustomerSearch.length >= 2 }
  );

  const trpcUtils = trpc.useUtils();
  const handleBarcodeScan = useCallback(async (code: string) => {
    setShowBarcodeScanner(false);
    try {
      const product = await trpcUtils.shop.findByBarcode.fetch({ barcode: code });
      if (product) {
        const exists = newOrderCart.find((c) => c.productArticle === product.article);
        if (exists) {
          setNewOrderCart((prev) => prev.map((c) => c.productArticle === product.article ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
          setNewOrderCart((prev) => [...prev, {
            productName: product.name,
            productArticle: product.article,
            productCategory: product.category || undefined,
            quantity: 1,
            price: String(product.priceMin || product.priceMax || "0"),
          }]);
        }
        toast.success(`${product.name} добавлен`);
      } else {
        toast.error(`Товар не найден: ${code}`);
      }
    } catch {
      toast.error("Ошибка поиска по штрихкоду");
    }
  }, [newOrderCart, trpcUtils]);

  const createManualOrderMutation = trpc.stats.createManualOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Заказ #${data.orderId} создан`);
      setShowNewOrder(false);
      setNewOrderName(""); setNewOrderPhone(""); setNewOrderComment(""); setNewOrderCart([]);
      setNewOrderProductSearch(""); setNewOrderCustomerSearch("");
      refetchAllOrders();
      refetchBadges();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateInvoiceMutation = trpc.stats.generateInvoice.useMutation({
    onError: (err: any) => toast.error(err.message),
  });

  const handleCreateManualOrder = useCallback(() => {
    if (!newOrderName.trim() || !newOrderPhone.trim() || newOrderCart.length === 0) {
      toast.error("Заполните имя, телефон и добавьте товары");
      return;
    }
    createManualOrderMutation.mutate({
      customerName: newOrderName.trim(),
      customerPhone: newOrderPhone.trim(),
      comment: newOrderComment.trim() || undefined,
      items: newOrderCart,
    });
  }, [newOrderName, newOrderPhone, newOrderComment, newOrderCart]);

  const generateActMutation = trpc.stats.generateAct.useMutation({
    onSuccess: () => { refetchAllOrders(); },
    onError: (err: any) => toast.error(err.message),
  });

  const openHtmlDoc = useCallback((html: string, mode: "print" | "open") => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      if (mode === "print") setTimeout(() => win.print(), 300);
    }
  }, []);

  const handleGenerateInvoice = useCallback((mode: "print" | "open") => {
    if (!invoiceOrderId || !invoiceBuyerName.trim()) {
      toast.error("Укажите наименование покупателя");
      return;
    }
    generateInvoiceMutation.mutate({
      orderId: invoiceOrderId,
      buyerName: invoiceBuyerName.trim(),
      buyerInn: invoiceBuyerInn.trim() || undefined,
      buyerKpp: invoiceBuyerKpp.trim() || undefined,
      buyerAddress: invoiceBuyerAddress.trim() || undefined,
    }, {
      onSuccess: ({ invoiceHtml }) => {
        openHtmlDoc(invoiceHtml, mode);
        setInvoiceOrderId(null);
        setInvoiceBuyerName(""); setInvoiceBuyerInn(""); setInvoiceBuyerKpp(""); setInvoiceBuyerAddress("");
        refetchAllOrders();
        toast.success("Счёт выставлен");
      },
    });
  }, [invoiceOrderId, invoiceBuyerName, invoiceBuyerInn, invoiceBuyerKpp, invoiceBuyerAddress]);

  const handleCloseInvoice = useCallback(() => {
    setInvoiceOrderId(null);
    setInvoiceBuyerName(""); setInvoiceBuyerInn(""); setInvoiceBuyerKpp(""); setInvoiceBuyerAddress("");
  }, []);

  const handleRefreshAll = () => {
    refetchAllOrders();
    refetchContactRequests();
  };

  if (authLoading || adminAuthLoading) {
    return (
      <div className="admin-wrapper">
        <style>{adminStyles}</style>
        <div className="admin-loading">
          <div className="admin-loading-spinner" />
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <AdminLogin onSuccess={adminLogin} />;
  }

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="admin-content-inner">
            <DashboardTab />
          </div>
        );

      case "orders": {
        const cancelReasonPresets = ["Не актуально", "Клиент передумал", "Нет в наличии", "Дубль заказа"];
        const orderTabs: { key: typeof orderStatus; label: string; count?: number }[] = [
          { key: "processing", label: "В работе", count: (ordersByStatus?.processing || 0) + (ordersByStatus?.new || 0) },
          { key: "completed", label: "Выполнены", count: ordersByStatus?.completed || 0 },
          { key: "cancelled", label: "Отменены", count: ordersByStatus?.cancelled || 0 },
          { key: "all", label: "Все" },
        ];
        return (
          <div className="admin-content-inner">
            <div className="section-header-main">
              <div>
                <h2 className="page-title">Заказы</h2>
                <p className="page-subtitle">Всего: {allOrdersData?.total || 0}</p>
              </div>
              <button
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "#C75D3C", color: "white", fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setShowNewOrder(true)}
              >
                <Plus size={16} /> Новый заказ
              </button>
            </div>

            <PeriodSelector defaultPreset="30d" onChange={ordersPeriod.handleChange} />

            {/* Status Tabs */}
            <div className="st-page-tabs" style={{ marginBottom: 20 }}>
              {orderTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`st-page-tab ${orderStatus === tab.key ? "st-page-tab-active" : ""}`}
                  onClick={() => { setOrderStatus(tab.key); setOrdersPage(1); }}
                >
                  {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>

            <div className="orders-table">
              {allOrdersData?.orders && allOrdersData.orders.length > 0 ? (
                allOrdersData.orders.map((order) => (
                  <div key={order.id} className="order-card order-card-clickable" style={order.status === "completed" ? { borderColor: "#A7F3D0", background: "#FAFEFB" } : undefined} onClick={() => setSelectedOrderId(order.id)}>
                    <div className="order-card-header">
                      <div className="order-card-title">
                        <span className="order-id">Заказ #{order.id}</span>
                        <span className={`order-badge ${statusStyles[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                        {(order as any).isLegalEntity && (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                            Юр. лицо
                          </span>
                        )}
                        {(order as any).metadata?.invoice && (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }}>
                            Счёт выставлен
                          </span>
                        )}
                        {(order as any).metadata?.act && (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
                            Акт
                          </span>
                        )}
                      </div>
                      <div className="order-card-amount">
                        {parseFloat(order.totalAmount).toLocaleString("ru-RU")} ₽
                      </div>
                    </div>

                    <div className="order-card-body">
                      <div className="order-detail">
                        <span className="detail-label">Клиент</span>
                        <span className="detail-value">{order.customerName}</span>
                      </div>
                      <div className="order-detail">
                        <span className="detail-label">Телефон</span>
                        <span className="detail-value">{order.customerPhone}</span>
                      </div>
                      <div className="order-detail">
                        <span className="detail-label">Товаров</span>
                        <span className="detail-value">{order.itemsCount} шт.</span>
                      </div>
                      <div className="order-detail">
                        <span className="detail-label">Дата</span>
                        <span className="detail-value">{new Date(order.createdAt).toLocaleString("ru-RU")}</span>
                      </div>
                    </div>

                    {order.status !== "completed" && (
                    <div className="order-card-actions" onClick={(e) => e.stopPropagation()}>
                      {(order.status === "processing" || order.status === "new") && (
                        <>
                          <Button
                            size="sm"
                            className="action-btn action-btn-success"
                            onClick={() => {
                              setPrefillOrderId(order.id);
                              setActiveSection("shop-sales");
                            }}
                          >
                            Выполнить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="action-btn action-btn-danger"
                            onClick={() => { setCancellingOrderId(order.id); setCancelReason(""); }}
                          >
                            Отменить
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ color: "#C75D3C", borderColor: "#E8CCBF" }}
                        onClick={() => {
                          const inv = (order as any).metadata?.invoice;
                          setInvoiceOrderId(order.id);
                          setInvoiceBuyerName(inv?.buyerName || "");
                          setInvoiceBuyerInn(inv?.buyerInn || "");
                          setInvoiceBuyerKpp(inv?.buyerKpp || "");
                          setInvoiceBuyerAddress(inv?.buyerAddress || "");
                        }}
                      >
                        <FileText size={14} /> {(order as any).metadata?.invoice ? "Пересоздать счёт" : "Счёт"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ color: "#EF4444", borderColor: "#FECACA" }}
                        onClick={() => {
                          if (window.confirm(`Удалить заказ #${order.id}? Это действие нельзя отменить.`)) {
                            deleteOrderMutation.mutate({ orderId: order.id });
                          }
                        }}
                      >
                        <Trash2 size={14} /> Удалить
                      </Button>
                    </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state-large">
                  <ShoppingCart size={48} />
                  <p>Заказов не найдено</p>
                </div>
              )}
            </div>

            {allOrdersData && allOrdersData.total > 10 && (
              <div className="pagination">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                  disabled={ordersPage === 1}
                >
                  Назад
                </Button>
                <span className="pagination-info">
                  {ordersPage} / {Math.ceil(allOrdersData.total / 10)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrdersPage((p) => p + 1)}
                  disabled={ordersPage >= Math.ceil(allOrdersData.total / 10)}
                >
                  Вперед
                </Button>
              </div>
            )}

            {/* Order Details Dialog */}
            <Dialog open={selectedOrderId !== null} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
              <DialogContent className="dialog-content dialog-content-wide">
                <DialogHeader>
                  <DialogTitle className="order-detail-title">
                    Заказ #{orderDetails?.id}
                    {orderDetails && (
                      <span className={`order-badge ${statusStyles[orderDetails.status]}`}>
                        {statusLabels[orderDetails.status]}
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                {orderDetails && (
                  <div className="order-detail-body">
                    <div className="order-detail-info">
                      <div className="order-detail-row">
                        <span className="detail-label">Клиент</span>
                        <span className="detail-value">{orderDetails.customerName}</span>
                      </div>
                      <div className="order-detail-row">
                        <span className="detail-label">Телефон</span>
                        <span className="detail-value">{orderDetails.customerPhone}</span>
                      </div>
                      <div className="order-detail-row">
                        <span className="detail-label">Дата</span>
                        <span className="detail-value">{new Date(orderDetails.createdAt).toLocaleString("ru-RU")}</span>
                      </div>
                      {(orderDetails as any).isLegalEntity && (
                        <div className="order-detail-row">
                          <span className="detail-label">Тип</span>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                            Юр. лицо
                          </span>
                        </div>
                      )}
                    </div>

                    {orderDetails.comment && (
                      <div className="order-comment">{orderDetails.comment}</div>
                    )}

                    {/* Documents section */}
                    {((orderDetails as any).metadata?.invoice || (orderDetails as any).metadata?.act) && (
                      <div style={{ border: "1px solid #E8E4DF", borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#8B7E74", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Документы</div>
                        {(orderDetails as any).metadata?.invoice && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: (orderDetails as any).metadata?.act ? "1px solid #F5EDE6" : "none" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "#2D2A26" }}>
                                Счёт {(orderDetails as any).metadata.invoice.number}
                              </div>
                              <div style={{ fontSize: 12, color: "#8B7E74" }}>
                                от {(orderDetails as any).metadata.invoice.date} — {(orderDetails as any).metadata.invoice.buyerName}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8CCBF", background: "#fff", color: "#C75D3C", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); openHtmlDoc((orderDetails as any).metadata.invoice.html, "open"); }}
                              >
                                Открыть
                              </button>
                              <button
                                style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#C75D3C", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); openHtmlDoc((orderDetails as any).metadata.invoice.html, "print"); }}
                              >
                                Печать
                              </button>
                            </div>
                          </div>
                        )}
                        {(orderDetails as any).metadata?.act && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "#2D2A26" }}>
                                Акт {(orderDetails as any).metadata.act.number}
                              </div>
                              <div style={{ fontSize: 12, color: "#8B7E74" }}>
                                от {(orderDetails as any).metadata.act.date}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8CCBF", background: "#fff", color: "#C75D3C", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); openHtmlDoc((orderDetails as any).metadata.act.html, "open"); }}
                              >
                                Открыть
                              </button>
                              <button
                                style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#C75D3C", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); openHtmlDoc((orderDetails as any).metadata.act.html, "print"); }}
                              >
                                Печать
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="order-items-table">
                      <div className="oit-header">
                        <span className="oit-col-name">Товар</span>
                        <span className="oit-col-article">Артикул</span>
                        <span className="oit-col-qty">Кол-во</span>
                        <span className="oit-col-price">Цена</span>
                        <span className="oit-col-total">Сумма</span>
                      </div>
                      {orderDetails.items?.map((item: any) => (
                        <div key={item.id} className="oit-row">
                          <span className="oit-col-name oit-name-with-img">
                            {item.productImages?.[0] && (
                              <span className="oit-img-wrap">
                                <img src={item.productImages[0]} alt="" className="oit-img" onError={(e: any) => { e.target.parentElement.style.display = "none"; }} />
                                <span className="oit-img-zoom"><img src={item.productImages[0]} alt={item.productName} /></span>
                              </span>
                            )}
                            <span>{item.productName}</span>
                          </span>
                          <span className="oit-col-article">{item.productArticle}</span>
                          <span className="oit-col-qty">{item.quantity} шт.</span>
                          <span className="oit-col-price">{parseFloat(item.price).toLocaleString("ru-RU")} ₽</span>
                          <span className="oit-col-total">{parseFloat(item.totalPrice).toLocaleString("ru-RU")} ₽</span>
                        </div>
                      ))}
                      <div className="oit-footer">
                        <span>Итого:</span>
                        <span className="oit-total">{parseFloat(orderDetails.totalAmount).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Cancel Order Dialog */}
            <Dialog open={cancellingOrderId !== null} onOpenChange={(open) => { if (!open) setCancellingOrderId(null); }}>
              <DialogContent className="dialog-content" style={{ maxWidth: 480 }}>
                <DialogHeader>
                  <DialogTitle>Отмена заказа #{cancellingOrderId}</DialogTitle>
                  <DialogDescription>Укажите причину отмены (необязательно)</DialogDescription>
                </DialogHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" }}>
                  {cancelReasonPresets.map((reason) => (
                    <button
                      key={reason}
                      className={`cancel-reason-btn ${cancelReason === reason ? "cancel-reason-active" : ""}`}
                      onClick={() => setCancelReason(cancelReason === reason ? "" : reason)}
                    >
                      {reason}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Другая причина..."
                    className="cancel-reason-input"
                    value={cancelReasonPresets.includes(cancelReason) ? "" : cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
                <DialogFooter style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="outline" onClick={() => setCancellingOrderId(null)}>
                    Назад
                  </Button>
                  <Button
                    className="action-btn-danger"
                    style={{ background: "#EF4444", color: "#fff", border: "none" }}
                    disabled={updateStatusMutation.isPending}
                    onClick={() => {
                      if (cancellingOrderId) {
                        updateStatusMutation.mutate(
                          { orderId: cancellingOrderId, status: "cancelled", cancelReason: cancelReason || undefined },
                          { onSuccess: () => { setCancellingOrderId(null); toast.success("Заказ отменён"); } }
                        );
                      }
                    }}
                  >
                    {updateStatusMutation.isPending ? "Отмена..." : "Отменить заказ"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* New Manual Order Dialog */}
            <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
              <DialogContent className="dialog-content dialog-content-wide">
                <DialogHeader>
                  <DialogTitle>Новый заказ</DialogTitle>
                  <DialogDescription>Создайте заказ для клиента (звонок, визит)</DialogDescription>
                </DialogHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "65vh", overflowY: "auto", padding: "4px 0" }}>
                  {/* Customer */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#3D3530" }}>Клиент</label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="cancel-reason-input"
                        placeholder="Поиск клиента по имени/телефону..."
                        value={newOrderCustomerSearch}
                        onChange={(e) => setNewOrderCustomerSearch(e.target.value)}
                        style={{ width: "100%" }}
                      />
                      {customerSearchResults && customerSearchResults.length > 0 && newOrderCustomerSearch.length >= 2 && (
                        <div className="no-autocomplete-dropdown" style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E8E0D8", borderRadius: 8, zIndex: 50, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          {customerSearchResults.map((c: any) => (
                            <div
                              key={c.id}
                              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#3D3530", borderBottom: "1px solid #F5EDE6" }}
                              onClick={() => {
                                setNewOrderName(c.name || "");
                                setNewOrderPhone(c.phone || "");
                                setNewOrderCustomerSearch("");
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF8F3")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                            >
                              <span style={{ fontWeight: 500 }}>{c.name || "—"}</span>
                              <span style={{ color: "#8B7E74", marginLeft: 8 }}>{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="cancel-reason-input"
                        placeholder="Имя клиента *"
                        value={newOrderName}
                        onChange={(e) => setNewOrderName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        className="cancel-reason-input"
                        placeholder="Телефон *"
                        value={newOrderPhone}
                        onChange={(e) => setNewOrderPhone(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  {/* Product search */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#3D3530" }}>Товары</label>
                    <div style={{ position: "relative", display: "flex", gap: 6 }}>
                      <input
                        className="cancel-reason-input"
                        placeholder="Поиск / сканируйте штрихкод..."
                        value={newOrderProductSearch}
                        onChange={(e) => setNewOrderProductSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && productSearchResults && productSearchResults.length > 0) {
                            e.preventDefault();
                            const p = productSearchResults[0] as any;
                            const exists = newOrderCart.find((c) => c.productArticle === p.article);
                            if (exists) {
                              setNewOrderCart((prev) => prev.map((c) => c.productArticle === p.article ? { ...c, quantity: c.quantity + 1 } : c));
                            } else {
                              setNewOrderCart((prev) => [...prev, {
                                productName: p.name,
                                productArticle: p.article,
                                productCategory: p.category || undefined,
                                quantity: 1,
                                price: String(p.priceMin || p.priceMax || "0"),
                              }]);
                            }
                            setNewOrderProductSearch("");
                          }
                        }}
                        style={{ width: "100%", flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        style={{ background: "#C75D3C", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}
                        title="Сканировать штрихкод"
                      >
                        <Camera size={18} />
                      </button>
                      {productSearchResults && productSearchResults.length > 0 && newOrderProductSearch.length >= 2 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E8E0D8", borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          {productSearchResults.map((p: any) => (
                            <div
                              key={p.id}
                              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#3D3530", borderBottom: "1px solid #F5EDE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                              onClick={() => {
                                const exists = newOrderCart.find((c) => c.productArticle === p.article);
                                if (exists) {
                                  setNewOrderCart((prev) => prev.map((c) => c.productArticle === p.article ? { ...c, quantity: c.quantity + 1 } : c));
                                } else {
                                  setNewOrderCart((prev) => [...prev, {
                                    productName: p.name,
                                    productArticle: p.article,
                                    productCategory: p.category || undefined,
                                    quantity: 1,
                                    price: String(p.priceMin || p.priceMax || "0"),
                                  }]);
                                }
                                setNewOrderProductSearch("");
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF8F3")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                {p.images?.[0] ? (
                                  <img src={p.images[0]} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #E8E0D8", flexShrink: 0 }} onError={(e: any) => { e.target.style.display = "none"; }} />
                                ) : (
                                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#F5EDE6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#B5A99A", fontSize: 14 }}>?</div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                  <div style={{ color: "#8B7E74", fontSize: 12 }}>{p.article}</div>
                                </div>
                              </div>
                              <span style={{ fontWeight: 600, color: "#C75D3C", flexShrink: 0 }}>{parseFloat(p.priceMin || p.priceMax || 0).toLocaleString("ru-RU")} ₽</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cart */}
                  {newOrderCart.length > 0 && (
                    <div style={{ border: "1px solid #E8E0D8", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 90px 36px", padding: "8px 12px", background: "#FAF6F1", fontSize: 12, fontWeight: 600, color: "#8B7E74" }}>
                        <span>Товар</span><span style={{ textAlign: "center" }}>Кол-во</span><span style={{ textAlign: "right" }}>Цена</span><span style={{ textAlign: "right" }}>Сумма</span><span></span>
                      </div>
                      {newOrderCart.map((item, idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 90px 36px", padding: "8px 12px", borderTop: "1px solid #F5EDE6", alignItems: "center", fontSize: 13, color: "#3D3530" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.productName}</span>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <button style={{ width: 22, height: 22, border: "1px solid #E8E0D8", borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                              setNewOrderCart((prev) => prev.map((c, i) => i === idx ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c));
                            }}><Minus size={12} /></button>
                            <span style={{ minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                            <button style={{ width: 22, height: 22, border: "1px solid #E8E0D8", borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                              setNewOrderCart((prev) => prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c));
                            }}><Plus size={12} /></button>
                          </div>
                          <input
                            style={{ width: 90, textAlign: "right", border: "1px solid #E8E0D8", borderRadius: 6, padding: "2px 6px", fontSize: 13, color: "#3D3530" }}
                            value={item.price}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewOrderCart((prev) => prev.map((c, i) => i === idx ? { ...c, price: v } : c));
                            }}
                          />
                          <span style={{ textAlign: "right", fontWeight: 500 }}>{(parseFloat(item.price || "0") * item.quantity).toLocaleString("ru-RU")} ₽</span>
                          <button style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", padding: 4 }} onClick={() => {
                            setNewOrderCart((prev) => prev.filter((_, i) => i !== idx));
                          }}><X size={14} /></button>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px", borderTop: "1px solid #E8E0D8", fontWeight: 600, fontSize: 14, color: "#3D3530" }}>
                        Итого: {newOrderCart.reduce((s, c) => s + parseFloat(c.price || "0") * c.quantity, 0).toLocaleString("ru-RU")} ₽
                      </div>
                    </div>
                  )}

                  {/* Comment */}
                  <textarea
                    className="cancel-reason-input"
                    placeholder="Комментарий (необязательно)"
                    value={newOrderComment}
                    onChange={(e) => setNewOrderComment(e.target.value)}
                    rows={2}
                    style={{ resize: "vertical" }}
                  />
                </div>
                <DialogFooter style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  <Button variant="outline" onClick={() => setShowNewOrder(false)}>Отмена</Button>
                  <Button
                    style={{ background: "#C75D3C", color: "#fff", border: "none" }}
                    disabled={createManualOrderMutation.isPending || !newOrderName.trim() || !newOrderPhone.trim() || newOrderCart.length === 0}
                    onClick={handleCreateManualOrder}
                  >
                    {createManualOrderMutation.isPending ? "Создание..." : "Создать заказ"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Invoice Generation Dialog */}
            <Dialog open={invoiceOrderId !== null} onOpenChange={(open) => { if (!open) handleCloseInvoice(); }}>
              <DialogContent className="dialog-content" style={{ maxWidth: 480 }}>
                <DialogHeader>
                  <DialogTitle>Счёт на оплату — Заказ #{invoiceOrderId}</DialogTitle>
                  <DialogDescription>Укажите данные покупателя</DialogDescription>
                </DialogHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#8B7E74", marginBottom: 4, display: "block" }}>Покупатель (наименование) *</label>
                    <input
                      className="cancel-reason-input"
                      placeholder='ООО "Название" или ИП Иванов И.И.'
                      value={invoiceBuyerName}
                      onChange={(e) => setInvoiceBuyerName(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#8B7E74", marginBottom: 4, display: "block" }}>ИНН</label>
                      <input
                        className="cancel-reason-input"
                        placeholder="ИНН покупателя"
                        value={invoiceBuyerInn}
                        onChange={(e) => setInvoiceBuyerInn(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#8B7E74", marginBottom: 4, display: "block" }}>КПП</label>
                      <input
                        className="cancel-reason-input"
                        placeholder="КПП (для ООО)"
                        value={invoiceBuyerKpp}
                        onChange={(e) => setInvoiceBuyerKpp(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#8B7E74", marginBottom: 4, display: "block" }}>Адрес</label>
                    <input
                      className="cancel-reason-input"
                      placeholder="Юридический адрес (необязательно)"
                      value={invoiceBuyerAddress}
                      onChange={(e) => setInvoiceBuyerAddress(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
                <DialogFooter style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="outline" onClick={handleCloseInvoice}>Отмена</Button>
                  <Button
                    variant="outline"
                    style={{ color: "#C75D3C", borderColor: "#E8CCBF" }}
                    disabled={generateInvoiceMutation.isPending || !invoiceBuyerName.trim()}
                    onClick={() => handleGenerateInvoice("open")}
                  >
                    {generateInvoiceMutation.isPending ? "Генерация..." : <><FileText size={14} /> Сохранить в PDF</>}
                  </Button>
                  <Button
                    style={{ background: "#C75D3C", color: "#fff", border: "none" }}
                    disabled={generateInvoiceMutation.isPending || !invoiceBuyerName.trim()}
                    onClick={() => handleGenerateInvoice("print")}
                  >
                    {generateInvoiceMutation.isPending ? "Генерация..." : "Печать"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      }

      case "finance":
        return (
          <div className="admin-content-inner">
            <FinanceTab />
          </div>
        );

      case "crm":
        return (
          <div className="admin-content-inner">
            <CRMTab />
          </div>
        );

      case "catalog":
        return (
          <div className="admin-content-inner">
            <CatalogTab />
          </div>
        );

      case "requests": {
        const filteredRequests = (contactRequestsData?.requests || []).filter((r) =>
          requestFilter === "all" ? true : r.status === requestFilter
        );
        return (
          <div className="admin-content-inner">
            <div className="section-header-main">
              <div>
                <h2 className="page-title">Заявки</h2>
                <p className="page-subtitle">Всего: {contactRequestsData?.total || 0}</p>
              </div>
              <div className="header-actions" style={{ display: "flex", gap: 6 }}>
                {(["all", "new", "processed"] as const).map((f) => (
                  <button
                    key={f}
                    className={`req-filter-btn ${requestFilter === f ? "req-filter-active" : ""}`}
                    onClick={() => setRequestFilter(f)}
                  >
                    {{ all: "Все", new: "Новые", processed: "Обработанные" }[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="requests-list">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <div className="request-person">
                        <div className="request-name">{request.name}</div>
                        <div className="request-phone">{request.phone}</div>
                      </div>
                      <div className="request-meta">
                        <span className={`request-status ${request.status === "new" ? "status-new" : "status-done"}`}>
                          {request.status === "new" ? "Новая" : "Обработана"}
                        </span>
                        <span className="request-date">
                          {new Date(request.createdAt).toLocaleString("ru-RU")}
                        </span>
                      </div>
                    </div>
                    {request.message && (
                      <div className="request-message">{request.message}</div>
                    )}
                    <div className="request-actions">
                      {request.status === "new" ? (
                        <button
                          className="req-action-btn req-action-done"
                          onClick={() => updateRequestStatusMutation.mutate({ id: request.id, status: "processed" })}
                        >
                          Обработана
                        </button>
                      ) : (
                        <button
                          className="req-action-btn req-action-reopen"
                          onClick={() => updateRequestStatusMutation.mutate({ id: request.id, status: "new" })}
                        >
                          Вернуть в новые
                        </button>
                      )}
                      <button
                        className="req-action-btn req-action-delete"
                        onClick={() => { if (confirm("Удалить заявку?")) deleteRequestMutation.mutate({ id: request.id }); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state-large">
                  <MessageSquare size={48} />
                  <p>Заявок пока нет</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "shop-sales":
        return (
          <div className="admin-content-inner">
            <ShopSalesTab
              prefillOrderId={prefillOrderId}
              onPrefillComplete={() => { setPrefillOrderId(null); refetchAllOrders(); refetchBadges(); }}
            />
          </div>
        );

      case "settings":
        return (
          <div className="admin-content-inner">
            <SettingsTab />
          </div>
        );

      case "warehouse":
        return (
          <div className="admin-content-inner">
            <WarehouseTab />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="admin-wrapper">
      <SEO title="Панель управления" description="Админ-панель" />
      <style>{adminStyles}</style>

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowBarcodeScanner(false)} />
        </Suspense>
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">K</div>
            {!sidebarCollapsed && <span className="logo-text">Kovka Admin</span>}
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => (
            <div key={group.label} className="nav-group">
              {!sidebarCollapsed && <div className="nav-group-label">{group.label}</div>}
              {sidebarCollapsed && gi > 0 && <div className="nav-group-divider" />}
              {group.items.map((item) => {
                const badgeCount = item.id === "orders" ? (badgeCounts?.newOrders || 0)
                  : item.id === "requests" ? (badgeCounts?.newRequests || 0)
                  : item.id === "warehouse" ? (lowStockCount || 0) : 0;
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                    onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                  >
                    <item.icon size={20} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                    {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/" className="nav-item nav-item-site">
            <ExternalLink size={20} />
            {!sidebarCollapsed && <span>Сайт</span>}
          </a>
          <button className="nav-item nav-item-logout" onClick={adminLogout}>
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Выход</span>}
          </button>
          <button className="nav-item nav-item-muted desktop-only" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <ChevronRight size={20} className={sidebarCollapsed ? "" : "rotate-180"} />
            {!sidebarCollapsed && <span>Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button className="burger-btn" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <h1 className="topbar-title">{allMenuItems.find(m => m.id === activeSection)?.label || "Панель"}</h1>
          </div>
          <div className="topbar-right">
            <Button variant="ghost" size="icon" onClick={handleRefreshAll} className="refresh-btn">
              <RefreshCw size={18} />
            </Button>
            {user && (
              <div className="user-info">
                <span className="user-name">{user.name || "Админ"}</span>
              </div>
            )}
          </div>
        </header>

        <div className="admin-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

// Styles
const adminStyles = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');

.admin-wrapper {
  display: flex;
  min-height: 100vh;
  background: #FAF8F5;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Force light theme for all shadcn components inside admin */
  --background: #FAF8F5;
  --foreground: #1a1816;
  --card: #FFFCF9;
  --card-foreground: #1a1816;
  --popover: #FFFCF9;
  --popover-foreground: #1a1816;
  --primary: #C75D3C;
  --primary-foreground: #ffffff;
  --secondary: #F5F2EE;
  --secondary-foreground: #2D2A26;
  --muted: #F5F2EE;
  --muted-foreground: #8B8680;
  --accent: #F5F2EE;
  --accent-foreground: #2D2A26;
  --destructive: #EF4444;
  --destructive-foreground: #ffffff;
  --border: #E8E4DF;
  --input: #E8E4DF;
  --ring: #C75D3C;
}

/* Sidebar */
.admin-sidebar {
  width: 260px;
  background: #FFFCF9;
  border-right: 1px solid #E8E4DF;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  transition: width 0.3s ease;
  overflow-y: auto;
}

.admin-sidebar.collapsed {
  width: 72px;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #E8E4DF;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #C75D3C 0%, #E27D60 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: 'Sora', sans-serif;
  font-weight: 700;
  font-size: 18px;
}

.logo-text {
  font-family: 'Sora', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #2D2A26;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-group + .nav-group { margin-top: 12px; }
.nav-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #B5B0AA;
  padding: 6px 14px 4px;
}
.nav-group-divider {
  height: 1px;
  background: #E8E4DF;
  margin: 4px 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #6B6560;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: #F5F2EE;
  color: #2D2A26;
}

.nav-item.active {
  background: #C75D3C;
  color: white;
}

.nav-item.active:hover {
  background: #B54D2C;
}

.nav-item-muted {
  color: #9B9590;
}

.nav-item-site {
  color: #C75D3C;
  text-decoration: none;
}

.nav-item-site:hover {
  background: #FEF2F0;
  color: #B54D2C;
}

.nav-item-logout {
  color: #9B9590;
}

.nav-item-logout:hover {
  background: #FEF2F0;
  color: #DC2626;
}

.nav-item svg.rotate-180 {
  transform: rotate(180deg);
}

.sidebar-footer {
  padding: 16px 12px;
  border-top: 1px solid #E8E4DF;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Main Area */
.admin-main {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
}

.admin-sidebar.collapsed + .admin-main {
  margin-left: 72px;
}

.admin-topbar {
  height: 64px;
  background: #FFFCF9;
  border-bottom: 1px solid #E8E4DF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 40;
}

.topbar-title {
  font-family: 'Sora', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: #2D2A26;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  color: #6B6560;
}

.refresh-btn:hover {
  color: #C75D3C;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #4A4540;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
}

.admin-content-inner {
  padding: 32px;
  max-width: 1400px;
}

/* Period Selector */
.period-selector {
  margin-bottom: 24px;
}

.period-pills {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #F5F2EE;
  border-radius: 10px;
  width: fit-content;
}

.period-pill {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6B6560;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.period-pill:hover {
  color: #2D2A26;
}

.period-pill.active {
  background: #C75D3C;
  color: white;
}

.period-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.period-date {
  padding: 8px 12px;
  border: 1px solid #E8E4DF;
  border-radius: 8px;
  background: #FFFCF9;
  font-size: 13px;
  color: #2D2A26;
  font-family: inherit;
}

.period-dash {
  color: #8B8680;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stats-grid-6 {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 8px 30px rgba(0,0,0,0.06);
  transform: translateY(-2px);
}

.stat-card-primary {
  background: linear-gradient(135deg, #C75D3C 0%, #E27D60 100%);
  border: none;
  color: white;
}

.stat-card-primary .stat-label,
.stat-card-primary .stat-icon,
.stat-card-primary .stat-subtext {
  color: rgba(255,255,255,0.85);
}

.stat-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stat-label {
  font-size: 13px;
  font-weight: 500;
  color: #8B8680;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-icon {
  width: 20px;
  height: 20px;
  color: #B5B0AA;
}

.stat-card-primary .stat-icon {
  color: rgba(255,255,255,0.7);
}

.stat-value {
  font-family: 'Sora', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #2D2A26;
  margin-bottom: 4px;
}

.stat-card-primary .stat-value {
  color: white;
}

.stat-subtext {
  font-size: 13px;
  color: #8B8680;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.stat-trend-up {
  color: #10B981;
}

.stat-card-primary .stat-trend-up {
  color: rgba(255,255,255,0.9);
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  margin-bottom: 32px;
}

@media (max-width: 1024px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.chart-card-full {
  margin-bottom: 32px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 0;
}

.chart-title {
  font-family: 'Sora', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #2D2A26;
  margin-bottom: 4px;
}

.chart-subtitle {
  font-size: 13px;
  color: #8B8680;
}

.chart-body {
  padding: 24px;
}

.chart-empty {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8B8680;
}

.period-select {
  width: 120px;
  background: #F5F2EE;
  border: none;
}

/* Recent Section */
.recent-section {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #E8E4DF;
}

.section-title {
  font-family: 'Sora', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #2D2A26;
}

.section-link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #C75D3C;
  background: none;
  border: none;
  cursor: pointer;
}

.section-link:hover {
  color: #B54D2C;
}

.orders-list {
  padding: 8px;
}

.order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: 12px;
  transition: background 0.2s ease;
}

.order-item:hover {
  background: #F5F2EE;
}

.order-item-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-number {
  font-family: 'Sora', sans-serif;
  font-weight: 600;
  color: #2D2A26;
}

.order-customer {
  font-size: 13px;
  color: #6B6560;
}

.order-item-right {
  text-align: right;
}

.order-amount {
  font-family: 'Sora', sans-serif;
  font-weight: 600;
  color: #2D2A26;
}

.order-date {
  font-size: 12px;
  color: #8B8680;
}

.order-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
}

/* Page Headers */
.section-header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-family: 'Sora', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #2D2A26;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: #8B8680;
}

.filter-select {
  width: 160px;
  background: #FFFCF9;
  border-color: #E8E4DF;
}

/* Orders */
.orders-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 24px;
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.order-card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-id {
  font-family: 'Sora', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #2D2A26;
}

.order-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
}

.order-card-amount {
  font-family: 'Sora', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #C75D3C;
}

.order-card-body {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .order-card-body {
    grid-template-columns: repeat(2, 1fr);
  }
}

.order-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #8B8680;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #2D2A26;
}

.order-comment {
  background: #F5F2EE;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  color: #4A4540;
  margin-bottom: 16px;
}

.comment-label {
  font-weight: 500;
  color: #8B8680;
}

.order-card-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  font-weight: 500;
}

.action-btn-primary {
  background: #C75D3C;
  color: white;
}

.action-btn-primary:hover {
  background: #B54D2C;
}

.action-btn-success {
  background: #10B981;
  color: white;
}

.action-btn-success:hover {
  background: #059669;
}

.action-btn-danger {
  color: #EF4444;
  border-color: #FCA5A5;
}

.action-btn-danger:hover {
  background: #FEF2F2;
}

/* Order Status Cards */
.order-status-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.order-status-card {
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid;
}

.osc-new {
  background: #EFF6FF;
  border-color: #BFDBFE;
}

.osc-processing {
  background: #FFFBEB;
  border-color: #FDE68A;
}

.osc-completed {
  background: #ECFDF5;
  border-color: #A7F3D0;
}

.osc-cancelled {
  background: #FEF2F2;
  border-color: #FECACA;
}

.osc-count {
  font-family: 'Sora', sans-serif;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.osc-new .osc-count { color: #2563EB; }
.osc-processing .osc-count { color: #D97706; }
.osc-completed .osc-count { color: #059669; }
.osc-cancelled .osc-count { color: #DC2626; }

.osc-label {
  font-size: 13px;
  font-weight: 500;
  color: #6B6560;
}

.order-card-clickable {
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.order-card-clickable:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

/* Order Detail Dialog */
.dialog-content-wide {
  max-width: 700px;
}

.order-detail-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-detail-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 8px;
}

.order-detail-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-items-table {
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  overflow: visible;
}

.oit-header {
  display: grid;
  grid-template-columns: 2fr 1fr 0.7fr 1fr 1fr;
  padding: 12px 16px;
  background: #F5F2EE;
  font-size: 12px;
  font-weight: 600;
  color: #6B6560;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.oit-row {
  display: grid;
  grid-template-columns: 2fr 1fr 0.7fr 1fr 1fr;
  padding: 12px 16px;
  font-size: 14px;
  border-top: 1px solid #E8E4DF;
}

.oit-col-name { font-weight: 500; color: #2D2A26; }
.oit-name-with-img { display: flex; align-items: center; gap: 8px; }
.oit-img-wrap { position: relative; flex-shrink: 0; width: 36px; height: 36px; }
.oit-img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid #E8E4DF; cursor: pointer; display: block; }
.oit-img-zoom { display: none; position: absolute; left: 44px; top: 50%; transform: translateY(-50%); z-index: 200; background: white; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.22); padding: 4px; pointer-events: none; }
.oit-img-zoom img { width: 200px; height: 200px; object-fit: cover; border-radius: 8px; display: block; }
.oit-img-wrap:hover .oit-img-zoom { display: block; }
.oit-col-article { color: #8B8680; font-size: 13px; }
.oit-col-qty { text-align: center; }
.oit-col-price { text-align: right; }
.oit-col-total { text-align: right; font-weight: 500; }

.oit-footer {
  display: flex;
  justify-content: space-between;
  padding: 14px 16px;
  border-top: 2px solid #E8E4DF;
  font-weight: 600;
  font-size: 15px;
}

.oit-total {
  color: #C75D3C;
  font-family: 'Sora', sans-serif;
  font-weight: 700;
}

/* Status Tabs (pill tabs) */
.st-page-tabs {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.st-page-tab {
  padding: 7px 18px; border-radius: 20px; border: 1px solid #E8E4DF;
  background: #FFFCF9; color: #6B6560; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.st-page-tab:hover { border-color: #C75D3C; color: #C75D3C; }
.st-page-tab-active { background: #C75D3C; color: white; border-color: #C75D3C; }
.st-page-tab-active:hover { background: #B04E30; color: white; }

/* Cancel Reason Dialog */
.cancel-reason-btn {
  padding: 10px 16px;
  border: 1px solid #E8E4DF;
  border-radius: 8px;
  background: #FFFCF9;
  font-size: 14px;
  color: #3D3530;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.cancel-reason-btn:hover {
  border-color: #C75D3C;
  color: #C75D3C;
}
.cancel-reason-active {
  background: #C75D3C;
  color: white;
  border-color: #C75D3C;
}
.cancel-reason-active:hover {
  background: #B04E30;
  color: white;
}
.cancel-reason-input {
  padding: 10px 16px;
  border: 1px solid #E8E4DF;
  border-radius: 8px;
  background: #FFFCF9;
  font-size: 14px;
  color: #3D3530;
  font-family: inherit;
}
.cancel-reason-input:focus {
  outline: none;
  border-color: #C75D3C;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination-info {
  font-size: 14px;
  color: #6B6560;
}

/* Products */
.products-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 12px;
}

.product-rank {
  font-family: 'Sora', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #C75D3C;
  min-width: 48px;
}

.product-info {
  flex: 1;
}

.product-name {
  font-weight: 500;
  color: #2D2A26;
  margin-bottom: 4px;
}

.product-article {
  font-size: 13px;
  color: #8B8680;
}

.product-stats {
  text-align: right;
}

.product-qty {
  font-family: 'Sora', sans-serif;
  font-weight: 600;
  color: #2D2A26;
}

.product-revenue {
  font-size: 13px;
  color: #C75D3C;
}

/* Requests */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.request-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 24px;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.request-name {
  font-weight: 600;
  color: #2D2A26;
  margin-bottom: 4px;
}

.request-phone {
  font-size: 14px;
  color: #6B6560;
}

.request-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.request-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-new {
  background: #EFF6FF;
  color: #2563EB;
}

.status-done {
  background: #ECFDF5;
  color: #059669;
}

.request-date {
  font-size: 12px;
  color: #8B8680;
}

.request-message {
  margin-top: 16px;
  padding: 16px;
  background: #F5F2EE;
  border-radius: 10px;
  font-size: 14px;
  color: #4A4540;
}

.request-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #F0EDE8;
}

.req-action-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #E8E4DF;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.req-action-done { color: #059669; border-color: #A7F3D0; }
.req-action-done:hover { background: #ECFDF5; }
.req-action-reopen { color: #2563EB; border-color: #BFDBFE; }
.req-action-reopen:hover { background: #EFF6FF; }
.req-action-delete { color: #EF4444; border-color: #FECACA; padding: 5px 8px; }
.req-action-delete:hover { background: #FEF2F2; }

.req-filter-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #E8E4DF;
  background: white;
  cursor: pointer;
  color: #6B5E54;
  transition: all 0.15s;
}
.req-filter-btn:hover { background: #F5F0EB; }
.req-filter-active { background: #C75D3C; color: white; border-color: #C75D3C; }
.req-filter-active:hover { background: #B04E30; }

.nav-badge {
  margin-left: auto;
  background: #EF4444;
  color: white;
  font-size: 11px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  line-height: 1;
}

/* Content */
.header-actions {
  display: flex;
  gap: 12px;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #C75D3C;
  color: white;
}

.save-btn:hover {
  background: #B54D2C;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-box svg {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #8B8680;
}

.search-box input {
  padding-left: 44px;
  background: #FFFCF9;
  border-color: #E8E4DF;
}

.content-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.content-group-title {
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #C75D3C;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #E8E4DF;
}

.content-item {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
}

.content-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.content-key {
  font-size: 13px;
  font-family: 'SF Mono', Monaco, monospace;
  background: #F5F2EE;
  padding: 4px 10px;
  border-radius: 6px;
  color: #6B6560;
}

.content-section {
  font-size: 12px;
  padding: 2px 8px;
  background: #E8E4DF;
  border-radius: 4px;
  color: #6B6560;
}

.content-desc {
  font-size: 13px;
  color: #8B8680;
  margin-bottom: 12px;
}

.content-item textarea {
  background: #FFFCF9;
  border-color: #E8E4DF;
  resize: vertical;
}

.content-item textarea.edited {
  border-color: #F59E0B;
  background: #FFFBEB;
}

.content-item-actions {
  display: flex;
  gap: 4px;
  margin-top: 12px;
}

.delete-btn {
  color: #EF4444;
}

.delete-btn:hover {
  background: #FEF2F2;
}

/* Empty States */
.empty-state {
  padding: 32px;
  text-align: center;
  color: #8B8680;
}

.empty-state-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  color: #B5B0AA;
}

.empty-state-large svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state-large p {
  font-size: 16px;
}

/* Loading & Denied */
.admin-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
}

.admin-loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #E8E4DF;
  border-top-color: #C75D3C;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.admin-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  text-align: center;
  padding: 32px;
}

.admin-denied-icon {
  width: 64px;
  height: 64px;
  color: #EF4444;
  margin-bottom: 24px;
}

.admin-denied h1 {
  font-family: 'Sora', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #2D2A26;
  margin-bottom: 8px;
}

.admin-denied p {
  color: #6B6560;
  margin-bottom: 24px;
}

.admin-denied-link {
  padding: 12px 24px;
  background: #C75D3C;
  color: white;
  border-radius: 10px;
  font-weight: 500;
  text-decoration: none;
}

.admin-denied-link:hover {
  background: #B54D2C;
}

/* Force light theme for Radix portals (SelectContent, DialogContent, etc.) */
body:has(.admin-wrapper) [data-radix-popper-content-wrapper],
body:has(.admin-wrapper) [data-radix-portal] {
  --background: #FAF8F5;
  --foreground: #1a1816;
  --card: #FFFCF9;
  --card-foreground: #1a1816;
  --popover: #FFFCF9;
  --popover-foreground: #1a1816;
  --primary: #C75D3C;
  --primary-foreground: #ffffff;
  --secondary: #F5F2EE;
  --secondary-foreground: #2D2A26;
  --muted: #F5F2EE;
  --muted-foreground: #8B8680;
  --accent: #F5F2EE;
  --accent-foreground: #2D2A26;
  --destructive: #EF4444;
  --destructive-foreground: #ffffff;
  --border: #E8E4DF;
  --input: #E8E4DF;
  --ring: #C75D3C;
}

/* Dialog */
.dialog-content {
  background: #FFFCF9 !important;
  border-color: #E8E4DF !important;
  color: #3D3530 !important;
}

.dialog-content h2,
.dialog-content h3,
.dialog-content [data-slot="dialog-title"] {
  color: #2D2A26 !important;
}

.dialog-content p,
.dialog-content [data-slot="dialog-description"] {
  color: #6B5E54 !important;
}

.dialog-content input,
.dialog-content textarea,
.dialog-content [data-slot="select-trigger"] {
  background: #FFFCF9 !important;
  border-color: #E8E4DF !important;
  color: #3D3530 !important;
}

.dialog-content input:focus,
.dialog-content textarea:focus,
.dialog-content [data-slot="select-trigger"]:focus {
  border-color: #C75D3C !important;
  box-shadow: 0 0 0 3px rgba(199, 93, 60, 0.15) !important;
}

.dialog-content input::placeholder,
.dialog-content textarea::placeholder {
  color: #9A938C !important;
}

.dialog-content label {
  color: #4A4540 !important;
}

/* Select dropdown (renders via portal, outside dialog) */
[data-slot="select-content"] {
  background: #FFFCF9 !important;
  border-color: #E8E4DF !important;
}

[data-slot="select-item"] {
  color: #3D3530 !important;
}

[data-slot="select-item"]:focus,
[data-slot="select-item"][data-highlighted] {
  background: #F5F0EB !important;
  color: #C75D3C !important;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #4A4540;
}

/* Burger & mobile helpers */
.burger-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  background: transparent;
  color: #4A4540;
  cursor: pointer;
  border-radius: 8px;
}
.burger-btn:hover { background: #F5F2EE; }

.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 55;
}

.mobile-close-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #6B6560;
  cursor: pointer;
  border-radius: 8px;
}

.desktop-only { display: flex; }

/* ===== TABLET ===== */
@media (max-width: 1024px) {
  .admin-sidebar { width: 72px; }
  .admin-sidebar .logo-text,
  .admin-sidebar .nav-group-label,
  .admin-sidebar .nav-item span { display: none; }
  .admin-main { margin-left: 72px; }
  .admin-content-inner { padding: 20px; }
  .order-card-body { grid-template-columns: repeat(2, 1fr); }
}

/* ===== MOBILE ===== */
@media (max-width: 768px) {
  /* Sidebar: скрыт по умолчанию, показывается как drawer */
  .admin-sidebar {
    width: 280px;
    transform: translateX(-100%);
    z-index: 60;
    transition: transform 0.3s ease;
  }
  .admin-sidebar.collapsed { width: 280px; transform: translateX(-100%); }
  .admin-sidebar.mobile-open { transform: translateX(0); }
  .admin-sidebar.mobile-open .logo-text,
  .admin-sidebar.mobile-open .nav-group-label,
  .admin-sidebar.mobile-open .nav-item span { display: inline; }
  .mobile-overlay { display: block; }
  .mobile-close-btn { display: flex; }
  .burger-btn { display: flex; }
  .desktop-only { display: none !important; }

  .admin-main { margin-left: 0; }

  .admin-topbar { padding: 0 12px; height: 56px; }
  .topbar-title { font-size: 16px; }
  .topbar-left { display: flex; align-items: center; gap: 4px; }

  .admin-content-inner { padding: 12px; }

  /* Заголовки страниц */
  .section-header-main { flex-direction: column; gap: 12px; align-items: stretch; }
  .page-title { font-size: 20px; }

  /* Период */
  .period-pills { flex-wrap: wrap; width: 100%; }
  .period-pill { padding: 6px 12px; font-size: 12px; }
  .period-custom { flex-wrap: wrap; }

  /* Табы статусов */
  .st-page-tabs { flex-wrap: wrap; }
  .st-page-tab { padding: 5px 12px; font-size: 12px; }

  /* Карточки заказов */
  .order-card { padding: 16px; }
  .order-card-header { flex-direction: column; gap: 8px; }
  .order-card-title { flex-wrap: wrap; gap: 6px; }
  .order-card-amount { font-size: 18px; }
  .order-card-body { grid-template-columns: 1fr 1fr; gap: 10px; }
  .order-card-actions { flex-wrap: wrap; gap: 8px; }

  /* Карточки статистики */
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat-card { padding: 16px; }
  .stat-value { font-size: 22px; }

  /* Графики */
  .charts-grid { grid-template-columns: 1fr; gap: 16px; }

  /* Таблица товаров в деталях заказа */
  .oit-header, .oit-row { grid-template-columns: 1.5fr 0.6fr 0.8fr 0.8fr; font-size: 12px; }
  .oit-col-article { display: none; }
  .oit-header, .oit-row { padding: 8px 10px; }

  /* Диалоги */
  .dialog-content { max-width: 95vw !important; margin: 8px; }
  .dialog-content-wide { max-width: 95vw !important; }

  /* Заявки */
  .request-card { padding: 16px; }
  .request-header { flex-direction: column; gap: 8px; }
  .request-meta { flex-direction: row; align-items: center; }

  /* Пагинация */
  .pagination { gap: 10px; }

  /* Фильтры заявок */
  .header-actions { flex-wrap: wrap; }
}

/* ===== SMALL PHONE ===== */
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
  .order-card-body { grid-template-columns: 1fr; }
  .oit-header, .oit-row { grid-template-columns: 1fr 0.5fr 0.7fr; }
  .oit-col-article, .oit-col-price { display: none; }
  .page-title { font-size: 18px; }
  .stat-value { font-size: 20px; }
  .order-card-actions button { font-size: 12px; padding: 4px 8px; }
}
`;
