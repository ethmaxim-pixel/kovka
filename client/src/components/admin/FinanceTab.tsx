import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import PeriodSelector, { usePeriod } from "@/components/admin/PeriodSelector";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  RussianRuble,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  CreditCard,
  Banknote,
  Building,
  MoreHorizontal,
  Settings,
  BarChart3,
  List,
  Receipt,
  Tags,
  ChevronRight,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ArrowRightLeft,
} from "lucide-react";

type TransactionType = "income" | "expense" | "transfer";
type PaymentMethod = "cash" | "card" | "transfer" | "other";
type FinanceView = "dashboard" | "accounts" | "transactions" | "categories" | "import";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  other: "Другое",
};

const paymentMethodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4" />,
  card: <CreditCard className="w-4 h-4" />,
  transfer: <Building className="w-4 h-4" />,
  other: <MoreHorizontal className="w-4 h-4" />,
};

const financeSubNav: { id: FinanceView; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Дашборд", icon: BarChart3 },
  { id: "accounts", label: "Счета", icon: Wallet },
  { id: "transactions", label: "Транзакции", icon: Receipt },
  { id: "categories", label: "Категории", icon: Tags },
  { id: "import", label: "Импорт", icon: Upload },
];

export default function FinanceTab() {
  const [view, setView] = useState<FinanceView>("dashboard");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterAccount, setFilterAccount] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [addTransactionType, setAddTransactionType] = useState<TransactionType>("expense");
  const [newTransaction, setNewTransaction] = useState({
    type: "expense" as TransactionType,
    categoryId: undefined as number | undefined,
    accountId: undefined as number | undefined,
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "cash" as PaymentMethod,
    fromAccountId: "" as string,
    toAccountId: "" as string,
  });
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "expense" as TransactionType,
    color: "#6B7280",
  });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryColor, setEditCategoryColor] = useState("#6B7280");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    total: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Accounts state
  const [newAccount, setNewAccount] = useState({ name: "", type: "cash" as "cash" | "bank" | "other", balance: "" });
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountBalance, setEditAccountBalance] = useState("");
  const [transfer, setTransfer] = useState({ fromId: "", toId: "", amount: "", description: "", date: new Date().toISOString().split("T")[0] });

  // Period selectors
  const dashPeriod = usePeriod("30d");
  const txPeriod = usePeriod("30d");

  const dashDateRange = useMemo(() => ({
    dateFrom: dashPeriod.range.dateFrom.toISOString(),
    dateTo: dashPeriod.range.dateTo.toISOString(),
  }), [dashPeriod.range]);

  const txDateRange = useMemo(() => ({
    dateFrom: txPeriod.range.dateFrom.toISOString(),
    dateTo: txPeriod.range.dateTo.toISOString(),
  }), [txPeriod.range]);

  // Queries
  const { data: overview } = trpc.finance.stats.overview.useQuery(dashDateRange);
  const { data: chartData } = trpc.finance.stats.byPeriod.useQuery(dashDateRange);
  const { data: expenseByCategory } = trpc.finance.stats.byCategory.useQuery({ type: "expense" });
  const { data: categories } = trpc.finance.categories.list.useQuery();
  const { data: accounts, refetch: refetchAccounts } = trpc.finance.accounts.list.useQuery();
  const { data: transactionsData, refetch: refetchTransactions, isLoading: transactionsLoading } = trpc.finance.transactions.list.useQuery({
    type: filterType,
    categoryId: filterCategory || undefined,
    accountId: filterAccount || undefined,
    dateFrom: txDateRange.dateFrom,
    dateTo: txDateRange.dateTo,
    search: search || undefined,
    page,
    limit: 20,
  });

  // Mutations
  const createTransactionMutation = trpc.finance.transactions.create.useMutation({
    onSuccess: () => {
      toast.success("Транзакция добавлена");
      refetchTransactions();
      refetchAccounts();
      setIsAddingTransaction(false);
      setNewTransaction({
        type: "expense",
        categoryId: undefined,
        accountId: undefined,
        amount: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "cash",
        fromAccountId: "",
        toAccountId: "",
      });
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const deleteTransactionMutation = trpc.finance.transactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Транзакция удалена");
      refetchTransactions();
      refetchAccounts();
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const updateCategoryMutation = trpc.finance.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Категория обновлена");
      setEditingCategoryId(null);
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const createAccountMutation = trpc.finance.accounts.create.useMutation({
    onSuccess: () => {
      toast.success("Счёт создан");
      refetchAccounts();
      setNewAccount({ name: "", type: "cash", balance: "" });
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const updateAccountMutation = trpc.finance.accounts.update.useMutation({
    onSuccess: () => {
      toast.success("Счёт обновлён");
      refetchAccounts();
      setEditingAccountId(null);
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const deleteAccountMutation = trpc.finance.accounts.delete.useMutation({
    onSuccess: () => {
      toast.success("Счёт удалён");
      refetchAccounts();
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const transferMutation = trpc.finance.accounts.transfer.useMutation({
    onSuccess: () => {
      toast.success("Перевод выполнен");
      refetchAccounts();
      refetchTransactions();
      setTransfer({ fromId: "", toId: "", amount: "", description: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const initDefaultAccountsMutation = trpc.finance.accounts.initDefaults.useMutation({
    onSuccess: (data) => {
      if (data.created > 0) toast.success(`Создано ${data.created} счёта`);
      refetchAccounts();
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const createCategoryMutation = trpc.finance.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Категория создана");
      setNewCategory({ name: "", type: "expense", color: "#6B7280" });
    },
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const deleteCategoryMutation = trpc.finance.categories.delete.useMutation({
    onSuccess: () => toast.success("Категория удалена"),
    onError: (error) => toast.error(error.message || "Ошибка"),
  });

  const importCsvMutation = trpc.finance.transactions.importCsv.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      refetchTransactions();
      if (data.imported > 0) {
        toast.success(`Импортировано ${data.imported} транзакций`);
      }
    },
    onError: (error) => toast.error(error.message || "Ошибка импорта"),
  });

  const fmt = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const fmtDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  const incomeCategories = categories?.filter(c => c.type === "income") || [];
  const expenseCategories = categories?.filter(c => c.type === "expense") || [];

  const openAddTransaction = (type: TransactionType) => {
    setAddTransactionType(type);
    setNewTransaction({
      ...newTransaction,
      type,
      categoryId: undefined,
      accountId: undefined,
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      fromAccountId: "",
      toAccountId: "",
    });
    setIsAddingTransaction(true);
  };

  const currentCategories = newTransaction.type === "income" ? incomeCategories : expenseCategories;

  const totalAccountBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  }, [accounts]);

  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportResult(null);
        importCsvMutation.mutate({ csvContent: content });
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFileImport(file);
    } else {
      toast.error("Поддерживается только формат CSV");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
      e.target.value = "";
    }
  };

  return (
    <>
      <style>{financeStyles}</style>

      {/* Sub-navigation */}
      <div className="fin-subnav">
        {financeSubNav.map((item) => (
          <button
            key={item.id}
            className={`fin-subnav-item ${view === item.id ? "active" : ""}`}
            onClick={() => setView(item.id)}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ========== DASHBOARD ========== */}
      {view === "dashboard" && (
        <>
          {/* Period selector + Add button */}
          <div className="fin-toolbar">
            <PeriodSelector defaultPreset="30d" onChange={dashPeriod.handleChange} />
            <button
              className="fin-add-btn"
              onClick={() => openAddTransaction("income")}
            >
              <Plus size={16} />
              Добавить транзакцию
            </button>
          </div>

          {/* Metric cards */}
          <div className="fin-metrics">
            <div className="fin-metric-card fin-metric-income">
              <div className="fin-metric-header">
                <span className="fin-metric-label">Доходы</span>
                <TrendingUp size={18} />
              </div>
              <div className="fin-metric-value">
                {fmt(overview?.totalIncome || 0)} <span className="fin-currency">₽</span>
              </div>
            </div>

            <div className="fin-metric-card fin-metric-expense">
              <div className="fin-metric-header">
                <span className="fin-metric-label">Расходы</span>
                <TrendingDown size={18} />
              </div>
              <div className="fin-metric-value">
                {fmt(overview?.totalExpense || 0)} <span className="fin-currency">₽</span>
              </div>
            </div>

            <div className={`fin-metric-card ${(overview?.balance || 0) >= 0 ? "fin-metric-profit" : "fin-metric-loss"}`}>
              <div className="fin-metric-header">
                <span className="fin-metric-label">Прибыль</span>
                <RussianRuble size={18} />
              </div>
              <div className="fin-metric-value">
                {(overview?.balance || 0) >= 0 ? "+" : ""}{fmt(overview?.balance || 0)} <span className="fin-currency">₽</span>
              </div>
            </div>

            <div className="fin-metric-card">
              <div className="fin-metric-header">
                <span className="fin-metric-label">Операций</span>
                <Receipt size={18} />
              </div>
              <div className="fin-metric-value">{overview?.transactionsCount || 0}</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="fin-charts-row">
            <div className="fin-chart-card fin-chart-wide">
              <div className="fin-chart-header">
                <div>
                  <h3 className="fin-chart-title">Динамика</h3>
                  <p className="fin-chart-subtitle">Доходы и расходы</p>
                </div>
              </div>
              <div className="fin-chart-body">
                {chartData && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="finIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="finExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" />
                      <XAxis dataKey="period" stroke="#8B8680" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8B8680" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#FFFCF9", border: "1px solid #E5E2DD", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                        formatter={(value: number, name: string) => [`${fmt(value)} ₽`, name === "income" ? "Доходы" : "Расходы"]}
                      />
                      <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} fill="url(#finIncomeGrad)" />
                      <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} fill="url(#finExpenseGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="fin-chart-empty">
                    <BarChart3 size={40} />
                    <p>Нет данных за выбранный период</p>
                  </div>
                )}
              </div>
            </div>

            <div className="fin-chart-card">
              <div className="fin-chart-header">
                <div>
                  <h3 className="fin-chart-title">По категориям</h3>
                  <p className="fin-chart-subtitle">Расходы</p>
                </div>
              </div>
              <div className="fin-chart-body">
                {expenseByCategory && expenseByCategory.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="total" nameKey="categoryName" paddingAngle={2}>
                          {expenseByCategory.map((entry, i) => (
                            <Cell key={i} fill={entry.categoryColor} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#FFFCF9", border: "1px solid #E5E2DD", borderRadius: "12px" }} formatter={(value: number) => [`${fmt(value)} ₽`, ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="fin-legend">
                      {expenseByCategory.map((cat) => (
                        <div key={cat.categoryId} className="fin-legend-item">
                          <div className="fin-legend-dot" style={{ backgroundColor: cat.categoryColor }} />
                          <span className="fin-legend-name">{cat.categoryName}</span>
                          <span className="fin-legend-value">{fmt(cat.total)} ₽</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="fin-chart-empty-sm">Нет данных</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== TRANSACTIONS ========== */}
      {view === "transactions" && (
        <>
          <PeriodSelector defaultPreset="30d" onChange={txPeriod.handleChange} />

          <div className="fin-toolbar">
            <div className="fin-toolbar-left">
              <div className="fin-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Поиск по описанию..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="fin-toolbar-right">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="fin-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="income">Доходы</SelectItem>
                  <SelectItem value="expense">Расходы</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterCategory?.toString() || "all"}
                onValueChange={(v) => setFilterCategory(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="fin-filter-select" style={{ width: "160px" }}>
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {(filterType === "all" || filterType === "income" ? incomeCategories : []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cat.color || "#6B7280" }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                  {(filterType === "all" || filterType === "expense" ? expenseCategories : []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cat.color || "#6B7280" }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterAccount?.toString() || "all"}
                onValueChange={(v) => setFilterAccount(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="fin-filter-select" style={{ width: "140px" }}>
                  <SelectValue placeholder="Счёт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все счета</SelectItem>
                  {accounts?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button className="fin-add-btn" onClick={() => openAddTransaction("expense")}>
                <Plus size={16} />
                Добавить транзакцию
              </button>
            </div>
          </div>

          <div className="fin-tx-summary">
            <span>Всего операций: <strong>{transactionsData?.total || 0}</strong></span>
          </div>

          <div className="fin-tx-list">
            {transactionsLoading ? (
              <div className="fin-loading">
                <RefreshCw size={24} className="fin-spin" />
              </div>
            ) : transactionsData?.transactions && transactionsData.transactions.length > 0 ? (
              transactionsData.transactions.map((t) => (
                <div key={t.id} className="fin-tx-item">
                  <div className={`fin-tx-icon ${t.type}`}>
                    {t.type === "income" ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                  <div className="fin-tx-body">
                    <div className="fin-tx-desc">{t.description || t.categoryName || "Без описания"}</div>
                    <div className="fin-tx-meta">
                      {t.categoryName && (
                        <span className="fin-tx-cat">
                          <span className="fin-dot" style={{ backgroundColor: t.categoryColor || "#6B7280" }} />
                          {t.categoryName}
                        </span>
                      )}
                      <span>{fmtDate(t.date)}</span>
                      <span className="fin-tx-method">
                        {paymentMethodIcons[t.paymentMethod as PaymentMethod]}
                        {paymentMethodLabels[t.paymentMethod as PaymentMethod]}
                      </span>
                      {t.isAutomatic && <Badge variant="secondary" className="fin-badge-auto">Авто</Badge>}
                    </div>
                  </div>
                  <div className={`fin-tx-amount ${t.type}`}>
                    {t.type === "income" ? "+" : "-"}{fmt(parseFloat(t.amount))} ₽
                  </div>
                  <button
                    className="fin-tx-delete"
                    onClick={() => {
                      if (confirm("Удалить транзакцию?")) {
                        deleteTransactionMutation.mutate({ id: t.id });
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="fin-empty-state">
                <List size={48} />
                <p>Транзакций не найдено</p>
              </div>
            )}
          </div>

          {(transactionsData?.total || 0) > 20 && (
            <div className="fin-pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <span className="fin-pagination-info">
                {page} / {Math.ceil((transactionsData?.total || 0) / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil((transactionsData?.total || 0) / 20)}
              >
                Вперед
              </Button>
            </div>
          )}
        </>
      )}

      {/* ========== CATEGORIES ========== */}
      {view === "categories" && (
        <>
          {/* Add category form — at top */}
          <div className="fin-add-category-card">
            <h4 className="fin-section-title">Добавить категорию</h4>
            <div className="fin-add-cat-form">
              <input
                type="text"
                placeholder="Название категории"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="fin-input"
              />
              <Select
                value={newCategory.type}
                onValueChange={(v) => setNewCategory({ ...newCategory, type: v as TransactionType })}
              >
                <SelectTrigger className="fin-filter-select" style={{ width: "140px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="fin-color-input"
              />
              <button
                className="fin-add-btn"
                onClick={() => {
                  if (!newCategory.name.trim()) {
                    toast.error("Введите название");
                    return;
                  }
                  createCategoryMutation.mutate(newCategory);
                }}
                disabled={!newCategory.name || createCategoryMutation.isPending}
              >
                <Plus size={16} />
                Добавить
              </button>
            </div>
          </div>

          <div className="fin-categories-grid">
            {/* Income */}
            <div className="fin-cat-section">
              <div className="fin-cat-section-header">
                <ArrowUpRight size={18} className="fin-icon-income" />
                <h3>Доходы</h3>
                <span className="fin-cat-count">{incomeCategories.length}</span>
              </div>
              <div className="fin-cat-list">
                {incomeCategories.length > 0 ? (
                  incomeCategories.map((cat) => (
                    <div key={cat.id} className="fin-cat-item">
                      {editingCategoryId === cat.id ? (
                        <>
                          <input
                            type="color"
                            value={editCategoryColor}
                            onChange={(e) => setEditCategoryColor(e.target.value)}
                            className="fin-color-input-sm"
                          />
                          <input
                            type="text"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            className="fin-input fin-input-sm"
                          />
                          <button className="fin-cat-action-btn fin-icon-success" onClick={() => {
                            updateCategoryMutation.mutate({ id: cat.id, name: editCategoryName, color: editCategoryColor });
                          }}>
                            <Check size={14} />
                          </button>
                          <button className="fin-cat-action-btn" onClick={() => setEditingCategoryId(null)}>
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="fin-cat-dot" style={{ backgroundColor: cat.color || "#6B7280" }} />
                          <span className="fin-cat-name">{cat.name}</span>
                          {cat.isSystem && <span className="fin-cat-badge">Системная</span>}
                          <div className="fin-cat-actions">
                            <button className="fin-cat-edit" onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditCategoryName(cat.name);
                              setEditCategoryColor(cat.color || "#6B7280");
                            }}>
                              <Edit3 size={14} />
                            </button>
                            {!cat.isSystem && (
                              <button className="fin-cat-delete" onClick={() => {
                                if (confirm("Удалить категорию?")) deleteCategoryMutation.mutate({ id: cat.id });
                              }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="fin-cat-empty">Нет категорий доходов</div>
                )}
              </div>
            </div>

            {/* Expense */}
            <div className="fin-cat-section">
              <div className="fin-cat-section-header">
                <ArrowDownRight size={18} className="fin-icon-expense" />
                <h3>Расходы</h3>
                <span className="fin-cat-count">{expenseCategories.length}</span>
              </div>
              <div className="fin-cat-list">
                {expenseCategories.length > 0 ? (
                  expenseCategories.map((cat) => (
                    <div key={cat.id} className="fin-cat-item">
                      {editingCategoryId === cat.id ? (
                        <>
                          <input
                            type="color"
                            value={editCategoryColor}
                            onChange={(e) => setEditCategoryColor(e.target.value)}
                            className="fin-color-input-sm"
                          />
                          <input
                            type="text"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            className="fin-input fin-input-sm"
                          />
                          <button className="fin-cat-action-btn fin-icon-success" onClick={() => {
                            updateCategoryMutation.mutate({ id: cat.id, name: editCategoryName, color: editCategoryColor });
                          }}>
                            <Check size={14} />
                          </button>
                          <button className="fin-cat-action-btn" onClick={() => setEditingCategoryId(null)}>
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="fin-cat-dot" style={{ backgroundColor: cat.color || "#6B7280" }} />
                          <span className="fin-cat-name">{cat.name}</span>
                          {cat.isSystem && <span className="fin-cat-badge">Системная</span>}
                          <div className="fin-cat-actions">
                            <button className="fin-cat-edit" onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditCategoryName(cat.name);
                              setEditCategoryColor(cat.color || "#6B7280");
                            }}>
                              <Edit3 size={14} />
                            </button>
                            {!cat.isSystem && (
                              <button className="fin-cat-delete" onClick={() => {
                                if (confirm("Удалить категорию?")) deleteCategoryMutation.mutate({ id: cat.id });
                              }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="fin-cat-empty">Нет категорий расходов</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== ACCOUNTS ========== */}
      {view === "accounts" && (
        <>
          {/* Balance cards */}
          <div className="fin-metrics">
            <div className="fin-metric-card fin-metric-profit">
              <div className="fin-metric-header">
                <span className="fin-metric-label">Всего на счетах</span>
                <Wallet size={18} />
              </div>
              <div className="fin-metric-value">
                {fmt(totalAccountBalance)} <span className="fin-currency">₽</span>
              </div>
            </div>
            {accounts?.map((acc) => (
              <div key={acc.id} className="fin-metric-card">
                <div className="fin-metric-header">
                  <span className="fin-metric-label">{acc.name}</span>
                  {acc.type === "cash" ? <Banknote size={18} /> : acc.type === "bank" ? <Building size={18} /> : <CreditCard size={18} />}
                </div>
                <div className="fin-metric-value">
                  {fmt(parseFloat(acc.balance))} <span className="fin-currency">₽</span>
                </div>
              </div>
            ))}
          </div>

          {/* Add account form */}
          <div className="fin-add-category-card">
            <h4 className="fin-section-title">Добавить счёт</h4>
            <div className="fin-add-cat-form">
              <input
                type="text"
                placeholder="Название"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                className="fin-input"
              />
              <Select value={newAccount.type} onValueChange={(v) => setNewAccount({ ...newAccount, type: v as typeof newAccount.type })}>
                <SelectTrigger className="fin-filter-select" style={{ width: "140px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Касса</SelectItem>
                  <SelectItem value="bank">Банк</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="number"
                placeholder="Начальный баланс"
                value={newAccount.balance}
                onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })}
                className="fin-input"
                style={{ width: "160px" }}
              />
              <button
                className="fin-add-btn"
                onClick={() => {
                  if (!newAccount.name.trim()) { toast.error("Введите название"); return; }
                  createAccountMutation.mutate({
                    name: newAccount.name,
                    type: newAccount.type,
                    balance: parseFloat(newAccount.balance) || 0,
                  });
                }}
                disabled={!newAccount.name || createAccountMutation.isPending}
              >
                <Plus size={16} />
                Добавить
              </button>
            </div>
          </div>

          {/* Accounts list */}
          {accounts && accounts.length > 0 && (
            <div className="fin-cat-section" style={{ marginBottom: "24px" }}>
              <div className="fin-cat-section-header">
                <Wallet size={18} />
                <h3>Счета</h3>
                <span className="fin-cat-count">{accounts.length}</span>
              </div>
              <div className="fin-cat-list">
                {accounts.map((acc) => (
                  <div key={acc.id} className="fin-cat-item">
                    {editingAccountId === acc.id ? (
                      <>
                        <input type="text" value={editAccountName} onChange={(e) => setEditAccountName(e.target.value)} className="fin-input fin-input-sm" />
                        <input type="number" value={editAccountBalance} onChange={(e) => setEditAccountBalance(e.target.value)} className="fin-input fin-input-sm" style={{ width: "120px" }} />
                        <button className="fin-cat-action-btn fin-icon-success" onClick={() => {
                          updateAccountMutation.mutate({
                            id: acc.id,
                            name: editAccountName,
                            balance: parseFloat(editAccountBalance) || 0,
                          });
                        }}>
                          <Check size={14} />
                        </button>
                        <button className="fin-cat-action-btn" onClick={() => setEditingAccountId(null)}>
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        {acc.type === "cash" ? <Banknote size={16} /> : acc.type === "bank" ? <Building size={16} /> : <CreditCard size={16} />}
                        <span className="fin-cat-name">{acc.name}</span>
                        <span className="fin-cat-badge">{fmt(parseFloat(acc.balance))} ₽</span>
                        <div className="fin-cat-actions">
                          <button className="fin-cat-edit" onClick={() => {
                            setEditingAccountId(acc.id);
                            setEditAccountName(acc.name);
                            setEditAccountBalance(acc.balance);
                          }}>
                            <Edit3 size={14} />
                          </button>
                          <button className="fin-cat-delete" onClick={() => {
                            if (confirm("Удалить счёт?")) deleteAccountMutation.mutate({ id: acc.id });
                          }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!accounts || accounts.length === 0) && (
            <div className="fin-chart-empty">
              <Wallet size={40} />
              <p>Нет счетов</p>
              <button className="fin-link-btn" onClick={() => initDefaultAccountsMutation.mutate()} disabled={initDefaultAccountsMutation.isPending}>
                <Plus size={14} />
                Создать Касса и Банк
              </button>
            </div>
          )}

          {/* Transfer between accounts */}
          {accounts && accounts.length >= 2 && (
            <div className="fin-add-category-card">
              <h4 className="fin-section-title">
                <ArrowRightLeft size={16} />
                Перевод между счетами
              </h4>
              <div className="fin-add-cat-form">
                <Select value={transfer.fromId} onValueChange={(v) => setTransfer({ ...transfer, fromId: v })}>
                  <SelectTrigger className="fin-filter-select" style={{ width: "140px" }}>
                    <SelectValue placeholder="Откуда" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span style={{ color: "#8B8680" }}>→</span>
                <Select value={transfer.toId} onValueChange={(v) => setTransfer({ ...transfer, toId: v })}>
                  <SelectTrigger className="fin-filter-select" style={{ width: "140px" }}>
                    <SelectValue placeholder="Куда" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.id.toString() !== transfer.fromId).map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="number"
                  placeholder="Сумма"
                  value={transfer.amount}
                  onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
                  className="fin-input"
                  style={{ width: "120px" }}
                />
                <input
                  type="text"
                  placeholder="Описание"
                  value={transfer.description}
                  onChange={(e) => setTransfer({ ...transfer, description: e.target.value })}
                  className="fin-input"
                />
                <input
                  type="date"
                  value={transfer.date}
                  onChange={(e) => setTransfer({ ...transfer, date: e.target.value })}
                  className="fin-date-input"
                />
                <button
                  className="fin-add-btn"
                  onClick={() => {
                    const amount = parseFloat(transfer.amount);
                    if (!transfer.fromId || !transfer.toId || !amount || amount <= 0) {
                      toast.error("Заполните все поля");
                      return;
                    }
                    transferMutation.mutate({
                      fromAccountId: parseInt(transfer.fromId),
                      toAccountId: parseInt(transfer.toId),
                      amount,
                      description: transfer.description || undefined,
                      date: transfer.date,
                    });
                  }}
                  disabled={transferMutation.isPending}
                >
                  <ArrowRightLeft size={16} />
                  Перевести
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== IMPORT ========== */}
      {view === "import" && (
        <>
          <div className="fin-import-container">
            <div className="fin-import-info">
              <h3 className="fin-section-title">Импорт транзакций из CSV</h3>
              <p className="fin-import-desc">
                Загрузите CSV файл с транзакциями. Разделитель — точка с запятой (;).
              </p>
              <div className="fin-import-format">
                <FileSpreadsheet size={16} />
                <div>
                  <strong>Формат CSV файла:</strong>
                  <code className="fin-import-code">
                    дата;тип;сумма;категория;описание;способ_оплаты
                  </code>
                  <div className="fin-import-hints">
                    <span><strong>дата</strong> — дд.мм.гггг или гггг-мм-дд</span>
                    <span><strong>тип</strong> — доход / расход</span>
                    <span><strong>сумма</strong> — число (12500 или 12500.50)</span>
                    <span><strong>категория</strong> — название из списка категорий</span>
                    <span><strong>описание</strong> — текст</span>
                    <span><strong>способ_оплаты</strong> — наличные / карта / перевод / другое</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`fin-dropzone ${isDragging ? "dragging" : ""} ${importCsvMutation.isPending ? "loading" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("csv-file-input")?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
              {importCsvMutation.isPending ? (
                <>
                  <RefreshCw size={36} className="fin-spin" />
                  <p>Импортируем...</p>
                </>
              ) : (
                <>
                  <Upload size={36} />
                  <p>Перетащите CSV файл сюда или нажмите для выбора</p>
                  <span className="fin-dropzone-hint">Поддерживается .csv (UTF-8)</span>
                </>
              )}
            </div>

            {importResult && (
              <div className="fin-import-result">
                <div className="fin-import-result-header">
                  {importResult.imported > 0 ? (
                    <CheckCircle2 size={20} className="fin-icon-success" />
                  ) : (
                    <AlertTriangle size={20} className="fin-icon-warning" />
                  )}
                  <span>Результат импорта</span>
                </div>
                <div className="fin-import-stats">
                  <div className="fin-import-stat">
                    <span className="fin-import-stat-value fin-text-success">{importResult.imported}</span>
                    <span className="fin-import-stat-label">Импортировано</span>
                  </div>
                  <div className="fin-import-stat">
                    <span className="fin-import-stat-value fin-text-warning">{importResult.skipped}</span>
                    <span className="fin-import-stat-label">Пропущено</span>
                  </div>
                  <div className="fin-import-stat">
                    <span className="fin-import-stat-value">{importResult.total}</span>
                    <span className="fin-import-stat-label">Всего строк</span>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="fin-import-errors">
                    <strong>Ошибки:</strong>
                    <ul>
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== ADD TRANSACTION DIALOG ========== */}
      <Dialog open={isAddingTransaction} onOpenChange={setIsAddingTransaction}>
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle>Новая транзакция</DialogTitle>
            <DialogDescription>Добавьте доход, расход или перевод между счетами</DialogDescription>
          </DialogHeader>
          <div className="fin-dialog-body">
            <div className="fin-type-toggle">
              <button
                className={`fin-type-btn ${newTransaction.type === "income" ? "income active" : ""}`}
                onClick={() => setNewTransaction({ ...newTransaction, type: "income", categoryId: undefined })}
              >
                <ArrowUpRight size={16} />
                Доход
              </button>
              <button
                className={`fin-type-btn ${newTransaction.type === "expense" ? "expense active" : ""}`}
                onClick={() => setNewTransaction({ ...newTransaction, type: "expense", categoryId: undefined })}
              >
                <ArrowDownRight size={16} />
                Расход
              </button>
              <button
                className={`fin-type-btn ${newTransaction.type === "transfer" ? "transfer active" : ""}`}
                onClick={() => setNewTransaction({ ...newTransaction, type: "transfer", categoryId: undefined })}
              >
                <ArrowRightLeft size={16} />
                Перевод
              </button>
            </div>
            <div className="form-group">
              <Label>Сумма *</Label>
              <Input
                type="number"
                placeholder="0"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
              />
            </div>
            {newTransaction.type === "transfer" ? (
              <>
                <div className="form-group">
                  <Label>Со счёта *</Label>
                  <Select
                    value={newTransaction.fromAccountId}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите счёт списания" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter(a => a.isActive).map((acc) => (
                        <SelectItem key={acc.id} value={acc.id.toString()} disabled={acc.id.toString() === newTransaction.toAccountId}>
                          {acc.name} ({fmt(parseFloat(acc.balance))} ₽)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label>На счёт *</Label>
                  <Select
                    value={newTransaction.toAccountId}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, toAccountId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите счёт зачисления" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter(a => a.isActive).map((acc) => (
                        <SelectItem key={acc.id} value={acc.id.toString()} disabled={acc.id.toString() === newTransaction.fromAccountId}>
                          {acc.name} ({fmt(parseFloat(acc.balance))} ₽)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <Label>Описание</Label>
                  <Textarea
                    placeholder="Комментарий к переводу..."
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <Label>Категория</Label>
                  <Select
                    value={newTransaction.categoryId?.toString() || ""}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, categoryId: v ? parseInt(v) : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: cat.color || "#6B7280" }} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <Label>Счёт</Label>
                  <Select
                    value={newTransaction.accountId?.toString() || ""}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, accountId: v ? parseInt(v) : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Без привязки к счёту" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label>Описание</Label>
                  <Textarea
                    placeholder="Описание транзакции..."
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingTransaction(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                const amount = parseFloat(newTransaction.amount);
                if (!amount || amount <= 0) {
                  toast.error("Введите корректную сумму");
                  return;
                }
                if (newTransaction.type === "transfer") {
                  if (!newTransaction.fromAccountId || !newTransaction.toAccountId) {
                    toast.error("Выберите оба счёта для перевода");
                    return;
                  }
                  if (newTransaction.fromAccountId === newTransaction.toAccountId) {
                    toast.error("Счета должны быть разными");
                    return;
                  }
                  transferMutation.mutate({
                    fromAccountId: parseInt(newTransaction.fromAccountId),
                    toAccountId: parseInt(newTransaction.toAccountId),
                    amount,
                    description: newTransaction.description || "Перевод между счетами",
                    date: newTransaction.date,
                  }, {
                    onSuccess: () => {
                      setIsAddingTransaction(false);
                      setNewTransaction({
                        type: "expense",
                        categoryId: undefined,
                        accountId: undefined,
                        amount: "",
                        description: "",
                        date: new Date().toISOString().split("T")[0],
                        paymentMethod: "cash",
                        fromAccountId: "",
                        toAccountId: "",
                      });
                    },
                  });
                } else {
                  createTransactionMutation.mutate({
                    type: newTransaction.type as "income" | "expense",
                    categoryId: newTransaction.categoryId,
                    accountId: newTransaction.accountId,
                    amount,
                    description: newTransaction.description || undefined,
                    date: newTransaction.date,
                    paymentMethod: newTransaction.paymentMethod,
                  });
                }
              }}
              disabled={!newTransaction.amount || createTransactionMutation.isPending || transferMutation.isPending}
              className="action-btn action-btn-primary"
            >
              {newTransaction.type === "transfer" ? "Перевести" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const financeStyles = `
/* Sub-navigation */
.fin-subnav {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #F5F2EE;
  border-radius: 12px;
  margin-bottom: 24px;
  width: fit-content;
}

.fin-subnav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #6B6560;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-subnav-item:hover {
  color: #2D2A26;
  background: rgba(255,255,255,0.5);
}

.fin-subnav-item.active {
  background: #FFFCF9;
  color: #C75D3C;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* Toolbar */
.fin-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.fin-toolbar-left {
  flex: 1;
  min-width: 200px;
}

.fin-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Period pills */
.fin-period-pills {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #F5F2EE;
  border-radius: 10px;
}

.fin-pill {
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

.fin-pill:hover {
  color: #2D2A26;
}

.fin-pill.active {
  background: #C75D3C;
  color: white;
}

/* Add button */
.fin-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: #C75D3C;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-add-btn:hover {
  background: #B54D2C;
}

.fin-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fin-outline-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: #FFFCF9;
  color: #6B6560;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-outline-btn:hover {
  border-color: #C75D3C;
  color: #C75D3C;
}

/* Metric cards */
.fin-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1200px) {
  .fin-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .fin-metrics {
    grid-template-columns: 1fr;
  }
}

.fin-metric-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 20px 24px;
  transition: all 0.3s;
}

.fin-metric-card:hover {
  box-shadow: 0 6px 24px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.fin-metric-income {
  border-left: 3px solid #10B981;
}

.fin-metric-expense {
  border-left: 3px solid #EF4444;
}

.fin-metric-profit {
  border-left: 3px solid #10B981;
  background: linear-gradient(135deg, rgba(16,185,129,0.04) 0%, #FFFCF9 100%);
}

.fin-metric-loss {
  border-left: 3px solid #EF4444;
  background: linear-gradient(135deg, rgba(239,68,68,0.04) 0%, #FFFCF9 100%);
}

.fin-metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.fin-metric-label {
  font-size: 12px;
  font-weight: 600;
  color: #8B8680;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fin-metric-header svg {
  color: #B5B0AA;
}

.fin-metric-income .fin-metric-header svg { color: #10B981; }
.fin-metric-expense .fin-metric-header svg { color: #EF4444; }
.fin-metric-profit .fin-metric-header svg { color: #10B981; }
.fin-metric-loss .fin-metric-header svg { color: #EF4444; }

.fin-metric-value {
  font-family: 'Sora', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #2D2A26;
  line-height: 1.2;
}

.fin-metric-income .fin-metric-value { color: #059669; }
.fin-metric-expense .fin-metric-value { color: #DC2626; }
.fin-metric-profit .fin-metric-value { color: #059669; }
.fin-metric-loss .fin-metric-value { color: #DC2626; }

.fin-currency {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.7;
}

.fin-metric-sub {
  font-size: 12px;
  color: #8B8680;
  margin-top: 4px;
}

/* Charts */
.fin-charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .fin-charts-row {
    grid-template-columns: 1fr;
  }
}

.fin-chart-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.fin-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 0;
}

.fin-chart-title {
  font-family: 'Sora', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #2D2A26;
  margin: 0;
}

.fin-chart-subtitle {
  font-size: 12px;
  color: #8B8680;
  margin: 2px 0 0;
}

.fin-chart-body {
  padding: 20px;
}

.fin-chart-empty {
  height: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #B5B0AA;
  gap: 12px;
}

.fin-chart-empty p {
  font-size: 14px;
}

.fin-chart-empty-sm {
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8B8680;
}

.fin-link-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #E8E4DF;
  border-radius: 8px;
  color: #C75D3C;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-link-btn:hover {
  background: #FEF2F0;
  border-color: #C75D3C;
}

/* Legend */
.fin-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}

.fin-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.fin-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fin-legend-name {
  flex: 1;
  color: #4A4540;
}

.fin-legend-value {
  font-weight: 600;
  color: #2D2A26;
  font-family: 'Sora', sans-serif;
  font-size: 12px;
}

/* Bottom row */
.fin-bottom-row {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .fin-bottom-row {
    grid-template-columns: 1fr;
  }
}

/* Quick actions */
.fin-quick-actions {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 20px;
}

.fin-section-title {
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #2D2A26;
  margin: 0 0 16px;
}

.fin-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.fin-action-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  background: #F5F2EE;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #6B6560;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-action-tile:hover {
  background: #EDE9E4;
  border-color: #E8E4DF;
}

.fin-action-income {
  color: #059669;
  background: rgba(16,185,129,0.08);
}

.fin-action-income:hover {
  background: rgba(16,185,129,0.15);
}

.fin-action-expense {
  color: #DC2626;
  background: rgba(239,68,68,0.08);
}

.fin-action-expense:hover {
  background: rgba(239,68,68,0.15);
}

/* Recent transactions */
.fin-recent-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.fin-recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #E8E4DF;
}

.fin-see-all {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #C75D3C;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.fin-see-all:hover {
  color: #B54D2C;
}

.fin-recent-list {
  padding: 8px;
}

.fin-recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  transition: background 0.2s;
}

.fin-recent-item:hover {
  background: #F5F2EE;
}

.fin-recent-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.fin-recent-icon.income {
  background: rgba(16,185,129,0.12);
  color: #059669;
}

.fin-recent-icon.expense {
  background: rgba(239,68,68,0.12);
  color: #DC2626;
}

.fin-recent-info {
  flex: 1;
  min-width: 0;
}

.fin-recent-desc {
  font-size: 13px;
  font-weight: 500;
  color: #2D2A26;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fin-recent-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8B8680;
  margin-top: 2px;
}

.fin-recent-cat {
  font-weight: 500;
}

.fin-recent-amount {
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.fin-recent-amount.income {
  color: #059669;
}

.fin-recent-amount.expense {
  color: #DC2626;
}

.fin-empty-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #B5B0AA;
  gap: 12px;
}

.fin-empty-mini p {
  font-size: 14px;
}

/* ========== TRANSACTIONS VIEW ========== */
.fin-search-box {
  position: relative;
  width: 100%;
  max-width: 320px;
}

.fin-search-box svg {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #8B8680;
}

.fin-search-box input {
  width: 100%;
  padding: 10px 10px 10px 40px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  font-size: 13px;
  color: #2D2A26;
  outline: none;
  transition: border-color 0.2s;
}

.fin-search-box input:focus {
  border-color: #C75D3C;
}

.fin-filter-select {
  width: 130px;
  background: #FFFCF9;
  border-color: #E8E4DF;
}

.fin-date-input {
  padding: 9px 12px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  font-size: 13px;
  color: #2D2A26;
  outline: none;
  width: 140px;
}

.fin-date-input:focus {
  border-color: #C75D3C;
}

.fin-tx-summary {
  font-size: 13px;
  color: #8B8680;
  margin-bottom: 16px;
}

.fin-tx-summary strong {
  color: #2D2A26;
}

.fin-tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fin-tx-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 12px;
  transition: all 0.2s;
}

.fin-tx-item:hover {
  border-color: #D5D0CB;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.fin-tx-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.fin-tx-icon.income {
  background: rgba(16,185,129,0.12);
  color: #059669;
}

.fin-tx-icon.expense {
  background: rgba(239,68,68,0.12);
  color: #DC2626;
}

.fin-tx-body {
  flex: 1;
  min-width: 0;
}

.fin-tx-desc {
  font-size: 14px;
  font-weight: 500;
  color: #2D2A26;
}

.fin-tx-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #8B8680;
  margin-top: 4px;
  flex-wrap: wrap;
}

.fin-tx-cat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.fin-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.fin-tx-method {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fin-badge-auto {
  font-size: 10px !important;
  padding: 1px 6px !important;
}

.fin-tx-amount {
  font-family: 'Sora', sans-serif;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  min-width: 100px;
  text-align: right;
}

.fin-tx-amount.income {
  color: #059669;
}

.fin-tx-amount.expense {
  color: #DC2626;
}

.fin-tx-delete {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #B5B0AA;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.fin-tx-delete:hover {
  background: #FEF2F2;
  color: #EF4444;
}

.fin-loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.fin-spin {
  animation: spin 1s linear infinite;
  color: #C75D3C;
}

.fin-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: #B5B0AA;
  gap: 12px;
}

.fin-empty-state p {
  font-size: 15px;
}

.fin-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.fin-pagination-info {
  font-size: 14px;
  color: #6B6560;
}

/* ========== CATEGORIES VIEW ========== */
.fin-categories-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .fin-categories-grid {
    grid-template-columns: 1fr;
  }
}

.fin-cat-section {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.fin-cat-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 24px;
  border-bottom: 1px solid #E8E4DF;
}

.fin-cat-section-header h3 {
  font-family: 'Sora', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #2D2A26;
  margin: 0;
  flex: 1;
}

.fin-icon-income {
  color: #10B981;
}

.fin-icon-expense {
  color: #EF4444;
}

.fin-cat-count {
  font-size: 12px;
  font-weight: 600;
  color: #8B8680;
  background: #F5F2EE;
  padding: 2px 10px;
  border-radius: 20px;
}

.fin-cat-list {
  padding: 8px;
}

.fin-cat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  transition: background 0.2s;
}

.fin-cat-item:hover {
  background: #F5F2EE;
}

.fin-cat-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fin-cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #2D2A26;
}

.fin-cat-badge {
  font-size: 10px;
  font-weight: 500;
  color: #8B8680;
  background: #F5F2EE;
  padding: 2px 8px;
  border-radius: 6px;
}

.fin-cat-actions {
  display: flex;
  gap: 4px;
}

.fin-cat-delete {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #B5B0AA;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-cat-delete:hover {
  background: #FEF2F2;
  color: #EF4444;
}

.fin-cat-edit {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #B5B0AA;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-cat-edit:hover {
  background: #FFF7ED;
  color: #C75D3C;
}

.fin-cat-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #B5B0AA;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-cat-action-btn:hover {
  background: #F5F0EB;
  color: #6B5E54;
}

.fin-cat-action-btn.fin-icon-success:hover {
  background: #ECFDF5;
  color: #10B981;
}

.fin-color-input-sm {
  width: 32px;
  height: 32px;
  border: 1px solid #E8E4DF;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
}

.fin-input-sm {
  min-width: auto !important;
  flex: none !important;
  width: 160px;
  padding: 6px 10px !important;
  font-size: 13px !important;
  height: 32px;
}

.fin-cat-empty {
  padding: 24px;
  text-align: center;
  color: #8B8680;
  font-size: 13px;
}

/* Add category card */
.fin-add-category-card {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  padding: 24px;
}

.fin-add-cat-form {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.fin-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  font-size: 13px;
  color: #2D2A26;
  outline: none;
}

.fin-input:focus {
  border-color: #C75D3C;
}

.fin-color-input {
  width: 44px;
  height: 40px;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  padding: 4px;
  cursor: pointer;
  background: #FFFCF9;
}

/* Dialog type toggle */
.fin-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.fin-type-toggle {
  display: flex;
  gap: 8px;
}

.fin-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid #E8E4DF;
  border-radius: 10px;
  background: transparent;
  color: #6B6560;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fin-type-btn:hover {
  border-color: #C75D3C;
}

.fin-type-btn.income.active {
  background: rgba(16,185,129,0.1);
  border-color: #10B981;
  color: #059669;
}

.fin-type-btn.expense.active {
  background: rgba(239,68,68,0.1);
  border-color: #EF4444;
  color: #DC2626;
}

.fin-type-btn.transfer.active {
  background: rgba(59,130,246,0.1);
  border-color: #3B82F6;
  color: #2563EB;
}

/* ========== IMPORT ========== */
.fin-import-container {
  max-width: 700px;
}

.fin-import-info {
  margin-bottom: 24px;
}

.fin-import-desc {
  font-size: 14px;
  color: #6B6560;
  margin: 8px 0 20px;
}

.fin-import-format {
  display: flex;
  gap: 14px;
  padding: 20px;
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 12px;
  font-size: 13px;
  color: #4A4540;
  line-height: 1.6;
}

.fin-import-format svg {
  flex-shrink: 0;
  color: #C75D3C;
  margin-top: 2px;
}

.fin-import-code {
  display: block;
  margin: 8px 0 12px;
  padding: 8px 12px;
  background: #F5F2EE;
  border-radius: 8px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #C75D3C;
}

.fin-import-hints {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8B8680;
}

.fin-import-hints strong {
  color: #4A4540;
}

.fin-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 32px;
  border: 2px dashed #D5D0CB;
  border-radius: 16px;
  background: #FFFCF9;
  color: #8B8680;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 24px;
}

.fin-dropzone:hover {
  border-color: #C75D3C;
  background: #FEF8F5;
  color: #C75D3C;
}

.fin-dropzone.dragging {
  border-color: #C75D3C;
  background: #FEF2F0;
  color: #C75D3C;
}

.fin-dropzone.loading {
  pointer-events: none;
  opacity: 0.7;
}

.fin-dropzone p {
  font-size: 15px;
  font-weight: 500;
}

.fin-dropzone-hint {
  font-size: 12px;
  opacity: 0.7;
}

.fin-import-result {
  background: #FFFCF9;
  border: 1px solid #E8E4DF;
  border-radius: 16px;
  overflow: hidden;
}

.fin-import-result-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 24px;
  border-bottom: 1px solid #E8E4DF;
  font-weight: 600;
  color: #2D2A26;
  font-size: 14px;
}

.fin-icon-success { color: #10B981; }
.fin-icon-warning { color: #F59E0B; }

.fin-import-stats {
  display: flex;
  gap: 32px;
  padding: 20px 24px;
}

.fin-import-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fin-import-stat-value {
  font-family: 'Sora', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #2D2A26;
}

.fin-text-success { color: #059669; }
.fin-text-warning { color: #F59E0B; }

.fin-import-stat-label {
  font-size: 12px;
  color: #8B8680;
}

.fin-import-errors {
  padding: 16px 24px;
  border-top: 1px solid #E8E4DF;
  font-size: 13px;
  color: #6B6560;
}

.fin-import-errors strong {
  display: block;
  margin-bottom: 8px;
  color: #DC2626;
}

.fin-import-errors ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.fin-import-errors li {
  padding: 4px 0;
  border-bottom: 1px solid #F5F2EE;
}

.fin-import-errors li:last-child {
  border-bottom: none;
}
`;
