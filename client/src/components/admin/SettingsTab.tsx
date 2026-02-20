import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, RefreshCw, Plus, Trash2, Edit3, Search, FileText, X, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";

const categoryLabels: Record<string, string> = {
  contacts: "Контакты",
  schedule: "Расписание",
  delivery: "Доставка",
  discounts: "Скидки",
  ai: "AI-ассистент",
  general: "Общие",
};

const categoryOrder = ["contacts", "schedule", "delivery", "discounts", "ai", "general"];

const pageLabels: Record<string, string> = {
  home: "Главная",
  about: "О компании",
  catalog: "Каталог",
  contacts: "Контакты",
  delivery: "Доставка",
  partners: "Партнёры",
  faq: "FAQ",
  footer: "Подвал",
  header: "Шапка",
  meta: "SEO / Мета",
  services: "Услуги",
  portfolio: "Портфолио",
  reviews: "Отзывы",
  blog: "Блог",
  policy: "Политика",
};

function translatePage(page: string): string {
  return pageLabels[page.toLowerCase()] || page;
}

// ── Content Section (moved from separate Content tab) ──
function ContentSection() {
  const [contentSearch, setContentSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState<string>("all");
  const [editedValues, setEditedValues] = useState<Record<number, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState({ key: "", value: "", description: "", page: "", section: "" });
  const [editingContent, setEditingContent] = useState<{
    id: number; key: string; value: string; description: string | null; page: string; section: string | null;
  } | null>(null);

  const { data: contentList, refetch } = trpc.content.list.useQuery(
    { page: selectedPage === "all" ? undefined : selectedPage, search: contentSearch || undefined }
  );
  const { data: contentPages } = trpc.content.getPages.useQuery();

  const createMut = trpc.content.create.useMutation({
    onSuccess: () => { toast.success("Контент создан"); refetch(); setIsAdding(false); setNewContent({ key: "", value: "", description: "", page: "", section: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.content.update.useMutation({
    onSuccess: () => { toast.success("Сохранено"); refetch(); setEditingContent(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.content.delete.useMutation({
    onSuccess: () => { toast.success("Удалено"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkUpdateMut = trpc.content.bulkUpdate.useMutation({
    onSuccess: (data) => { toast.success(`Сохранено: ${data.count}`); refetch(); setEditedValues({}); },
    onError: (e) => toast.error(e.message),
  });

  const hasEdits = Object.keys(editedValues).length > 0;

  const grouped = (contentList || []).reduce((acc, item) => {
    if (!acc[item.page]) acc[item.page] = [];
    acc[item.page].push(item);
    return acc;
  }, {} as Record<string, typeof contentList>);

  return (
    <div className="st-content-section">
      {/* Header row: search + actions */}
      <div className="st-content-header">
        <div className="st-content-search">
          <Search size={14} />
          <input
            placeholder="Поиск..."
            value={contentSearch}
            onChange={(e) => setContentSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {hasEdits && (
            <button
              className="st-save-btn"
              onClick={() => {
                const updates = Object.entries(editedValues).map(([id, value]) => ({ id: parseInt(id), value }));
                bulkUpdateMut.mutate(updates);
              }}
              disabled={bulkUpdateMut.isPending}
            >
              <Save size={14} /> Сохранить ({Object.keys(editedValues).length})
            </button>
          )}
          <button className="st-content-add-btn" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> Добавить
          </button>
        </div>
      </div>

      {/* Page tabs */}
      {contentPages && contentPages.length > 0 && (
        <div className="st-page-tabs">
          <button
            className={`st-page-tab ${selectedPage === "all" ? "st-page-tab-active" : ""}`}
            onClick={() => setSelectedPage("all")}
          >
            Все
          </button>
          {contentPages.map((p) => (
            <button
              key={p}
              className={`st-page-tab ${selectedPage === p ? "st-page-tab-active" : ""}`}
              onClick={() => setSelectedPage(p)}
            >
              {translatePage(p)}
            </button>
          ))}
        </div>
      )}

      {/* Content items */}
      {Object.entries(grouped).map(([page, items]) => (
        <div key={page} className="st-content-page-group">
          <div className="st-content-page-label">{translatePage(page)}</div>
          {items.map((item) => (
            <div key={item.id} className={`st-content-item ${editedValues[item.id] !== undefined ? "st-item-changed" : ""}`}>
              <div className="st-content-item-top">
                <code className="st-item-key">{item.key}</code>
                {item.section && <span className="st-content-section-tag">{item.section}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button className="st-icon-btn" onClick={() => setEditingContent(item)} title="Редактировать"><Edit3 size={14} /></button>
                  <button className="st-icon-btn st-icon-btn-danger" onClick={() => { if (confirm("Удалить?")) deleteMut.mutate({ id: item.id }); }} title="Удалить"><Trash2 size={14} /></button>
                </div>
              </div>
              {item.description && <div className="st-content-desc">{item.description}</div>}
              <textarea
                className={`st-textarea ${editedValues[item.id] !== undefined ? "st-textarea-changed" : ""}`}
                value={editedValues[item.id] ?? item.value}
                rows={2}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== item.value) {
                    setEditedValues((prev) => ({ ...prev, [item.id]: val }));
                  } else {
                    setEditedValues((prev) => { const c = { ...prev }; delete c[item.id]; return c; });
                  }
                }}
              />
            </div>
          ))}
        </div>
      ))}

      {(!contentList || contentList.length === 0) && (
        <div className="st-empty" style={{ padding: "24px 0" }}>
          <FileText size={32} style={{ color: "#ccc", marginBottom: 8 }} />
          <div>Контент не найден</div>
        </div>
      )}

      {/* Add dialog */}
      {isAdding && (
        <div className="st-overlay" onClick={() => setIsAdding(false)}>
          <div className="st-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="st-dialog-title">Новый контент</div>
            <div className="st-dialog-form">
              <label>Ключ *</label>
              <input className="st-input" placeholder="home.hero.title" value={newContent.key} onChange={(e) => setNewContent({ ...newContent, key: e.target.value })} />
              <label>Страница *</label>
              <input className="st-input" placeholder="home" value={newContent.page} onChange={(e) => setNewContent({ ...newContent, page: e.target.value })} />
              <label>Секция</label>
              <input className="st-input" placeholder="hero" value={newContent.section} onChange={(e) => setNewContent({ ...newContent, section: e.target.value })} />
              <label>Значение *</label>
              <textarea className="st-textarea" placeholder="Текст..." rows={3} value={newContent.value} onChange={(e) => setNewContent({ ...newContent, value: e.target.value })} />
              <label>Описание</label>
              <input className="st-input" placeholder="Описание" value={newContent.description} onChange={(e) => setNewContent({ ...newContent, description: e.target.value })} />
            </div>
            <div className="st-dialog-actions">
              <button className="st-dialog-cancel" onClick={() => setIsAdding(false)}>Отмена</button>
              <button
                className="st-save-btn"
                disabled={!newContent.key || !newContent.value || !newContent.page || createMut.isPending}
                onClick={() => createMut.mutate({ key: newContent.key, value: newContent.value, description: newContent.description || undefined, page: newContent.page, section: newContent.section || undefined })}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editingContent && (
        <div className="st-overlay" onClick={() => setEditingContent(null)}>
          <div className="st-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="st-dialog-title">Редактировать <code className="st-item-key">{editingContent.key}</code></div>
            <div className="st-dialog-form">
              <label>Значение</label>
              <textarea className="st-textarea" rows={4} value={editingContent.value} onChange={(e) => setEditingContent({ ...editingContent, value: e.target.value })} />
              <label>Описание</label>
              <input className="st-input" value={editingContent.description || ""} onChange={(e) => setEditingContent({ ...editingContent, description: e.target.value })} />
              <label>Секция</label>
              <input className="st-input" value={editingContent.section || ""} onChange={(e) => setEditingContent({ ...editingContent, section: e.target.value })} />
            </div>
            <div className="st-dialog-actions">
              <button className="st-dialog-cancel" onClick={() => setEditingContent(null)}>Отмена</button>
              <button
                className="st-save-btn"
                disabled={updateMut.isPending}
                onClick={() => updateMut.mutate({ id: editingContent.id, value: editingContent.value, description: editingContent.description || undefined, section: editingContent.section || undefined })}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IP Requisites management ──
const defaultRequisites = {
  fullName: "ИП РУЧКИН МАКСИМ АЛЕКСАНДРОВИЧ",
  inn: "345914013615",
  ogrn: "323940100192443",
  account: "40802810209400328837",
  bankName: "ПАО \"Банк ПСБ\" г. Ярославль",
  bik: "044525555",
  corrAccount: "30101810400000000555",
  phone: "+79591306531",
  address: "",
};

const reqFields: { key: keyof typeof defaultRequisites; label: string }[] = [
  { key: "fullName", label: "Полное наименование ИП" },
  { key: "inn", label: "ИНН" },
  { key: "ogrn", label: "ОГРН" },
  { key: "account", label: "Расчётный счёт" },
  { key: "bankName", label: "Название банка" },
  { key: "bik", label: "БИК" },
  { key: "corrAccount", label: "Корреспондентский счёт" },
  { key: "phone", label: "Телефон" },
  { key: "address", label: "Адрес (необязательно)" },
];

function RequisitesSection() {
  const { data: setting, refetch } = trpc.settings.get.useQuery({ key: "ip_requisites" });
  const setMutation = trpc.settings.set.useMutation();
  const [values, setValues] = useState<typeof defaultRequisites>(defaultRequisites);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        setValues({ ...defaultRequisites, ...parsed });
      } catch {
        setValues(defaultRequisites);
      }
    }
    setDirty(false);
  }, [setting]);

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setMutation.mutateAsync({
        key: "ip_requisites",
        value: JSON.stringify(values),
        type: "json",
        category: "general",
        description: "Реквизиты ИП для счетов на оплату",
      });
      toast.success("Реквизиты сохранены");
      setDirty(false);
      refetch();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {reqFields.map((f) => (
        <div key={f.key} className="st-item">
          <div className="st-item-header">
            <label className="st-item-label">{f.label}</label>
          </div>
          <input
            className="st-input"
            type="text"
            value={values[f.key]}
            onChange={(e) => handleChange(f.key, e.target.value)}
          />
        </div>
      ))}
      {dirty && (
        <button className="st-save-btn" onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Save size={16} />
          {saving ? "Сохранение..." : "Сохранить реквизиты"}
        </button>
      )}
    </div>
  );
}

// ── Discount & Delivery Settings ──
const defaultTiers = [
  { min: 30000, percent: 5 },
  { min: 50000, percent: 10 },
  { min: 100000, percent: 15 },
  { min: 200000, percent: 20 },
  { min: 500000, percent: 25 },
  { min: 1000000, percent: 30 },
];

function DiscountDeliverySection() {
  const { data: tiersData, refetch: refetchTiers } = trpc.settings.get.useQuery({ key: "discount_tiers" });
  const { data: freeMinData, refetch: refetchFreeMin } = trpc.settings.get.useQuery({ key: "free_delivery_min" });
  const { data: deliveryPriceData, refetch: refetchDeliveryPrice } = trpc.settings.get.useQuery({ key: "delivery_price" });
  const setMutation = trpc.settings.set.useMutation();

  const [tiers, setTiers] = useState<{ min: number; percent: number }[]>(defaultTiers);
  const [freeMin, setFreeMin] = useState("30000");
  const [delivPrice, setDelivPrice] = useState("500");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tiersData?.value) {
      try { setTiers(JSON.parse(tiersData.value)); } catch { setTiers(defaultTiers); }
    }
    if (freeMinData?.value) setFreeMin(freeMinData.value);
    if (deliveryPriceData?.value) setDelivPrice(deliveryPriceData.value);
    setDirty(false);
  }, [tiersData, freeMinData, deliveryPriceData]);

  const updateTier = (index: number, field: "min" | "percent", value: string) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: Number(value) || 0 } : t));
    setDirty(true);
  };

  const addTier = () => {
    const lastMin = tiers.length > 0 ? tiers[tiers.length - 1].min : 0;
    setTiers(prev => [...prev, { min: lastMin + 50000, percent: (tiers[tiers.length - 1]?.percent || 0) + 5 }]);
    setDirty(true);
  };

  const removeTier = (index: number) => {
    setTiers(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sorted = [...tiers].sort((a, b) => a.min - b.min);
      await Promise.all([
        setMutation.mutateAsync({ key: "discount_tiers", value: JSON.stringify(sorted), type: "json", category: "discounts", description: "Шкала оптовых скидок (сумма → процент)" }),
        setMutation.mutateAsync({ key: "free_delivery_min", value: freeMin, type: "number", category: "delivery", description: "Минимальная сумма заказа для бесплатной доставки (₽)" }),
        setMutation.mutateAsync({ key: "delivery_price", value: delivPrice, type: "number", category: "delivery", description: "Стоимость доставки по городу (₽)" }),
      ]);
      toast.success("Настройки скидок и доставки сохранены");
      setDirty(false);
      refetchTiers(); refetchFreeMin(); refetchDeliveryPrice();
    } catch {
      toast.error("Ошибка сохранения");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Discount Tiers */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3530", marginBottom: 8 }}>Шкала скидок</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 8, fontSize: 11, color: "#9A938C", fontWeight: 600, padding: "0 2px" }}>
            <span>Сумма заказа от (₽)</span>
            <span>Скидка (%)</span>
            <span></span>
          </div>
          {tiers.map((tier, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 8, alignItems: "center" }}>
              <input
                className="st-input"
                type="number"
                value={tier.min}
                onChange={e => updateTier(i, "min", e.target.value)}
                style={{ padding: "6px 8px", fontSize: 13 }}
              />
              <input
                className="st-input"
                type="number"
                value={tier.percent}
                onChange={e => updateTier(i, "percent", e.target.value)}
                style={{ padding: "6px 8px", fontSize: 13 }}
              />
              <button
                className="st-icon-btn st-icon-btn-danger"
                onClick={() => removeTier(i)}
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="st-content-add-btn"
          onClick={addTier}
          style={{ marginTop: 8 }}
        >
          <Plus size={14} /> Добавить уровень
        </button>
      </div>

      {/* Delivery settings */}
      <div style={{ borderTop: "1px solid #F0EDE8", paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3530", marginBottom: 8 }}>Настройки доставки</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="st-item" style={{ padding: 12 }}>
            <div className="st-item-header" style={{ marginBottom: 6 }}>
              <label className="st-item-label" style={{ fontSize: 13 }}>Стоимость доставки по городу (₽)</label>
            </div>
            <input
              className="st-input"
              type="number"
              value={delivPrice}
              onChange={e => { setDelivPrice(e.target.value); setDirty(true); }}
            />
          </div>
          <div className="st-item" style={{ padding: 12 }}>
            <div className="st-item-header" style={{ marginBottom: 6 }}>
              <label className="st-item-label" style={{ fontSize: 13 }}>Бесплатная доставка от (₽)</label>
            </div>
            <input
              className="st-input"
              type="number"
              value={freeMin}
              onChange={e => { setFreeMin(e.target.value); setDirty(true); }}
            />
          </div>
        </div>
      </div>

      {dirty && (
        <button className="st-save-btn" onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
          <Save size={16} />
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </button>
      )}
    </div>
  );
}

// ── Categories/Subcategories management ──
function CategoriesSection() {
  const { data: tree, refetch } = trpc.catalog.getCategoryTree.useQuery();
  const renameCat = trpc.catalog.renameCategory.useMutation({ onSuccess: () => { refetch(); toast.success("Категория переименована"); } });
  const renameSub = trpc.catalog.renameSubcategory.useMutation({ onSuccess: () => { refetch(); toast.success("Подкатегория переименована"); } });
  const deleteCat = trpc.catalog.deleteCategory.useMutation({ onSuccess: () => { refetch(); toast.success("Категория удалена"); } });
  const deleteSub = trpc.catalog.deleteSubcategory.useMutation({ onSuccess: () => { refetch(); toast.success("Подкатегория удалена"); } });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ type: "cat" | "sub"; category: string; oldName: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const startEdit = (type: "cat" | "sub", category: string, name: string) => {
    setEditing({ type, category, oldName: name });
    setEditName(name);
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    if (editName.trim() === editing.oldName) { setEditing(null); return; }
    if (editing.type === "cat") {
      renameCat.mutate({ oldName: editing.oldName, newName: editName.trim() });
    } else {
      renameSub.mutate({ category: editing.category, oldName: editing.oldName, newName: editName.trim() });
    }
    setEditing(null);
  };

  const handleAddSub = (category: string) => {
    if (!newSubName.trim()) return;
    // Subcategories are derived from products - show info
    toast.info(`Подкатегория "${newSubName.trim()}" будет доступна при назначении товарам`);
    setAddingSubTo(null);
    setNewSubName("");
  };

  if (!tree) return <div style={{ padding: 20, color: "#999", fontSize: 13 }}>Загрузка...</div>;

  return (
    <div className="st-cats">
      {tree.length === 0 && <div style={{ padding: 20, color: "#999", fontSize: 13, textAlign: "center" }}>Категории не найдены</div>}
      {tree.map((cat) => (
        <div key={cat.category} className="st-cat-item">
          <div className="st-cat-row" onClick={() => toggle(cat.category)}>
            <span className="st-cat-chevron">
              {expanded.has(cat.category) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            {editing?.type === "cat" && editing.oldName === cat.category ? (
              <input
                className="st-cat-edit-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="st-cat-name">{cat.category}</span>
            )}
            <span className="st-cat-count">{cat.totalCount} товаров</span>
            <div className="st-cat-actions" onClick={(e) => e.stopPropagation()}>
              <button className="st-cat-action-btn" title="Переименовать" onClick={() => startEdit("cat", cat.category, cat.category)}>
                <Edit3 size={13} />
              </button>
              <button className="st-cat-action-btn" title="Добавить подкатегорию" onClick={() => { setAddingSubTo(cat.category); setNewSubName(""); setExpanded((prev) => new Set(prev).add(cat.category)); }}>
                <FolderPlus size={13} />
              </button>
              <button className="st-cat-action-btn st-cat-action-danger" title="Удалить" onClick={() => {
                if (window.confirm(`Удалить категорию "${cat.category}"? У ${cat.totalCount} товаров будет убрана категория.`)) {
                  deleteCat.mutate({ name: cat.category });
                }
              }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {expanded.has(cat.category) && (
            <div className="st-subcats">
              {cat.subcategories.map((sub) => (
                <div key={sub.name} className="st-subcat-row">
                  {editing?.type === "sub" && editing.category === cat.category && editing.oldName === sub.name ? (
                    <input
                      className="st-cat-edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                      autoFocus
                    />
                  ) : (
                    <span className="st-subcat-name">{sub.name}</span>
                  )}
                  <span className="st-cat-count">{sub.count}</span>
                  <div className="st-cat-actions">
                    <button className="st-cat-action-btn" title="Переименовать" onClick={() => startEdit("sub", cat.category, sub.name)}>
                      <Edit3 size={12} />
                    </button>
                    <button className="st-cat-action-btn st-cat-action-danger" title="Удалить" onClick={() => {
                      if (window.confirm(`Удалить подкатегорию "${sub.name}"?`)) {
                        deleteSub.mutate({ category: cat.category, name: sub.name });
                      }
                    }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {addingSubTo === cat.category && (
                <div className="st-subcat-row">
                  <input
                    className="st-cat-edit-input"
                    placeholder="Название подкатегории..."
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSub(cat.category); if (e.key === "Escape") setAddingSubTo(null); }}
                    autoFocus
                  />
                  <button className="st-cat-action-btn" onClick={() => handleAddSub(cat.category)} style={{ color: "#3D6E3D" }}>
                    <Plus size={14} />
                  </button>
                  <button className="st-cat-action-btn" onClick={() => setAddingSubTo(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {cat.subcategories.length === 0 && addingSubTo !== cat.category && (
                <div style={{ padding: "8px 16px", color: "#B5B0AA", fontSize: 12 }}>Нет подкатегорий</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SettingsTab() {
  const { data: settings, isLoading, refetch } = trpc.settings.list.useQuery();
  const setSettingMutation = trpc.settings.set.useMutation();

  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Reset edited on data reload
  useEffect(() => { setEdited({}); }, [settings]);

  const hasChanges = Object.keys(edited).length > 0;

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const promises = Object.entries(edited).map(([key, value]) => {
        const original = settings.find((s) => s.key === key);
        return setSettingMutation.mutateAsync({
          key,
          value,
          type: original?.type || "string",
          category: original?.category || undefined,
          description: original?.description || undefined,
        });
      });
      await Promise.all(promises);
      toast.success("Настройки сохранены");
      setEdited({});
      refetch();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  // Group by category
  const grouped = (settings || []).reduce((acc, s) => {
    const cat = s.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, typeof settings>);

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) -
              (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b))
  );

  if (isLoading) {
    return (
      <div className="st-loading">
        <RefreshCw className="st-spinner" size={24} />
        <span>Загрузка настроек...</span>
      </div>
    );
  }

  return (
    <div className="st-root">
      <style>{settingsStyles}</style>

      <div className="st-header">
        <div>
          <h2 className="st-title">Настройки</h2>
          <p className="st-subtitle">Бизнес-параметры и конфигурация</p>
        </div>
        {hasChanges && (
          <button className="st-save-btn" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Сохранение..." : `Сохранить (${Object.keys(edited).length})`}
          </button>
        )}
      </div>

      {/* Category tabs */}
      {sortedCategories.length > 0 && (
        <div className="st-page-tabs">
          <button
            className={`st-page-tab ${selectedCategory === "all" ? "st-page-tab-active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            Все
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat}
              className={`st-page-tab ${selectedCategory === cat ? "st-page-tab-active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      )}

      {sortedCategories
        .filter((cat) => selectedCategory === "all" || cat === selectedCategory)
        .map((cat) => (
        <div key={cat} className="st-group">
          <h3 className="st-group-title">{categoryLabels[cat] || cat}</h3>
          <div className="st-group-items">
            {(grouped[cat] || []).map((setting) => {
              const currentValue = edited[setting.key] ?? setting.value;
              const isLong = setting.value.length > 80 || setting.value.includes("\n") || setting.type === "json";
              const isChanged = edited[setting.key] !== undefined;

              return (
                <div key={setting.key} className={`st-item ${isChanged ? "st-item-changed" : ""}`}>
                  <div className="st-item-header">
                    <label className="st-item-label">{setting.description || setting.key}</label>
                    <code className="st-item-key">{setting.key}</code>
                  </div>
                  {isLong ? (
                    <textarea
                      className="st-textarea"
                      value={currentValue}
                      rows={4}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== setting.value) {
                          setEdited((prev) => ({ ...prev, [setting.key]: val }));
                        } else {
                          setEdited((prev) => { const c = { ...prev }; delete c[setting.key]; return c; });
                        }
                      }}
                    />
                  ) : (
                    <input
                      className="st-input"
                      type="text"
                      value={currentValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== setting.value) {
                          setEdited((prev) => ({ ...prev, [setting.key]: val }));
                        } else {
                          setEdited((prev) => { const c = { ...prev }; delete c[setting.key]; return c; });
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sortedCategories.length === 0 && (
        <div className="st-empty">
          Настройки не найдены. Создайте их через API или сид.
        </div>
      )}

      {/* ═══ DISCOUNT & DELIVERY SECTION ═══ */}
      <div className="st-group" style={{ marginTop: 32 }}>
        <h3 className="st-group-title">Скидки и доставка</h3>
        <DiscountDeliverySection />
      </div>

      {/* ═══ REQUISITES SECTION ═══ */}
      <div className="st-group" style={{ marginTop: 32 }}>
        <h3 className="st-group-title">Реквизиты ИП (для счетов на оплату)</h3>
        <RequisitesSection />
      </div>

      {/* ═══ CATEGORIES SECTION ═══ */}
      <div className="st-group" style={{ marginTop: 32 }}>
        <h3 className="st-group-title">Категории и подкатегории товаров</h3>
        <CategoriesSection />
      </div>

      {/* ═══ CONTENT SECTION ═══ */}
      <div className="st-group" style={{ marginTop: 32 }}>
        <h3 className="st-group-title">Контент сайта</h3>
        <ContentSection />
      </div>
    </div>
  );
}

const settingsStyles = `
.st-root { }
.st-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px 0; color: #9A938C; }
.st-spinner { animation: spin 1s linear infinite; }

.st-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.st-title { font-size: 22px; font-weight: 700; color: #3D3530; margin: 0; }
.st-subtitle { font-size: 14px; color: #9A938C; margin: 4px 0 0; }

.st-save-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none;
  background: #C75D3C; color: white; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.st-save-btn:hover { background: #B04E30; }
.st-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.st-group { margin-bottom: 28px; }
.st-group-title {
  font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6B5E54; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #F0EDE8;
}

.st-group-items { display: flex; flex-direction: column; gap: 12px; }

.st-item {
  background: #FFFCF9; border: 1px solid #E8E4DF; border-radius: 10px;
  padding: 14px 16px; transition: border-color 0.15s;
}
.st-item-changed { border-color: #C75D3C; background: #FFF8F5; }

.st-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.st-item-label { font-size: 14px; font-weight: 600; color: #3D3530; }
.st-item-key { font-size: 11px; color: #B5B0AA; background: #F5F0EB; padding: 2px 6px; border-radius: 4px; }

.st-input, .st-textarea {
  width: 100%; border: 1px solid #E8E4DF; border-radius: 6px; padding: 8px 10px;
  font-size: 14px; color: #3D3530; background: white; font-family: inherit;
  transition: border-color 0.15s; box-sizing: border-box;
}
.st-input:focus, .st-textarea:focus { outline: none; border-color: #C75D3C; }
.st-textarea { resize: vertical; min-height: 60px; }
.st-textarea-changed { border-color: #C75D3C; }

.st-empty { text-align: center; padding: 48px 0; color: #9A938C; font-size: 14px; display: flex; flex-direction: column; align-items: center; }

/* Content section styles */
.st-content-section { }
.st-content-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.st-content-search {
  display: flex; align-items: center; gap: 6px; border: 1px solid #E8E4DF; border-radius: 6px;
  padding: 0 10px; background: white; min-width: 180px;
}
.st-content-search input { border: none; outline: none; background: none; padding: 7px 0; font-size: 13px; color: #3D3530; flex: 1; }
.st-content-add-btn {
  display: flex; align-items: center; gap: 4px; padding: 7px 14px;
  border: 1px solid #E8E4DF; border-radius: 6px; background: white;
  font-size: 13px; color: #3D3530; cursor: pointer; font-weight: 500;
}
.st-content-add-btn:hover { border-color: #C75D3C; color: #C75D3C; }

.st-page-tabs {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;
}
.st-page-tab {
  padding: 5px 12px; border-radius: 6px; border: 1px solid #E8E4DF;
  background: white; font-size: 12px; color: #6B5E54; cursor: pointer;
  font-weight: 500; transition: all 0.15s;
}
.st-page-tab:hover { border-color: #C75D3C; color: #C75D3C; }
.st-page-tab-active { background: #C75D3C; color: white; border-color: #C75D3C; }
.st-page-tab-active:hover { background: #B04E30; color: white; }

.st-content-page-group { margin-bottom: 16px; }
.st-content-page-label {
  font-size: 12px; font-weight: 600; color: #9A938C; text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 8px; padding-left: 2px;
}
.st-content-item {
  background: #FFFCF9; border: 1px solid #E8E4DF; border-radius: 8px;
  padding: 10px 14px; margin-bottom: 8px; transition: border-color 0.15s;
}
.st-content-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.st-content-section-tag { font-size: 10px; background: #EDE8E3; color: #6B5E54; padding: 1px 6px; border-radius: 4px; }
.st-content-desc { font-size: 12px; color: #9A938C; margin-bottom: 6px; }

.st-icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px;
  border-radius: 4px; color: #9A938C; display: flex; align-items: center;
}
.st-icon-btn:hover { background: #F5F0EB; color: #3D3530; }
.st-icon-btn-danger:hover { background: #FDECEA; color: #C75D3C; }

/* Modal overlay */
.st-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.st-dialog {
  background: #FFFCF9; border-radius: 12px; padding: 24px; width: 440px;
  max-width: 90vw; box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}
.st-dialog-title { font-size: 16px; font-weight: 700; color: #3D3530; margin-bottom: 16px; }
.st-dialog-form { display: flex; flex-direction: column; gap: 8px; }
.st-dialog-form label { font-size: 13px; font-weight: 600; color: #3D3530; margin-top: 4px; }
.st-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.st-dialog-cancel {
  padding: 8px 16px; border: 1px solid #E8E4DF; border-radius: 6px;
  background: white; font-size: 13px; cursor: pointer; color: #3D3530;
}

/* Categories management */
.st-cats { display: flex; flex-direction: column; gap: 2px; }
.st-cat-item { background: #FFFCF9; border: 1px solid #E8E4DF; border-radius: 8px; overflow: hidden; }
.st-cat-row {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  cursor: pointer; transition: background 0.15s; user-select: none;
}
.st-cat-row:hover { background: #FFF8F5; }
.st-cat-chevron { color: #9A938C; display: flex; align-items: center; }
.st-cat-name { font-size: 14px; font-weight: 600; color: #3D3530; flex: 1; }
.st-cat-count { font-size: 12px; color: #9A938C; margin-right: 8px; }
.st-cat-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.st-cat-row:hover .st-cat-actions, .st-subcat-row:hover .st-cat-actions { opacity: 1; }
.st-cat-action-btn {
  background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px;
  color: #9A938C; display: flex; align-items: center; transition: all 0.15s;
}
.st-cat-action-btn:hover { background: #F0EDE8; color: #3D3530; }
.st-cat-action-danger:hover { background: #FDECEA; color: #EF4444; }
.st-cat-edit-input {
  flex: 1; border: 1px solid #C75D3C; border-radius: 4px; padding: 4px 8px;
  font-size: 13px; color: #3D3530; outline: none; background: white;
}
.st-subcats { border-top: 1px solid #F0EDE8; padding: 4px 0; }
.st-subcat-row {
  display: flex; align-items: center; gap: 8px; padding: 7px 14px 7px 40px;
  transition: background 0.15s;
}
.st-subcat-row:hover { background: #FFF8F5; }
.st-subcat-name { font-size: 13px; color: #3D3530; flex: 1; }

@media (max-width: 768px) {
  .st-header { flex-direction: column; gap: 12px; }
  .st-title { font-size: 18px; }
  .st-page-tabs { flex-wrap: wrap; gap: 4px; }
  .st-page-tab { padding: 5px 10px; font-size: 11px; }
  .st-group { margin-bottom: 20px; }
  .st-item { padding: 12px; }
  .st-item-header { flex-direction: column; align-items: flex-start; gap: 4px; }
  .st-item-key { font-size: 10px; }
  .st-dialog { max-width: 95vw !important; width: 95vw !important; padding: 16px; }
  .st-dialog-title { font-size: 14px; }
  .st-content-header { flex-direction: column; align-items: stretch; }
  .st-content-search { min-width: unset; }
  .st-content-item { padding: 10px; }
  .st-content-item-top { flex-wrap: wrap; }
  .st-cat-row { padding: 8px 10px; }
  .st-subcat-row { padding: 6px 10px 6px 28px; }
  .st-cat-actions { flex-wrap: wrap; opacity: 1; }
  .st-save-btn { font-size: 13px; padding: 7px 12px; }
}
`;
