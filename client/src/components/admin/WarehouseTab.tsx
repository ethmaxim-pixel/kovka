import { useState, useMemo, useRef, useCallback, useEffect, memo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  AlertTriangle,
  CheckCircle2,
  History,
  Edit3,
  Check,
  X,
  ChevronDown,
  FolderPlus,
  FileSpreadsheet,
  Upload,
  Barcode,
  Trash2,
} from "lucide-react";
import { PrintLabelsDialog } from "./PrintLabelsDialog";
import * as XLSX from "xlsx";

type WarehouseView = "stock" | "history";

const reasonLabels: Record<string, string> = {
  purchase: "Закупка",
  sale: "Продажа",
  defect: "Брак",
  return: "Возврат",
  correction: "Коррекция",
  other: "Другое",
};

// ── SKU prefix map (3 letter prefix from category) ──
const skuPrefixMap: Record<string, string> = {
  "Балясины": "БАЛ",
  "Вензеля и волюты": "ВНЗ",
  "Виноград": "ВНГ",
  "Вставки в балясины": "ВСТ",
  "Декор полосы": "ДКП",
  "Декоративные панели": "ДПН",
  "Декоративные элементы": "ДЭЛ",
  "Заглушки, крышки": "ЗГЛ",
  "Заклёпки": "ЗКЛ",
  "Кованый виноград": "КВН",
  "Кольца и квадраты": "КОЛ",
  "Корзинки": "КРЗ",
  "Листья": "ЛСТ",
  "Листья кованые": "ЛСК",
  "Литые элементы": "ЛИТ",
  "Навершия": "НВР",
  "Накладки": "НКЛ",
  "Наконечники, навершия": "НКН",
  "Основания": "ОСН",
  "Основания балясин": "ОСБ",
  "Переходы на трубы": "ПРТ",
  "Пики": "ПИК",
  "Пики кованые": "ПИК",
  "Пластиковые заглушки": "ПЗГ",
  "Полусферы": "ПСФ",
  "Поручень, окончание поручня": "ПРЧ",
  "Поручни": "ПРЧ",
  "Розетки": "РЗТ",
  "Ручки дверные": "РДВ",
  "Столбы и трубы": "СТТ",
  "Столбы начальные": "СТН",
  "Цветы": "ЦВТ",
  "Цветы кованые": "ЦВК",
  "Цифры": "ЦФР",
  "Шары и сферы": "ШАР",
  "Штампованные элементы": "ШТМ",
  "Ящики почтовые": "ЯЩП",
  // Краски, патина
  "Кузнечные краски": "КРС",
  "Патина": "ПТН",
  // Художественный прокат
  "Виноградная лоза": "ВЛЗ",
  "Квадрат": "КВД",
  "Обжимная полоса": "ОБЖ",
  "Декоративная полоса": "ДПЛ",
  "Труба витая": "ТВТ",
  "Труба декоративная": "ТДК",
  // Металлопрокат
  "Арматура": "АРМ",
  "Круг стальной": "КРГ",
  "Стальные трубы": "СТР",
  "Квадрат стальной": "КВС",
  "Стальные листы": "СЛС",
  "Уголок стальной": "УГЛ",
  "Стальная полоса": "СПЛ",
  "Балка и двутавр": "БЛК",
  "Швеллер и п-профиль": "ШВЛ",
  "Шестигранник": "ШСТ",
  "Конструкционные": "КНС",
  "Сталь с покрытием": "СПК",
  // Сопутствующие товары
  "Крепление ограждений": "КРО",
  "Отрезные диски": "ОТД",
  "Перчатки": "ПРЧ",
  "Петли": "ПТЛ",
  "Сварочные материалы": "СВР",
};

function getSkuPrefix(category: string): string {
  return skuPrefixMap[category] || category.substring(0, 3).toUpperCase();
}

// ── Searchable category dropdown (shared pattern) ──
function CategoryDropdown({
  value,
  onChange,
  categories,
  placeholder = "Все категории",
}: {
  value: string;
  onChange: (val: string) => void;
  categories: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div style={{ position: "relative" }}>
      <button type="button" style={styles.dropdownTrigger} onClick={() => setOpen(!open)}>
        <span style={value && value !== "all" ? {} : { color: "#999" }}>
          {value && value !== "all" ? value : placeholder}
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && (
        <>
          <div style={styles.dropdownOverlay} onClick={() => { setOpen(false); setSearch(""); }} />
          <div style={styles.dropdownMenu}>
            <div style={styles.dropdownSearch}>
              <Search size={14} />
              <input autoFocus placeholder="Найти категорию..." value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: "13px", color: "#3D3530" }} />
            </div>
            <div style={styles.dropdownList}>
              <div style={{ ...styles.dropdownItem, ...((!value || value === "all") ? styles.dropdownItemActive : {}) }}
                onClick={() => handleSelect("all")}>{placeholder}</div>
              {filtered.map((cat) => (
                <div key={cat} style={{ ...styles.dropdownItem, ...(value === cat ? styles.dropdownItemActive : {}) }}
                  onClick={() => handleSelect(cat)}>
                  {cat}
                  {value === cat && <Check size={14} />}
                </div>
              ))}
              {filtered.length === 0 && search && <div style={{ padding: "8px 12px", color: "#999", fontSize: "13px" }}>Ничего не найдено</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Product search input with debounce ──
function ProductSearchInput({
  onSelect,
  inStockOnly = false,
  placeholder = "Поиск товара...",
  selectedProduct,
}: {
  onSelect: (product: { id: number; article: string; name: string; category: string | null; stockQuantity: number | null }) => void;
  inStockOnly?: boolean;
  placeholder?: string;
  selectedProduct?: { id: number; name: string; article: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const { data: results = [] } = trpc.warehouse.searchProducts.useQuery(
    { query: debouncedQuery, inStockOnly, limit: 20 },
    { enabled: debouncedQuery.length >= 1 }
  );

  const handleSelect = (p: typeof results[0]) => {
    onSelect(p);
    setQuery("");
    setOpen(false);
  };

  if (selectedProduct) {
    return (
      <div style={styles.selectedProduct}>
        <div>
          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{selectedProduct.article}</span>
          {" — "}
          <span style={{ fontWeight: 500 }}>{selectedProduct.name}</span>
        </div>
        <button type="button" onClick={() => onSelect(null as any)} style={styles.clearBtn}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={styles.searchInputWrap}>
        <Search size={14} style={{ color: "#999" }} />
        <input
          style={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <>
          <div style={styles.dropdownOverlay} onClick={() => setOpen(false)} />
          <div style={styles.searchResults}>
            {results.map((p) => (
              <div key={p.id} style={styles.searchResultItem} onClick={() => handleSelect(p)}>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{p.article}</span>
                {" — "}
                <span>{p.name}</span>
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#666" }}>
                  {p.stockQuantity ?? 0} шт
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Excel Import Dialog ──
function ExcelImportDialog({
  open,
  onClose,
  existingArticles,
}: {
  open: boolean;
  onClose: () => void;
  existingArticles: Set<string>;
}) {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const importMutation = trpc.warehouse.importExcel.useMutation();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws);

    const mapped = rows.map((r: any) => ({
      article: String(r["Артикул"] || r["article"] || "").trim(),
      name: String(r["Название"] || r["name"] || "").trim(),
      category: String(r["Категория"] || r["category"] || "").trim() || undefined,
      quantity: Number(r["Количество"] || r["quantity"] || 0),
      purchasePrice: r["Цена закупки"] || r["purchasePrice"] ? Number(r["Цена закупки"] || r["purchasePrice"]) : undefined,
      supplierName: String(r["Поставщик"] || r["supplierName"] || "").trim() || undefined,
    })).filter((r: any) => r.article && r.name);

    setParsedRows(mapped);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importMutation.mutateAsync({ rows: parsedRows });
      toast.success(`Импорт завершён: создано ${result.created}, обновлено ${result.updated}`);
      if (result.errors.length > 0) {
        toast.error(`Ошибки: ${result.errors.join(", ")}`);
      }
      utils.warehouse.overview.invalidate();
      utils.warehouse.movements.invalidate();
      setParsedRows([]);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setParsedRows([]); onClose(); } }}>
      <DialogContent className="dialog-content wh-modal" style={{ maxWidth: 700 }}>
        <DialogHeader>
          <DialogTitle>Импорт из Excel</DialogTitle>
          <DialogDescription>Загрузите файл .xlsx с данными о товарах</DialogDescription>
        </DialogHeader>

        <div style={{ marginBottom: 16 }}>
          <Label style={{ marginBottom: 8, display: "block", fontWeight: 600 }}>Шаблон таблицы:</Label>
          <div style={styles.templateTable}>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f0eb" }}>
                  {["Артикул *", "Название *", "Категория", "Количество", "Цена закупки", "Поставщик"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5ddd5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ color: "#888" }}>
                  <td style={{ padding: "4px 8px" }}>БАЛ-001</td>
                  <td style={{ padding: "4px 8px" }}>Балясина кованая</td>
                  <td style={{ padding: "4px 8px" }}>Балясины</td>
                  <td style={{ padding: "4px 8px" }}>50</td>
                  <td style={{ padding: "4px 8px" }}>335</td>
                  <td style={{ padding: "4px 8px" }}>СтудияКовки</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <button type="button" style={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
            <Upload size={16} />
            <span>Выбрать файл .xlsx</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" style={{ display: "none" }} onChange={handleFile} />
        </div>

        {parsedRows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Label style={{ marginBottom: 8, display: "block" }}>
              Предпросмотр ({parsedRows.length} строк):
            </Label>
            <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #e5ddd5", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f0eb", position: "sticky", top: 0 }}>
                    <th style={styles.th}>Статус</th>
                    <th style={styles.th}>Артикул</th>
                    <th style={styles.th}>Название</th>
                    <th style={styles.th}>Категория</th>
                    <th style={styles.th}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => {
                    const isNew = !existingArticles.has(r.article);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f0ebe5" }}>
                        <td style={styles.td}>
                          <span style={{
                            padding: "2px 6px", borderRadius: 4, fontSize: "11px", fontWeight: 600,
                            background: isNew ? "#E3F2FD" : "#E8F5E9",
                            color: isNew ? "#1565C0" : "#2E7D32",
                          }}>
                            {isNew ? "Создать" : "Обновить"}
                          </span>
                        </td>
                        <td style={{ ...styles.td, fontFamily: "monospace" }}>{r.article}</td>
                        <td style={styles.td}>{r.name}</td>
                        <td style={styles.td}>{r.category || "—"}</td>
                        <td style={styles.td}>{r.quantity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setParsedRows([]); onClose(); }}>Отмена</Button>
          <Button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || importing}
            style={{ background: "#C75D3C", color: "white" }}
          >
            {importing ? "Импорт..." : `Импортировать (${parsedRows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Product Quick Edit Dialog ──
function ProductEditDialog({
  product,
  onClose,
}: {
  product: { id: number; article: string; name: string; category: string | null; stockQuantity: number | null; minStockLevel: number | null; sku?: string | null } | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const utils = trpc.useUtils();
  const updateMutation = trpc.warehouse.updateProductQuick.useMutation();

  useEffect(() => {
    if (product) {
      setName(product.name);
      setQty(String(product.stockQuantity ?? 0));
      setMinLevel(String(product.minStockLevel ?? 0));
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;
    try {
      await updateMutation.mutateAsync({
        productId: product.id,
        name: name !== product.name ? name : undefined,
        stockQuantity: Number(qty) !== (product.stockQuantity ?? 0) ? Number(qty) : undefined,
        minStockLevel: Number(minLevel) !== (product.minStockLevel ?? 0) ? Number(minLevel) : undefined,
      });
      toast.success("Товар обновлён");
      utils.warehouse.overview.invalidate();
      utils.warehouse.movements.invalidate();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="dialog-content wh-modal" style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>Редактировать товар</DialogTitle>
          <DialogDescription>
            Артикул: <code style={{ fontFamily: "monospace", background: "#f5f0eb", padding: "2px 6px", borderRadius: 4 }}>{product.article}</code>
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label>Количество на складе</Label>
              <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
              {Number(qty) !== (product.stockQuantity ?? 0) && (
                <span style={{ fontSize: "11px", color: "#C75D3C", marginTop: 4, display: "block" }}>
                  Было: {product.stockQuantity ?? 0} → Будет: {qty} (коррекция {Number(qty) - (product.stockQuantity ?? 0) > 0 ? "+" : ""}{Number(qty) - (product.stockQuantity ?? 0)})
                </span>
              )}
            </div>
            <div>
              <Label>Мин. уровень</Label>
              <Input type="number" min={0} value={minLevel} onChange={(e) => setMinLevel(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}
            style={{ background: "#C75D3C", color: "white" }}>
            {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation Dialog ──
function DeleteConfirmDialog({
  open,
  onClose,
  productIds,
  productNames,
}: {
  open: boolean;
  onClose: () => void;
  productIds: number[];
  productNames: string[];
}) {
  const [deleting, setDeleting] = useState(false);
  const utils = trpc.useUtils();
  const removeMut = trpc.warehouse.removeProducts.useMutation();

  const handleDelete = async (deleteFromSite: boolean) => {
    setDeleting(true);
    try {
      await removeMut.mutateAsync({ ids: productIds, deleteFromSite });
      toast.success(
        deleteFromSite
          ? `Удалено ${productIds.length} товаров с сайта и склада`
          : `Удалено ${productIds.length} товаров со склада`
      );
      utils.warehouse.overview.invalidate();
      utils.warehouse.movements.invalidate();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="dialog-content wh-modal" style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>Удалить товар{productIds.length > 1 ? "ы" : ""}?</DialogTitle>
          <DialogDescription>
            {productIds.length === 1
              ? <span>Вы удаляете <strong>{productNames[0]}</strong></span>
              : <span>Вы удаляете <strong>{productIds.length}</strong> товаров</span>
            }
          </DialogDescription>
        </DialogHeader>

        <div style={{ fontSize: 14, color: "#3D3530", lineHeight: 1.6, marginBottom: 8 }}>
          Удалить с сайта тоже?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button
            onClick={() => handleDelete(true)}
            disabled={deleting}
            style={{ background: "#C75D3C", color: "#fff", width: "100%" }}
          >
            <Trash2 size={16} />
            {deleting ? "Удаление..." : "Да, удалить полностью (склад + сайт)"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDelete(false)}
            disabled={deleting}
            style={{ width: "100%" }}
          >
            {deleting ? "Удаление..." : "Нет, только со склада (обнулить остаток)"}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={deleting}
            style={{ width: "100%", color: "#888" }}
          >
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// MEMOIZED TABLE ROW
// ═══════════════════════════════════════════
const StockRow = memo(function StockRow({ p, selected, onToggleSelect, onEdit, onPrintBarcode, onDelete, editingMinLevel, onSetMinLevel, onStartEditMinLevel, onCancelEditMinLevel, onChangeMinLevel }: {
  p: any;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (p: any) => void;
  onPrintBarcode: (id: number) => void;
  onDelete: (id: number, name: string) => void;
  editingMinLevel: { id: number; value: string } | null;
  onSetMinLevel: (productId: number, value: number) => void;
  onStartEditMinLevel: (id: number, value: string) => void;
  onCancelEditMinLevel: () => void;
  onChangeMinLevel: (value: string) => void;
}) {
  const qty = p.stockQuantity ?? 0;
  const min = p.minStockLevel ?? 0;
  const status = qty === 0 ? "zero" : (min > 0 && qty <= min) ? "low" : "ok";
  const isEditingMin = editingMinLevel?.id === p.id;

  return (
    <tr style={{ ...rowStyles.tableRow, cursor: "pointer", background: selected ? "#FFF8F0" : undefined }} onClick={() => onEdit(p)}>
      <td style={{ ...rowStyles.td, width: 36 }} onClick={(e) => { e.stopPropagation(); onToggleSelect(p.id); }}>
        <input type="checkbox" checked={selected} readOnly style={{ cursor: "pointer", accentColor: "#C75D3C", pointerEvents: "none" }} />
      </td>
      <td style={{ ...rowStyles.td, width: 48 }}>
        {p.images?.[0] ? (
          <div style={{ position: "relative", width: 36, height: 36 }} className="wh-img-wrap"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const zoom = e.currentTarget.querySelector('.wh-img-zoom') as HTMLElement;
              if (zoom) { zoom.style.left = `${rect.right + 8}px`; zoom.style.top = `${rect.top + rect.height / 2 - 104}px`; }
            }}>
            <img src={p.images[0]} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #E8E4DF" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="wh-img-zoom"><img src={p.images[0]} alt={p.name} /></span>
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 6, background: "#F5F0EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={16} color="#B5B0AA" />
          </div>
        )}
      </td>
      <td style={{ ...rowStyles.td, fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{p.article}</td>
      <td style={{ ...rowStyles.td, fontWeight: 500 }}>{p.name}</td>
      <td style={rowStyles.td}>{p.subcategory || p.category || "—"}</td>
      <td style={{ ...rowStyles.td, fontWeight: 600, color: status === "zero" ? "#C75D3C" : status === "low" ? "#B8700A" : "#3D6E3D" }}>
        {qty} шт
      </td>
      <td style={rowStyles.td} onClick={(e) => e.stopPropagation()}>
        {isEditingMin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              min={0}
              style={{ width: 60, padding: "2px 6px", border: "1px solid #e5ddd5", borderRadius: 4, fontSize: "13px" }}
              value={editingMinLevel!.value}
              onChange={(e) => onChangeMinLevel(e.target.value)}
              autoFocus
            />
            <button style={rowStyles.inlineBtn} onClick={() => onSetMinLevel(p.id, Number(editingMinLevel!.value))}>
              <Check size={12} />
            </button>
            <button style={rowStyles.inlineBtn} onClick={onCancelEditMinLevel}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <span style={{ cursor: "pointer", textDecoration: "underline dotted", color: "#666" }}
            onClick={() => onStartEditMinLevel(p.id, String(min))}>
            {min}
          </span>
        )}
      </td>
      <td style={rowStyles.td}>
        <span style={{
          padding: "3px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600,
          background: status === "zero" ? "#FDECEA" : status === "low" ? "#FFF3E0" : "#E8F5E9",
          color: status === "zero" ? "#C75D3C" : status === "low" ? "#B8700A" : "#3D6E3D",
        }}>
          {status === "zero" ? "Нет" : status === "low" ? "Мало" : "Ок"}
        </span>
      </td>
      <td style={rowStyles.td} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            style={{ ...rowStyles.inlineBtn, padding: "4px 6px", borderRadius: 4, background: "#f5f0eb" }}
            title="Печать штрихкода"
            onClick={() => onPrintBarcode(p.id)}
          >
            <Barcode size={14} color="#C75D3C" />
          </button>
          <button
            style={{ ...rowStyles.inlineBtn, padding: "4px 6px", borderRadius: 4, background: "#FDECEA" }}
            title="Удалить"
            onClick={() => onDelete(p.id, p.name)}
          >
            <Trash2 size={14} color="#C75D3C" />
          </button>
        </div>
      </td>
    </tr>
  );
});

const paginationBtnStyle: React.CSSProperties = {
  padding: "6px 12px", border: "1px solid #e5ddd5", borderRadius: 6,
  background: "#fff", cursor: "pointer", fontSize: 13, color: "#3D3530",
};

// Stable styles for StockRow (outside component to avoid re-creation)
const rowStyles: Record<string, React.CSSProperties> = {
  tableRow: { borderBottom: "1px solid #f0ebe6" },
  td: { padding: "10px 12px", fontSize: "13px", color: "#3D3530", verticalAlign: "middle" },
  inlineBtn: { background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 },
};

// ═══════════════════════════════════════════
// MAIN WAREHOUSE TAB
// ═══════════════════════════════════════════
export default function WarehouseTab() {
  const [view, setView] = useState<WarehouseView>("stock");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "zero" | "ok">("all");
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  const [printLabelIds, setPrintLabelIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showArrival, setShowArrival] = useState(false);
  const [showDeparture, setShowDeparture] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [historyFilter, setHistoryFilter] = useState<{ productId?: number; type?: "arrival" | "departure"; reason?: string }>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [editingMinLevel, setEditingMinLevel] = useState<{ id: number; value: string } | null>(null);
  const [stockPage, setStockPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{ ids: number[]; names: string[] } | null>(null);
  const STOCK_PER_PAGE = 50;

  // Arrival form
  const [arrivalProduct, setArrivalProduct] = useState<any>(null);
  const [arrivalForm, setArrivalForm] = useState({ quantity: "", supplierName: "", purchasePrice: "", note: "", date: new Date().toISOString().slice(0, 16) });

  // Departure form
  const [departureProduct, setDepartureProduct] = useState<any>(null);
  const [departureForm, setDepartureForm] = useState({ quantity: "", reason: "defect" as string, note: "", date: new Date().toISOString().slice(0, 16) });

  const utils = trpc.useUtils();

  // Queries
  const { data: stockData = [], isLoading: stockLoading } = trpc.warehouse.overview.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    subcategory: subcategoryFilter !== "all" ? subcategoryFilter : undefined,
    stockFilter,
  });

  const { data: historyData } = trpc.warehouse.movements.useQuery({
    ...historyFilter,
    page: historyPage,
    limit: 50,
  });

  const { data: categoriesData } = trpc.catalog.getCategories.useQuery();
  const categories = useMemo(() => (categoriesData ?? []) as string[], [categoriesData]);
  const { data: categoryTree } = trpc.catalog.categories.list.useQuery();

  const mainCategories = useMemo(() => {
    if (!categoryTree) return [];
    return (categoryTree as any[]).filter(c => !c.parentId).map(c => c.name);
  }, [categoryTree]);

  const subcategoriesForFilter = useMemo(() => {
    if (!categoryTree || categoryFilter === "all") return [];
    const parent = (categoryTree as any[]).find(c => !c.parentId && c.name === categoryFilter);
    if (!parent) return [];
    return (categoryTree as any[]).filter(c => c.parentId === parent.id).map(c => c.name);
  }, [categoryTree, categoryFilter]);

  // Existing articles set for import
  const existingArticles = useMemo(() => new Set(stockData.map((p) => p.article)), [stockData]);

  // Mutations
  const arrivalMut = trpc.warehouse.addArrival.useMutation();
  const departureMut = trpc.warehouse.addDeparture.useMutation();
  const setMinLevelMut = trpc.warehouse.setMinLevel.useMutation();

  // Stats
  const totalProducts = stockData.length;
  const totalStock = stockData.reduce((sum, p) => sum + (p.stockQuantity ?? 0), 0);
  const lowStockCount = stockData.filter((p) => (p.minStockLevel ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 0)).length;

  // Client-side pagination
  const totalStockPages = Math.ceil(stockData.length / STOCK_PER_PAGE);
  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * STOCK_PER_PAGE;
    return stockData.slice(start, start + STOCK_PER_PAGE);
  }, [stockData, stockPage]);

  // Reset page when filters change
  useEffect(() => { setStockPage(1); }, [search, categoryFilter, subcategoryFilter, stockFilter]);

  // Handlers
  const handleArrival = async () => {
    if (!arrivalProduct || !arrivalForm.quantity) return;
    try {
      await arrivalMut.mutateAsync({
        productId: arrivalProduct.id,
        quantity: Number(arrivalForm.quantity),
        supplierName: arrivalForm.supplierName || undefined,
        purchasePrice: arrivalForm.purchasePrice ? Number(arrivalForm.purchasePrice) : undefined,
        note: arrivalForm.note || undefined,
        date: new Date(arrivalForm.date).toISOString(),
      });
      toast.success(`Приход: +${arrivalForm.quantity} шт — ${arrivalProduct.name}`);
      utils.warehouse.overview.invalidate();
      utils.warehouse.movements.invalidate();
      setShowArrival(false);
      setArrivalProduct(null);
      setArrivalForm({ quantity: "", supplierName: "", purchasePrice: "", note: "", date: new Date().toISOString().slice(0, 16) });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeparture = async () => {
    if (!departureProduct || !departureForm.quantity) return;
    try {
      await departureMut.mutateAsync({
        productId: departureProduct.id,
        quantity: Number(departureForm.quantity),
        reason: departureForm.reason as any,
        note: departureForm.note || undefined,
        date: new Date(departureForm.date).toISOString(),
      });
      toast.success(`Расход: -${departureForm.quantity} шт — ${departureProduct.name}`);
      utils.warehouse.overview.invalidate();
      utils.warehouse.movements.invalidate();
      setShowDeparture(false);
      setDepartureProduct(null);
      setDepartureForm({ quantity: "", reason: "defect", note: "", date: new Date().toISOString().slice(0, 16) });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSetMinLevel = async (productId: number, value: number) => {
    try {
      await setMinLevelMut.mutateAsync({ productId, minStockLevel: value });
      utils.warehouse.overview.invalidate();
      setEditingMinLevel(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Selection helpers (stable callbacks for memo)
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const allSelected = paginatedStock.length > 0 && paginatedStock.every(p => selectedIds.has(p.id));
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (paginatedStock.length > 0 && paginatedStock.every(p => prev.has(p.id))) {
        // Deselect only visible page
        const next = new Set(prev);
        paginatedStock.forEach(p => next.delete(p.id));
        return next;
      }
      // Select visible page (add to existing selection)
      const next = new Set(prev);
      paginatedStock.forEach(p => next.add(p.id));
      return next;
    });
  }, [paginatedStock]);

  // Stable callbacks for StockRow
  const handleEditProduct = useCallback((p: any) => setEditingProduct(p), []);
  const handlePrintBarcode = useCallback((id: number) => {
    setPrintLabelIds([id]);
    setPrintLabelsOpen(true);
  }, []);
  const handleStartEditMinLevel = useCallback((id: number, value: string) => {
    setEditingMinLevel({ id, value });
  }, []);
  const handleCancelEditMinLevel = useCallback(() => setEditingMinLevel(null), []);
  const handleChangeMinLevel = useCallback((value: string) => {
    setEditingMinLevel(prev => prev ? { ...prev, value } : null);
  }, []);
  const handleDeleteSingle = useCallback((id: number, name: string) => {
    setDeleteDialog({ ids: [id], names: [name] });
  }, []);
  const handleDeleteBulk = useCallback(() => {
    const ids = Array.from(selectedIds);
    const names = stockData.filter(p => selectedIds.has(p.id)).map(p => p.name);
    setDeleteDialog({ ids, names });
  }, [selectedIds, stockData]);

  return (
    <>
      <style>{`
        .wh-modal [data-slot="dialog-content"],
        .wh-modal [role="dialog"],
        .wh-modal { background: #FFFCF9 !important; color: #3D3530 !important; }
        .wh-modal [data-slot="dialog-overlay"] { background: rgba(0,0,0,0.3) !important; }
        .wh-modal input, .wh-modal textarea, .wh-modal select { background: #fff !important; color: #3D3530 !important; border-color: #e5ddd5 !important; }
        .wh-modal button[data-slot="dialog-close"] { color: #3D3530 !important; }
        .wh-img-wrap { position: relative; z-index: 1; }
        .wh-img-wrap:hover { z-index: 999; }
        .wh-img-zoom { display: none; position: fixed; z-index: 9999; background: white; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.22); padding: 4px; pointer-events: none; }
        .wh-img-zoom img { width: 200px; height: 200px; object-fit: cover; border-radius: 8px; display: block; }
        .wh-img-wrap:hover .wh-img-zoom { display: block; }

        /* ── Mobile Responsive ── */
        @media (max-width: 768px) {
          /* Stats row */
          .wh-stats {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            margin-bottom: 16px !important;
          }
          .wh-stat {
            padding: 12px !important;
          }
          .wh-stat > div:last-child {
            font-size: 22px !important;
          }

          /* Toolbar */
          .wh-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .wh-actions {
            flex-wrap: wrap !important;
          }
          .wh-actions > button {
            flex: 1 !important;
            min-width: 0 !important;
            font-size: 12px !important;
            padding: 8px 10px !important;
            justify-content: center !important;
          }

          /* Filters */
          .wh-filters {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .wh-filters input,
          .wh-filters select,
          .wh-filters > div,
          .wh-filters > button {
            width: 100% !important;
            min-width: 0 !important;
          }

          /* Table */
          .wh-table-wrap {
            margin: 0 -12px !important;
          }
          .wh-table-wrap table {
            font-size: 12px !important;
          }
          .wh-table-wrap th,
          .wh-table-wrap td {
            padding: 8px 6px !important;
            font-size: 12px !important;
          }
          .wh-table-wrap thead {
            display: none !important;
          }
          .wh-table-wrap tbody tr {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 4px 8px !important;
            padding: 12px 10px !important;
            border-bottom: 1px solid #E8E4DF !important;
            align-items: center !important;
          }
          .wh-table-wrap tbody tr td {
            border-bottom: none !important;
            padding: 2px 4px !important;
          }

          /* Dialogs / Modals */
          .wh-modal, .wh-modal [data-slot="dialog-content"], .wh-modal [role="dialog"] {
            max-width: 95vw !important;
            width: 95vw !important;
            margin: 8px auto !important;
            padding: 16px !important;
          }
          .wh-modal [data-slot="dialog-footer"],
          .wh-modal footer {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .wh-modal [data-slot="dialog-footer"] button,
          .wh-modal footer button {
            width: 100% !important;
          }

          /* Disable image zoom on mobile (touch unfriendly) */
          .wh-img-zoom { display: none !important; }
          .wh-img-wrap:hover .wh-img-zoom { display: none !important; }
        }

        @media (max-width: 480px) {
          /* Stats single column */
          .wh-stats {
            grid-template-columns: 1fr !important;
          }

          /* Actions stack vertically */
          .wh-actions {
            flex-direction: column !important;
          }
          .wh-actions > button {
            width: 100% !important;
          }

          /* Full-width dialogs */
          .wh-modal, .wh-modal [data-slot="dialog-content"], .wh-modal [role="dialog"] {
            max-width: 100vw !important;
            width: 100vw !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }

          /* Pagination compact */
          .wh-table-wrap + div {
            flex-direction: column !important;
            gap: 8px !important;
          }
        }
      `}</style>

      {/* Header stats */}
      <div className="wh-stats" style={styles.statsRow}>
        <div className="wh-stat" style={styles.statCard}>
          <div style={styles.statLabel}><span>Позиций</span><Package size={16} color="#C75D3C" /></div>
          <div style={styles.statValue}>{totalProducts}</div>
        </div>
        <div className="wh-stat" style={styles.statCard}>
          <div style={styles.statLabel}><span>Общий остаток</span><CheckCircle2 size={16} color="#3D6E3D" /></div>
          <div style={{ ...styles.statValue, color: "#3D6E3D" }}>{totalStock.toLocaleString("ru-RU")} шт</div>
        </div>
        <div className="wh-stat" style={styles.statCard}>
          <div style={styles.statLabel}><span>Мало на складе</span><AlertTriangle size={16} color={lowStockCount > 0 ? "#C75D3C" : "#999"} /></div>
          <div style={{ ...styles.statValue, color: lowStockCount > 0 ? "#C75D3C" : "#3D3530" }}>{lowStockCount}</div>
        </div>
      </div>

      {/* View tabs + actions */}
      <div className="wh-toolbar" style={styles.toolbar}>
        <div style={styles.viewTabs}>
          <button style={view === "stock" ? styles.viewTabActive : styles.viewTab} onClick={() => setView("stock")}>
            <Package size={14} /> Остатки
          </button>
          <button style={view === "history" ? styles.viewTabActive : styles.viewTab} onClick={() => setView("history")}>
            <History size={14} /> История
          </button>
        </div>
        <div className="wh-actions" style={styles.actions}>
          <button style={styles.actionBtn} onClick={() => setShowArrival(true)}>
            <ArrowDownToLine size={14} /> Приход
          </button>
          <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => setShowDeparture(true)}>
            <ArrowUpFromLine size={14} /> Расход
          </button>
          <button style={styles.actionBtnOutline} onClick={() => setShowImport(true)}>
            <FileSpreadsheet size={14} /> Импорт Excel
          </button>
        </div>
      </div>

      {/* ═══ STOCK VIEW ═══ */}
      {view === "stock" && (
        <div style={styles.section}>
          {/* Filters */}
          <div className="wh-filters" style={styles.filtersRow}>
            <div style={styles.searchWrap}>
              <Search size={14} style={{ color: "#999" }} />
              <input
                style={styles.filterInput}
                placeholder="Поиск по названию, артикулу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <CategoryDropdown value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setSubcategoryFilter("all"); }} categories={mainCategories} placeholder="Все категории" />
            {categoryFilter !== "all" && subcategoriesForFilter.length > 0 && (
              <CategoryDropdown value={subcategoryFilter} onChange={setSubcategoryFilter} categories={subcategoriesForFilter} placeholder="Все подкатегории" />
            )}
            <Select value={stockFilter} onValueChange={(v: any) => setStockFilter(v)}>
              <SelectTrigger style={{ width: 150, background: "#fff", borderColor: "#e5ddd5" }}>
                <SelectValue placeholder="Остатки" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="low">Мало</SelectItem>
                <SelectItem value="zero">Нулевой</SelectItem>
                <SelectItem value="ok">В норме</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection bar */}
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: "#FFF3E0", borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#3D3530" }}>Выбрано: <strong>{selectedIds.size}</strong></span>
              <button style={{ ...styles.inlineBtn, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e5ddd5" }}
                onClick={() => setSelectedIds(new Set())}>
                <X size={12} /> Снять
              </button>
              <button style={{ ...styles.inlineBtn, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#C75D3C", color: "#fff", border: "none" }}
                onClick={() => { setPrintLabelIds(Array.from(selectedIds)); setPrintLabelsOpen(true); }}>
                <Barcode size={12} /> Печать штрихкодов
              </button>
              <button style={{ ...styles.inlineBtn, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#FDECEA", color: "#C75D3C", border: "1px solid #f5c6bc" }}
                onClick={handleDeleteBulk}>
                <Trash2 size={12} /> Удалить
              </button>
            </div>
          )}

          {/* Table */}
          {stockLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Загрузка...</div>
          ) : stockData.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Нет товаров по фильтру</div>
          ) : (
            <div className="wh-table-wrap" style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 36 }} onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer", accentColor: "#C75D3C" }} />
                    </th>
                    <th style={{ ...styles.th, width: 48 }}></th>
                    <th style={styles.th}>Артикул</th>
                    <th style={styles.th}>Название</th>
                    <th style={styles.th}>Категория</th>
                    <th style={styles.th}>Остаток</th>
                    <th style={styles.th}>Мин. уровень</th>
                    <th style={styles.th}>Статус</th>
                    <th style={{ ...styles.th, width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStock.map((p) => (
                    <StockRow
                      key={p.id}
                      p={p}
                      selected={selectedIds.has(p.id)}
                      onToggleSelect={toggleSelect}
                      onEdit={handleEditProduct}
                      onPrintBarcode={handlePrintBarcode}
                      onDelete={handleDeleteSingle}
                      editingMinLevel={editingMinLevel?.id === p.id ? editingMinLevel : null}
                      onSetMinLevel={handleSetMinLevel}
                      onStartEditMinLevel={handleStartEditMinLevel}
                      onCancelEditMinLevel={handleCancelEditMinLevel}
                      onChangeMinLevel={handleChangeMinLevel}
                    />
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalStockPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                  <span style={{ fontSize: 13, color: "#888" }}>
                    {(stockPage - 1) * STOCK_PER_PAGE + 1}–{Math.min(stockPage * STOCK_PER_PAGE, stockData.length)} из {stockData.length}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      style={{ ...paginationBtnStyle, opacity: stockPage <= 1 ? 0.4 : 1 }}
                      disabled={stockPage <= 1}
                      onClick={() => setStockPage(p => p - 1)}
                    >
                      ← Назад
                    </button>
                    {Array.from({ length: Math.min(totalStockPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalStockPages <= 7) {
                        page = i + 1;
                      } else if (stockPage <= 4) {
                        page = i + 1;
                      } else if (stockPage >= totalStockPages - 3) {
                        page = totalStockPages - 6 + i;
                      } else {
                        page = stockPage - 3 + i;
                      }
                      return (
                        <button
                          key={page}
                          style={{ ...paginationBtnStyle, background: page === stockPage ? "#C75D3C" : "#fff", color: page === stockPage ? "#fff" : "#3D3530", fontWeight: page === stockPage ? 600 : 400 }}
                          onClick={() => setStockPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      style={{ ...paginationBtnStyle, opacity: stockPage >= totalStockPages ? 0.4 : 1 }}
                      disabled={stockPage >= totalStockPages}
                      onClick={() => setStockPage(p => p + 1)}
                    >
                      Далее →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ HISTORY VIEW ═══ */}
      {view === "history" && (
        <div style={styles.section}>
          <div className="wh-filters" style={styles.filtersRow}>
            <Select value={historyFilter.type || "all"} onValueChange={(v) => {
              setHistoryFilter({ ...historyFilter, type: v === "all" ? undefined : v as any });
              setHistoryPage(1);
            }}>
              <SelectTrigger style={{ width: 150, background: "#fff", borderColor: "#e5ddd5" }}>
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="arrival">Приход</SelectItem>
                <SelectItem value="departure">Расход</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyFilter.reason || "all"} onValueChange={(v) => {
              setHistoryFilter({ ...historyFilter, reason: v === "all" ? undefined : v });
              setHistoryPage(1);
            }}>
              <SelectTrigger style={{ width: 160, background: "#fff", borderColor: "#e5ddd5" }}>
                <SelectValue placeholder="Причина" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все причины</SelectItem>
                <SelectItem value="purchase">Закупка</SelectItem>
                <SelectItem value="defect">Брак</SelectItem>
                <SelectItem value="return">Возврат</SelectItem>
                <SelectItem value="correction">Коррекция</SelectItem>
                <SelectItem value="other">Другое</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!historyData?.items.length ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Нет записей</div>
          ) : (
            <div className="wh-table-wrap" style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Дата и время</th>
                    <th style={styles.th}>Товар</th>
                    <th style={styles.th}>Тип</th>
                    <th style={styles.th}>Кол-во</th>
                    <th style={styles.th}>Причина</th>
                    <th style={styles.th}>Поставщик / Заметка</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.items.map((m: any) => (
                    <tr key={m.id} style={styles.tableRow}>
                      <td style={{ ...styles.td, fontSize: "12px", whiteSpace: "nowrap" }}>
                        {m.date ? new Date(m.date).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500 }}>{m.productName || "—"}</div>
                        <div style={{ fontSize: "11px", color: "#888", fontFamily: "monospace" }}>{m.productArticle}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600,
                          background: m.type === "arrival" ? "#E8F5E9" : "#FDECEA",
                          color: m.type === "arrival" ? "#3D6E3D" : "#C75D3C",
                        }}>
                          {m.type === "arrival" ? "Приход" : "Расход"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600, color: m.type === "arrival" ? "#3D6E3D" : "#C75D3C" }}>
                        {m.type === "arrival" ? "+" : "−"}{m.quantity}
                      </td>
                      <td style={styles.td}>{reasonLabels[m.reason] || m.reason}</td>
                      <td style={{ ...styles.td, fontSize: "12px", color: "#666" }}>
                        {m.supplierName || m.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {historyData && historyData.total > 50 && (
            <div style={styles.pagination}>
              <button style={styles.pageBtn} disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>Назад</button>
              <span style={{ fontSize: "13px", color: "#666" }}>{historyPage} / {Math.ceil(historyData.total / 50)}</span>
              <button style={styles.pageBtn} disabled={historyPage >= Math.ceil(historyData.total / 50)} onClick={() => setHistoryPage(historyPage + 1)}>Вперед</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ARRIVAL DIALOG ═══ */}
      <Dialog open={showArrival} onOpenChange={(v) => { if (!v) { setShowArrival(false); setArrivalProduct(null); } }}>
        <DialogContent className="dialog-content wh-modal" style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle>Приход товара</DialogTitle>
            <DialogDescription>Оприходовать товар на склад</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Товар *</Label>
              <ProductSearchInput
                onSelect={setArrivalProduct}
                selectedProduct={arrivalProduct}
                placeholder="Поиск по названию или артикулу..."
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Количество *</Label>
                <Input type="number" min={1} value={arrivalForm.quantity}
                  onChange={(e) => setArrivalForm({ ...arrivalForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Цена закупки (₽)</Label>
                <Input type="number" min={0} value={arrivalForm.purchasePrice}
                  onChange={(e) => setArrivalForm({ ...arrivalForm, purchasePrice: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Поставщик</Label>
              <Input value={arrivalForm.supplierName}
                onChange={(e) => setArrivalForm({ ...arrivalForm, supplierName: e.target.value })} />
            </div>
            <div>
              <Label>Дата и время</Label>
              <Input type="datetime-local" value={arrivalForm.date}
                onChange={(e) => setArrivalForm({ ...arrivalForm, date: e.target.value })} />
            </div>
            <div>
              <Label>Заметка</Label>
              <Textarea value={arrivalForm.note}
                onChange={(e) => setArrivalForm({ ...arrivalForm, note: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowArrival(false); setArrivalProduct(null); }}>Отмена</Button>
            <Button onClick={handleArrival} disabled={!arrivalProduct || !arrivalForm.quantity || arrivalMut.isPending}
              style={{ background: "#3D6E3D", color: "white" }}>
              {arrivalMut.isPending ? "Сохранение..." : "Оприходовать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DEPARTURE DIALOG ═══ */}
      <Dialog open={showDeparture} onOpenChange={(v) => { if (!v) { setShowDeparture(false); setDepartureProduct(null); } }}>
        <DialogContent className="dialog-content wh-modal" style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle>Расход товара</DialogTitle>
            <DialogDescription>Списать товар со склада</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Товар *</Label>
              <ProductSearchInput
                onSelect={setDepartureProduct}
                selectedProduct={departureProduct}
                inStockOnly
                placeholder="Поиск товара (только в наличии)..."
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Количество *</Label>
                <Input type="number" min={1} value={departureForm.quantity}
                  onChange={(e) => setDepartureForm({ ...departureForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Причина *</Label>
                <Select value={departureForm.reason} onValueChange={(v) => setDepartureForm({ ...departureForm, reason: v })}>
                  <SelectTrigger style={{ background: "#fff", borderColor: "#e5ddd5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defect">Брак</SelectItem>
                    <SelectItem value="return">Возврат</SelectItem>
                    <SelectItem value="correction">Коррекция</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Дата и время</Label>
              <Input type="datetime-local" value={departureForm.date}
                onChange={(e) => setDepartureForm({ ...departureForm, date: e.target.value })} />
            </div>
            <div>
              <Label>Заметка</Label>
              <Textarea value={departureForm.note}
                onChange={(e) => setDepartureForm({ ...departureForm, note: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeparture(false); setDepartureProduct(null); }}>Отмена</Button>
            <Button onClick={handleDeparture} disabled={!departureProduct || !departureForm.quantity || departureMut.isPending}
              style={{ background: "#C75D3C", color: "white" }}>
              {departureMut.isPending ? "Списание..." : "Списать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ IMPORT DIALOG ═══ */}
      <ExcelImportDialog open={showImport} onClose={() => setShowImport(false)} existingArticles={existingArticles} />

      {/* ═══ EDIT DIALOG ═══ */}
      <ProductEditDialog product={editingProduct} onClose={() => setEditingProduct(null)} />

      {/* ═══ BARCODE PRINT DIALOG ═══ */}
      <PrintLabelsDialog
        open={printLabelsOpen}
        onClose={() => setPrintLabelsOpen(false)}
        productIds={printLabelIds}
      />

      {/* ═══ DELETE CONFIRMATION DIALOG ═══ */}
      <DeleteConfirmDialog
        open={!!deleteDialog}
        onClose={() => { setDeleteDialog(null); setSelectedIds(new Set()); }}
        productIds={deleteDialog?.ids || []}
        productNames={deleteDialog?.names || []}
      />
    </>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const styles: Record<string, React.CSSProperties> = {
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  statCard: { background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #f0ebe5" },
  statLabel: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "#888", marginBottom: 8 },
  statValue: { fontSize: "28px", fontWeight: 700, color: "#3D3530" },

  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  viewTabs: { display: "flex", background: "#f5f0eb", borderRadius: 8, padding: 3 },
  viewTab: { padding: "8px 16px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: "13px", color: "#888", display: "flex", alignItems: "center", gap: 6 },
  viewTabActive: { padding: "8px 16px", borderRadius: 6, border: "none", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#3D3530", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  actions: { display: "flex", gap: 8 },
  actionBtn: { padding: "8px 16px", borderRadius: 8, border: "none", background: "#3D6E3D", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 },
  actionBtnDanger: { background: "#C75D3C" },
  actionBtnOutline: { padding: "8px 16px", borderRadius: 8, border: "1px solid #e5ddd5", background: "#fff", color: "#3D3530", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 },

  section: { background: "#fff", borderRadius: 12, border: "1px solid #f0ebe5", padding: 20 },
  filtersRow: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" as any, alignItems: "center" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5ddd5", borderRadius: 8, padding: "0 12px", flex: 1, minWidth: 200 },
  filterInput: { border: "none", outline: "none", background: "none", flex: 1, padding: "8px 0", fontSize: "13px", color: "#3D3530" },

  tableWrap: { overflowX: "auto" as any },
  table: { width: "100%", borderCollapse: "collapse" as any, fontSize: "13px" },
  th: { padding: "10px 12px", textAlign: "left" as any, borderBottom: "2px solid #f0ebe5", color: "#888", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" as any, letterSpacing: "0.5px" },
  td: { padding: "10px 12px", borderBottom: "1px solid #f5f0eb" },
  tableRow: { transition: "background 0.15s" },
  inlineBtn: { background: "none", border: "1px solid #e5ddd5", borderRadius: 4, padding: "2px 4px", cursor: "pointer", display: "inline-flex", alignItems: "center" },

  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 },
  pageBtn: { padding: "6px 16px", borderRadius: 6, border: "1px solid #e5ddd5", background: "#fff", cursor: "pointer", fontSize: "13px" },

  // Dropdown styles
  dropdownTrigger: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid #e5ddd5", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: "13px", minWidth: 160, color: "#3D3530" },
  dropdownOverlay: { position: "fixed" as any, inset: 0, zIndex: 40 },
  dropdownMenu: { position: "absolute" as any, top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #e5ddd5", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 220 },
  dropdownSearch: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f0ebe5" },
  dropdownList: { maxHeight: 240, overflowY: "auto" as any, padding: "4px 0" },
  dropdownItem: { padding: "8px 12px", cursor: "pointer", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#3D3530" },
  dropdownItemActive: { background: "#FFF5F0", color: "#C75D3C", fontWeight: 600 },

  // Product search
  searchInputWrap: { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e5ddd5", borderRadius: 8, padding: "0 12px", background: "#fff" },
  searchInput: { border: "none", outline: "none", background: "none", flex: 1, padding: "8px 0", fontSize: "13px", color: "#3D3530" },
  searchResults: { position: "absolute" as any, top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #e5ddd5", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 240, overflowY: "auto" as any },
  searchResultItem: { padding: "8px 12px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #f5f0eb" },
  selectedProduct: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid #e5ddd5", borderRadius: 8, background: "#f9f6f3", fontSize: "13px" },
  clearBtn: { background: "none", border: "none", cursor: "pointer", color: "#888", padding: 4 },

  // Template table
  templateTable: { border: "1px solid #e5ddd5", borderRadius: 8, overflow: "hidden" },

  // Upload button
  uploadBtn: { display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", border: "2px dashed #e5ddd5", borderRadius: 8, background: "#FFFCF9", cursor: "pointer", fontSize: "13px", color: "#888", width: "100%" as any, justifyContent: "center" },
};
