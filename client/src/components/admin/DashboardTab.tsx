import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import PeriodSelector, { usePeriod } from "./PeriodSelector";
import {
  RussianRuble,
  ShoppingCart,
  Package,
  MessageSquare,
  UserPlus,
  Receipt,
  TrendingUp,
  Banknote,
  CreditCard,
  ArrowRightLeft,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = ["#C75D3C", "#E8A87C", "#85CDCA", "#E27D60", "#41B3A3", "#659DBD"];

type DashboardSource = "website" | "offline" | "all";

const sourceLabels: Record<DashboardSource, string> = {
  website: "Сайт",
  offline: "Магазин",
  all: "Всё",
};

const paymentLabels: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  other: "Другое",
};

const paymentIcons: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowRightLeft,
  other: Receipt,
};

export default function DashboardTab() {
  const [source, setSource] = useState<DashboardSource>("website");
  const { range, handleChange } = usePeriod("30d");

  const dateRange = useMemo(() => ({
    dateFrom: range.dateFrom.toISOString(),
    dateTo: range.dateTo.toISOString(),
  }), [range]);

  // ── Queries for website / all ──
  const { data: summary } = trpc.stats.summary.useQuery(
    { ...dateRange, source },
    { enabled: source !== "offline" }
  );

  const { data: salesByPeriod } = trpc.stats.salesByPeriod.useQuery(
    { ...dateRange, source },
    { enabled: source !== "offline" }
  );

  const { data: salesByCategory } = trpc.stats.salesByCategory.useQuery(
    { ...dateRange, source },
    { enabled: source !== "offline" }
  );

  const { data: popularProducts } = trpc.stats.popularProducts.useQuery(
    { ...dateRange, source, limit: 10 },
    { enabled: source !== "offline" }
  );

  // ── Queries for offline ──
  const { data: shopStats } = trpc.shop.stats.useQuery(
    dateRange,
    { enabled: source === "offline" }
  );

  const { data: shopSalesByDay } = trpc.shop.salesByDay.useQuery(
    dateRange,
    { enabled: source === "offline" }
  );

  const { data: shopTopProducts } = trpc.shop.topProducts.useQuery(
    { ...dateRange, limit: 10 },
    { enabled: source === "offline" }
  );

  // ── Derived data ──
  const kpis = useMemo(() => {
    if (source === "offline") {
      return {
        revenue: shopStats?.revenue || 0,
        orders: shopStats?.salesCount || 0,
        avgCheck: Math.round(shopStats?.avgCheck || 0),
        items: shopStats?.itemsSold || 0,
        completedOrders: shopStats?.salesCount || 0,
        contactRequests: 0,
        newCustomers: 0,
      };
    }
    return {
      revenue: summary?.totalRevenue || 0,
      orders: summary?.totalOrders || 0,
      avgCheck: Math.round(summary?.avgCheck || 0),
      items: summary?.totalItems || 0,
      completedOrders: summary?.completedOrders || 0,
      contactRequests: summary?.contactRequests || 0,
      newCustomers: summary?.newCustomers || 0,
    };
  }, [source, summary, shopStats]);

  const conversionPct = kpis.orders > 0
    ? Math.round((kpis.completedOrders / kpis.orders) * 100)
    : 0;

  const chartData = source === "offline" ? shopSalesByDay : salesByPeriod;
  const topData = source === "offline"
    ? (shopTopProducts || []).map((p) => ({
        name: p.name,
        article: p.article,
        category: "",
        quantity: p.quantity,
        revenue: p.revenue,
      }))
    : (popularProducts || []).map((p) => ({
        name: p.productName,
        article: p.productArticle,
        category: p.productCategory,
        quantity: p.totalQuantity,
        revenue: parseFloat(String(p.totalRevenue)),
      }));

  const maxRevenue = Math.max(...topData.map((p) => p.revenue), 1);

  return (
    <div className="dash">
      <style>{dashStyles}</style>

      {/* Header */}
      <div className="dash-header">
        <div>
          <h2 className="dash-title">Дашборд</h2>
          <p className="dash-subtitle">Статистика и аналитика</p>
        </div>
        <PeriodSelector defaultPreset="30d" onChange={handleChange} />
      </div>

      {/* Source tabs */}
      <div className="dash-tabs">
        {(["website", "offline", "all"] as DashboardSource[]).map((s) => (
          <button
            key={s}
            className={`dash-tab ${source === s ? "dash-tab-active" : ""}`}
            onClick={() => setSource(s)}
          >
            {sourceLabels[s]}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="dash-kpis">
        <div className="dash-kpi dash-kpi-primary">
          <div className="dash-kpi-icon"><RussianRuble size={20} /></div>
          <div className="dash-kpi-value">{kpis.revenue.toLocaleString("ru-RU")} ₽</div>
          <div className="dash-kpi-label">Выручка</div>
        </div>

        <div className="dash-kpi">
          <div className="dash-kpi-icon"><ShoppingCart size={20} /></div>
          <div className="dash-kpi-value">{kpis.orders}</div>
          <div className="dash-kpi-label">{source === "offline" ? "Продаж" : "Заказов"}</div>
        </div>

        {source === "website" ? (
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><TrendingUp size={20} /></div>
            <div className="dash-kpi-value">{conversionPct}%</div>
            <div className="dash-kpi-label">Конверсия ({kpis.completedOrders} из {kpis.orders})</div>
          </div>
        ) : (
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><Receipt size={20} /></div>
            <div className="dash-kpi-value">{kpis.avgCheck.toLocaleString("ru-RU")} ₽</div>
            <div className="dash-kpi-label">Средний чек</div>
          </div>
        )}

        <div className="dash-kpi">
          <div className="dash-kpi-icon"><Package size={20} /></div>
          <div className="dash-kpi-value">{kpis.items}</div>
          <div className="dash-kpi-label">Товаров продано</div>
        </div>

        {source !== "offline" && (
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><MessageSquare size={20} /></div>
            <div className="dash-kpi-value">{kpis.contactRequests}</div>
            <div className="dash-kpi-label">Заявки на звонок</div>
          </div>
        )}

        {source !== "offline" && (
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><UserPlus size={20} /></div>
            <div className="dash-kpi-value">{kpis.newCustomers}</div>
            <div className="dash-kpi-label">Новых клиентов</div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="dash-charts-row">
        {/* Area Chart */}
        <div className="dash-chart-box dash-chart-wide">
          <h3>Динамика продаж</h3>
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C75D3C" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C75D3C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tickFormatter={(v) => {
                    if (source === "offline") {
                      const d = new Date(v);
                      return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                    }
                    return v;
                  }}
                />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                <Tooltip
                  formatter={(val: number) => [`${Number(val).toLocaleString("ru-RU")} ₽`, "Выручка"]}
                  labelFormatter={(l) => {
                    if (source === "offline") {
                      const d = new Date(l);
                      return d.toLocaleDateString("ru-RU");
                    }
                    return l;
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#C75D3C" fill="url(#dashGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-empty">Нет данных за выбранный период</div>
          )}
        </div>

        {/* Right panel: PieChart or Payment Breakdown */}
        <div className="dash-chart-box">
          {source === "offline" ? (
            <>
              <h3>Способы оплаты</h3>
              {shopStats?.byPayment && shopStats.byPayment.length > 0 ? (
                <div className="dash-payment-list">
                  {shopStats.byPayment.map((pm) => {
                    const Icon = paymentIcons[pm.method || "other"] || Receipt;
                    const total = parseFloat(pm.total || "0");
                    const pct = shopStats.revenue > 0 ? (total / shopStats.revenue * 100) : 0;
                    return (
                      <div key={pm.method} className="dash-payment-row">
                        <div className="dash-payment-info">
                          <Icon size={18} />
                          <span>{paymentLabels[pm.method || "other"] || pm.method}</span>
                        </div>
                        <div className="dash-payment-bar-wrap">
                          <div className="dash-payment-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="dash-payment-values">
                          <span className="dash-payment-amount">{total.toLocaleString("ru-RU")} ₽</span>
                          <span className="dash-payment-count">{pm.count} продаж</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dash-empty">Нет данных</div>
              )}
            </>
          ) : (
            <>
              <h3>По категориям</h3>
              {salesByCategory && salesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="totalRevenue"
                      nameKey="category"
                      paddingAngle={2}
                    >
                      {salesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#FFFCF9", border: "1px solid #E5E2DD", borderRadius: "12px" }}
                      formatter={(value: number) => [`${parseFloat(String(value)).toLocaleString("ru-RU")} ₽`, ""]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="dash-empty">Нет данных</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="dash-chart-box">
        <h3>Топ товаров</h3>
        {topData.length > 0 ? (
          <div className="dash-top-list">
            {topData.map((p, i) => (
              <div key={p.article || i} className="dash-top-row">
                <span className="dash-top-rank">{i + 1}</span>
                <div className="dash-top-info">
                  <span className="dash-top-name">{p.name}</span>
                  <span className="dash-top-article">
                    {p.article}
                    {p.category && ` · ${p.category}`}
                  </span>
                </div>
                <div className="dash-top-bar-wrap">
                  <div className="dash-top-bar" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                </div>
                <div className="dash-top-values">
                  <span className="dash-top-revenue">{p.revenue.toLocaleString("ru-RU")} ₽</span>
                  <span className="dash-top-qty">{p.quantity} шт.</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty">Нет данных за выбранный период</div>
        )}
      </div>
    </div>
  );
}

const dashStyles = `
.dash { display: flex; flex-direction: column; gap: 20px; }

.dash-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.dash-title { font-size: 22px; font-weight: 700; color: #3D3530; margin: 0; }
.dash-subtitle { font-size: 14px; color: #9A938C; margin: 4px 0 0; }

.dash-tabs { display: flex; gap: 6px; }
.dash-tab {
  padding: 6px 16px; border-radius: 8px; border: 1px solid #E8E4DF;
  background: white; font-size: 13px; color: #6B5E54; cursor: pointer;
  font-weight: 600; transition: all 0.15s;
}
.dash-tab:hover { border-color: #C75D3C; color: #C75D3C; }
.dash-tab-active { background: #C75D3C; color: white; border-color: #C75D3C; }
.dash-tab-active:hover { background: #B04E30; color: white; }

.dash-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
.dash-kpi { background: white; border: 1px solid #E8E4DF; border-radius: 12px; padding: 16px; }
.dash-kpi-primary { background: linear-gradient(135deg, #C75D3C 0%, #E27D60 100%); color: white; border: none; }
.dash-kpi-primary .dash-kpi-icon { background: rgba(255,255,255,0.2); color: white; }
.dash-kpi-primary .dash-kpi-label { color: rgba(255,255,255,0.8); }
.dash-kpi-primary .dash-kpi-value { color: white; }
.dash-kpi-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: #FFF7ED; color: #C75D3C; margin-bottom: 10px; }
.dash-kpi-value { font-size: 22px; font-weight: 700; color: #3D3530; margin-bottom: 2px; }
.dash-kpi-label { font-size: 12px; color: #9A938C; }

.dash-charts-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.dash-chart-box { background: white; border: 1px solid #E8E4DF; border-radius: 12px; padding: 16px; }
.dash-chart-box h3 { margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #3D3530; }

.dash-empty { text-align: center; padding: 40px; color: #9A938C; font-size: 14px; }

/* Payment breakdown */
.dash-payment-list { display: flex; flex-direction: column; gap: 14px; }
.dash-payment-row { display: flex; align-items: center; gap: 12px; }
.dash-payment-info { display: flex; align-items: center; gap: 8px; min-width: 110px; font-size: 14px; color: #3D3530; }
.dash-payment-bar-wrap { flex: 1; height: 8px; background: #F0EDE8; border-radius: 4px; overflow: hidden; }
.dash-payment-bar { height: 100%; background: #C75D3C; border-radius: 4px; transition: width 0.3s; }
.dash-payment-values { text-align: right; min-width: 120px; }
.dash-payment-amount { font-size: 14px; font-weight: 600; color: #3D3530; }
.dash-payment-count { font-size: 12px; color: #9A938C; margin-left: 6px; }

/* Top products */
.dash-top-list { display: flex; flex-direction: column; gap: 8px; }
.dash-top-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.dash-top-rank { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; flex-shrink: 0; }
.dash-top-info { min-width: 160px; flex-shrink: 0; }
.dash-top-name { font-size: 14px; color: #3D3530; display: block; }
.dash-top-article { font-size: 11px; color: #9A938C; }
.dash-top-bar-wrap { flex: 1; height: 8px; background: #F0EDE8; border-radius: 4px; overflow: hidden; }
.dash-top-bar { height: 100%; background: linear-gradient(90deg, #C75D3C, #E8A87C); border-radius: 4px; transition: width 0.3s; }
.dash-top-values { text-align: right; min-width: 120px; flex-shrink: 0; }
.dash-top-revenue { font-size: 14px; font-weight: 600; color: #3D3530; }
.dash-top-qty { font-size: 12px; color: #9A938C; margin-left: 6px; }

@media (max-width: 1024px) {
  .dash-charts-row { grid-template-columns: 1fr; }
  .dash-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .dash-kpis { grid-template-columns: 1fr; }
}
`;
