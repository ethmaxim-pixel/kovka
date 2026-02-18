import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  ShoppingCart,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Edit3,
  Trash2,
  Star,
  Clock,
  TrendingUp,
  X,
  Info,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const segmentLabels: Record<string, string> = {
  new: "Новый",
  regular: "Постоянный",
  vip: "VIP",
  inactive: "Неактивный",
};

const segmentColors: Record<string, string> = {
  new: "bg-blue-500",
  regular: "bg-green-500",
  vip: "bg-yellow-500",
  inactive: "bg-gray-500",
};

export default function CRMTab() {
  const [segment, setSegment] = useState<"all" | "new" | "regular" | "vip" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    phone: "",
    name: "",
    email: "",
    source: "other" as const,
    notes: "",
  });
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);

  // Queries
  const { data: customersData, refetch: refetchCustomers, isLoading: customersLoading } = trpc.crm.customers.list.useQuery({
    segment,
    search: search || undefined,
    page,
    limit: 20,
  });

  const { data: crmStats } = trpc.crm.stats.overview.useQuery();

  const { data: selectedCustomer, isLoading: customerLoading } = trpc.crm.customers.getById.useQuery(
    { id: selectedCustomerId! },
    { enabled: !!selectedCustomerId }
  );

  const { data: detailCustomer, isLoading: detailLoading } = trpc.crm.customers.getById.useQuery(
    { id: detailCustomerId! },
    { enabled: !!detailCustomerId }
  );

  // Mutations
  const createCustomerMutation = trpc.crm.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Клиент создан");
      refetchCustomers();
      setIsAddingCustomer(false);
      setNewCustomer({ phone: "", name: "", email: "", source: "phone", notes: "" });
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка при создании клиента");
    },
  });

  const updateCustomerMutation = trpc.crm.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Клиент обновлен");
      refetchCustomers();
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка при обновлении");
    },
  });

  const deleteCustomerMutation = trpc.crm.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("Клиент удален");
      refetchCustomers();
      setSelectedCustomerId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка при удалении");
    },
  });

  // Auto-sync on mount
  const syncFromOrdersMutation = trpc.crm.customers.syncFromOrders.useMutation({
    onSuccess: () => { refetchCustomers(); },
  });
  // Run auto-sync once on first render
  useState(() => { syncFromOrdersMutation.mutate(); });

  const sourceLabels: Record<string, string> = {
    website: "Сайт",
    telegram: "Telegram",
    phone: "Телефон",
    referral: "Рекомендация",
    other: "Не указан",
  };

  const statusLabels: Record<string, string> = {
    new: "Новый",
    processing: "В работе",
    completed: "Завершён",
    cancelled: "Отменён",
  };

  // Full customer detail card
  if (detailCustomerId) {
    return (
      <div className="space-y-4">
        <style>{crmDetailStyles}</style>

        {/* Back button */}
        <Button variant="outline" onClick={() => setDetailCustomerId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад к списку
        </Button>

        {detailLoading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : detailCustomer ? (
          <>
            {/* Customer header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">
                        {detailCustomer.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{detailCustomer.name || "Без имени"}</h2>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {detailCustomer.phone}</span>
                        {detailCustomer.email && (
                          <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {detailCustomer.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={segmentColors[detailCustomer.segment || "new"]}>
                          {segmentLabels[detailCustomer.segment || "new"]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Источник: {sourceLabels[detailCustomer.source || "other"]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={detailCustomer.segment || "new"}
                      onValueChange={(v) => {
                        updateCustomerMutation.mutate({
                          id: detailCustomer.id,
                          segment: v as "new" | "regular" | "vip" | "inactive",
                        });
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Новый</SelectItem>
                        <SelectItem value="regular">Постоянный</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="inactive">Неактивный</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-primary">{detailCustomer.totalOrders || 0}</p>
                  <p className="text-xs text-muted-foreground">Заказов</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-primary">{parseFloat(detailCustomer.totalSpent || "0").toLocaleString("ru-RU")} ₽</p>
                  <p className="text-xs text-muted-foreground">Потрачено</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {detailCustomer.totalOrders && parseFloat(detailCustomer.totalSpent || "0") > 0
                      ? Math.round(parseFloat(detailCustomer.totalSpent || "0") / (detailCustomer.totalOrders || 1)).toLocaleString("ru-RU")
                      : 0} ₽
                  </p>
                  <p className="text-xs text-muted-foreground">Средний чек</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {detailCustomer.lastOrderAt
                      ? new Date(detailCustomer.lastOrderAt).toLocaleDateString("ru-RU")
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Последний заказ</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Products Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Топ товаров по сумме</CardTitle>
                </CardHeader>
                <CardContent>
                  {detailCustomer.topProducts && detailCustomer.topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(200, detailCustomer.topProducts.length * 40)}>
                      <BarChart
                        data={detailCustomer.topProducts.map((p) => ({
                          name: p.productName.length > 25 ? p.productName.slice(0, 22) + "..." : p.productName,
                          amount: Number(p.totalAmount),
                          qty: Number(p.totalQty),
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                        <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                        <YAxis type="category" dataKey="name" fontSize={11} width={150} />
                        <Tooltip
                          formatter={(val: number) => [`${val.toLocaleString("ru-RU")} ₽`, "Сумма"]}
                        />
                        <Bar dataKey="amount" fill="#C75D3C" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Нет данных о товарах
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Заметки</CardTitle>
                </CardHeader>
                <CardContent>
                  {detailCustomer.notes ? (
                    <p className="text-sm">{detailCustomer.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Нет заметок</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order history - full list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> История заказов ({detailCustomer.orders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detailCustomer.orders && detailCustomer.orders.length > 0 ? (
                  <div className="crm-orders-table">
                    <div className="crm-orders-head">
                      <span>№</span>
                      <span>Источник</span>
                      <span>Статус</span>
                      <span>Оплата</span>
                      <span>Дата</span>
                      <span>Сумма</span>
                    </div>
                    {detailCustomer.orders.map((order) => (
                      <div key={order.id} className="crm-orders-row">
                        <span className="font-medium">#{order.id}</span>
                        <span>
                          {(order as any).source === "offline" ? (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">Магазин</span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">Сайт</span>
                          )}
                        </span>
                        <span>
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {{ cash: "Наличные", card: "Карта", transfer: "Перевод", other: "Другое" }[(order as any).paymentMethod || ""] || "—"}
                        </span>
                        <span className="text-sm">
                          {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                        </span>
                        <span className="font-semibold text-right">
                          {parseFloat(order.totalAmount).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Заказов нет
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            Клиент не найден
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{crmDetailStyles}</style>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего клиентов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{crmStats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Новых за месяц</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{crmStats?.newThisMonth || 0}</div>
          </CardContent>
        </Card>

        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              VIP клиентов
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onMouseEnter={() => setShowTooltip("vip")}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{crmStats?.bySegment.vip || 0}</div>
          </CardContent>
          {showTooltip === "vip" && (
            <div className="absolute top-full left-4 z-50 mt-1 p-2 bg-popover border rounded-md shadow-md text-xs text-muted-foreground max-w-[200px]">
              VIP — клиенты с 10+ завершённых заказов или суммой покупок от 100 000 ₽
            </div>
          )}
        </Card>

        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Постоянных
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onMouseEnter={() => setShowTooltip("regular")}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{crmStats?.bySegment.regular || 0}</div>
          </CardContent>
          {showTooltip === "regular" && (
            <div className="absolute top-full left-4 z-50 mt-1 p-2 bg-popover border rounded-md shadow-md text-xs text-muted-foreground max-w-[200px]">
              Постоянный — клиенты с 3-9 завершённых заказов
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Клиенты</CardTitle>
                <CardDescription>
                  Всего: {customersData?.total || 0}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Dialog open={isAddingCustomer} onOpenChange={setIsAddingCustomer}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Добавить
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="dialog-content">
                    <DialogHeader>
                      <DialogTitle>Новый клиент</DialogTitle>
                      <DialogDescription>Добавьте нового клиента в базу</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Телефон *</Label>
                        <Input
                          placeholder="+7 999 123 45 67"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Имя</Label>
                        <Input
                          placeholder="Иван Иванов"
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Источник</Label>
                        <Select
                          value={newCustomer.source}
                          onValueChange={(v) => setNewCustomer({ ...newCustomer, source: v as typeof newCustomer.source })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="other">Не указан</SelectItem>
                            <SelectItem value="website">Сайт</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                            <SelectItem value="phone">Телефон</SelectItem>
                            <SelectItem value="referral">Рекомендация</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Заметки</Label>
                        <Textarea
                          placeholder="Заметки о клиенте..."
                          value={newCustomer.notes}
                          onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddingCustomer(false)}>
                        Отмена
                      </Button>
                      <Button
                        onClick={() => createCustomerMutation.mutate(newCustomer)}
                        disabled={!newCustomer.phone || createCustomerMutation.isPending}
                      >
                        Создать
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, телефону..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={segment} onValueChange={(v) => setSegment(v as typeof segment)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сегменты</SelectItem>
                  <SelectItem value="new">Новые</SelectItem>
                  <SelectItem value="regular">Постоянные</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="inactive">Неактивные</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer List */}
            {customersLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : customersData?.customers && customersData.customers.length > 0 ? (
              <div className="space-y-2">
                {customersData.customers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedCustomerId === customer.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 bg-card/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {customer.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{customer.name || "Без имени"}</p>
                          <p className="text-sm text-muted-foreground">{customer.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={segmentColors[customer.segment || "new"]}>
                          {segmentLabels[customer.segment || "new"]}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        {customer.totalOrders || 0} заказов
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {parseFloat(customer.totalSpent || "0").toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {(customersData?.total || 0) > 20 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Назад
                    </Button>
                    <span className="flex items-center px-4 text-sm">
                      {page} / {Math.ceil((customersData?.total || 0) / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil((customersData?.total || 0) / 20)}
                    >
                      Вперед
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Клиентов не найдено</p>
                <p className="text-sm mt-1">
                  Клиенты создаются автоматически из завершённых заказов
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Details - side panel */}
        <Card>
          <CardHeader>
            <CardTitle>Детали клиента</CardTitle>
          </CardHeader>
          <CardContent>
            {customerLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : selectedCustomer ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{selectedCustomer.name || "Без имени"}</h3>
                    <Badge className={segmentColors[selectedCustomer.segment || "new"]}>
                      {segmentLabels[selectedCustomer.segment || "new"]}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">{selectedCustomer.totalOrders || 0}</p>
                      <p className="text-xs text-muted-foreground">Заказов</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">{parseFloat(selectedCustomer.totalSpent || "0").toLocaleString("ru-RU")} ₽</p>
                      <p className="text-xs text-muted-foreground">Потрачено</p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setDetailCustomerId(selectedCustomer.id)}
                  >
                    Открыть карточку <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (confirm("Удалить клиента?")) {
                          deleteCustomerMutation.mutate({ id: selectedCustomer.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Выберите клиента из списка</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const crmDetailStyles = `
.crm-orders-table { border: 1px solid #F0EDE8; border-radius: 8px; overflow: hidden; }
.crm-orders-head { display: grid; grid-template-columns: 60px 90px 100px 100px 100px 1fr; padding: 8px 12px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; text-transform: uppercase; letter-spacing: 0.04em; }
.crm-orders-row { display: grid; grid-template-columns: 60px 90px 100px 100px 100px 1fr; padding: 10px 12px; border-top: 1px solid #F0EDE8; align-items: center; }
.crm-orders-row:hover { background: #FAF8F5; }

@media (max-width: 768px) {
  .crm-orders-head, .crm-orders-row { grid-template-columns: 50px 80px 1fr 90px; }
  .crm-orders-head > :nth-child(4), .crm-orders-row > :nth-child(4) { display: none; }
  .crm-orders-head > :nth-child(5), .crm-orders-row > :nth-child(5) { display: none; }
}
`;
