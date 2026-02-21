import { useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Plus,
  Search,
  Edit3,
  Trash2,
  RefreshCw,
  Check,
  X,
  Image,
  CheckSquare,
  Square,
  Percent,
  Layers,
  Upload,
  FolderPlus,
  ChevronDown,
  Barcode,
} from "lucide-react";
import { PrintLabelsDialog } from "./PrintLabelsDialog";

// ── Photo upload component ──
function PhotoUploader({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.upload.productImage.useMutation();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newImages = [...images];
    for (let i = 0; i < files.length && newImages.length < 5; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const result = await uploadMutation.mutateAsync({ base64, filename: file.name });
        newImages.push(result.url);
      } catch {
        toast.error(`Ошибка загрузки ${file.name}`);
      }
    }
    onChange(newImages);
  }, [images, onChange, uploadMutation]);

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <Label>Фото (до 5 шт.)</Label>
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, idx) => (
            <div key={idx} className="cat-upload-thumb">
              <img src={img} alt="" />
              <button type="button" className="cat-upload-remove" onClick={() => removeImage(idx)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < 5 && (
        <button
          type="button"
          className="cat-upload-area"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload size={20} />
          <span>{uploadMutation.isPending ? "Загрузка..." : "Выбрать фото"}</span>
          <span className="cat-upload-hint">JPG, PNG. Макс. 5 фото</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ── Searchable category dropdown ──
function CategoryDropdown({
  value,
  onChange,
  categories,
  allowAdd,
  placeholder = "Все категории",
}: {
  value: string;
  onChange: (val: string) => void;
  categories: string[];
  allowAdd?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");

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

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      onChange(newCatName.trim());
      setNewCatName("");
      setAddingCategory(false);
      setOpen(false);
    }
  };

  return (
    <div className="cat-dropdown-wrap">
      <button type="button" className="cat-dropdown-trigger" onClick={() => setOpen(!open)}>
        <span className={value && value !== "all" ? "cat-dropdown-val" : "cat-dropdown-placeholder"}>
          {value && value !== "all" ? value : placeholder}
        </span>
        <ChevronDown size={14} className={`cat-dropdown-arrow ${open ? "rotated" : ""}`} />
      </button>
      {open && (
        <>
          <div className="cat-dropdown-overlay" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="cat-dropdown-menu">
            <div className="cat-dropdown-search">
              <Search size={14} />
              <input autoFocus placeholder="Найти категорию..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="cat-dropdown-list">
              <div className={`cat-dropdown-item ${!value || value === "all" ? "active" : ""}`} onClick={() => handleSelect("all")}>
                {placeholder}
              </div>
              {filtered.map((cat) => (
                <div key={cat} className={`cat-dropdown-item ${value === cat ? "active" : ""}`} onClick={() => handleSelect(cat)}>
                  {cat}
                  {value === cat && <Check size={14} />}
                </div>
              ))}
              {filtered.length === 0 && search && <div className="cat-dropdown-empty">Ничего не найдено</div>}
            </div>
            {allowAdd && (
              <div className="cat-dropdown-footer">
                {addingCategory ? (
                  <div className="cat-dropdown-add-form">
                    <input autoFocus placeholder="Название категории" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} />
                    <button onClick={handleAddCategory} disabled={!newCatName.trim()}><Check size={14} /></button>
                    <button onClick={() => { setAddingCategory(false); setNewCatName(""); }}><X size={14} /></button>
                  </div>
                ) : (
                  <button className="cat-dropdown-add-btn" onClick={() => setAddingCategory(true)}>
                    <FolderPlus size={14} /> Добавить категорию
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function CatalogTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: number;
    article: string;
    name: string;
    description: string | null;
    category: string | null;
    subcategory: string | null;
    priceMin: string | null;
    priceMax: string | null;
    priceUnit: string | null;
    materials: string | null;
    dimensions: string | null;
    weight: string | null;
    productionTime: string | null;
    isActive: boolean | null;
    stockStatus: string | null;
    images: string[] | null;
    tags: string[] | null;
    slug: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkStockStatus, setBulkStockStatus] = useState<string>("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkDiscount, setBulkDiscount] = useState("");
  const [showSeo, setShowSeo] = useState(false);
  const [hoveredImg, setHoveredImg] = useState<{ src: string; x: number; y: number } | null>(null);

  const [newProduct, setNewProduct] = useState({
    article: "",
    name: "",
    description: "",
    category: "",
    priceMin: "",
    priceUnit: "шт",
    materials: "",
    dimensions: "",
    weight: "",
    stockStatus: "in_stock",
    tags: "",
    images: [] as string[],
  });

  const { data: productsData, refetch: refetchProducts, isLoading } = trpc.catalog.products.list.useQuery({
    category: category === "all" ? undefined : category,
    subcategory: subcategory === "all" ? undefined : subcategory,
    isActive: showInactive ? undefined : true,
    search: search || undefined,
    page,
    limit: 20,
  });

  const { data: categories } = trpc.catalog.getCategories.useQuery();
  const { data: categoryTree } = trpc.catalog.categories.list.useQuery();

  // Build main categories and subcategories for filters
  const mainCategories = useMemo(() => {
    if (!categoryTree) return [];
    return (categoryTree as any[]).filter(c => !c.parentId).map(c => c.name);
  }, [categoryTree]);

  const subcategoriesForMain = useMemo(() => {
    if (!categoryTree || category === "all") return [];
    const parent = (categoryTree as any[]).find(c => !c.parentId && c.name === category);
    if (!parent) return [];
    return (categoryTree as any[]).filter(c => c.parentId === parent.id).map(c => c.name);
  }, [categoryTree, category]);
  const { data: catalogStats } = trpc.catalog.stats.useQuery();

  const createProductMutation = trpc.catalog.products.create.useMutation({
    onSuccess: () => {
      toast.success("Товар создан");
      refetchProducts();
      setIsAddingProduct(false);
      setNewProduct({ article: "", name: "", description: "", category: "", priceMin: "", priceUnit: "шт", materials: "", dimensions: "", weight: "", stockStatus: "in_stock", tags: "", images: [] });
    },
    onError: (error) => toast.error(error.message || "Ошибка при создании товара"),
  });

  const updateProductMutation = trpc.catalog.products.update.useMutation({
    onSuccess: () => { toast.success("Товар обновлен"); refetchProducts(); setEditingProduct(null); },
    onError: (error) => toast.error(error.message || "Ошибка при обновлении"),
  });

  const deleteProductMutation = trpc.catalog.products.delete.useMutation({
    onSuccess: () => { toast.success("Товар удален"); refetchProducts(); },
    onError: (error) => toast.error(error.message || "Ошибка при удалении"),
  });

  const bulkUpdateMutation = trpc.catalog.products.bulkUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(`Обновлено ${data.updated} товаров`);
      refetchProducts(); setSelectedIds(new Set()); setBulkEditOpen(false);
      setBulkStockStatus(""); setBulkPrice(""); setBulkDiscount("");
    },
    onError: (error) => toast.error(error.message || "Ошибка массового обновления"),
  });

  const handleCreateProduct = () => {
    createProductMutation.mutate({
      article: newProduct.article,
      name: newProduct.name,
      description: newProduct.description || undefined,
      category: newProduct.category || undefined,
      priceMin: newProduct.priceMin ? parseFloat(newProduct.priceMin) : undefined,
      priceUnit: newProduct.priceUnit || undefined,
      materials: newProduct.materials || undefined,
      dimensions: newProduct.dimensions || undefined,
      weight: newProduct.weight || undefined,
      images: newProduct.images.length > 0 ? newProduct.images : undefined,
      tags: newProduct.tags ? newProduct.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    });
  };

  const handleUpdateProduct = () => {
    if (!editingProduct) return;
    updateProductMutation.mutate({
      id: editingProduct.id,
      name: editingProduct.name,
      description: editingProduct.description || undefined,
      category: editingProduct.category || undefined,
      subcategory: editingProduct.subcategory || undefined,
      priceMin: editingProduct.priceMin ? parseFloat(editingProduct.priceMin) : null,
      priceMax: editingProduct.priceMax ? parseFloat(editingProduct.priceMax) : null,
      priceUnit: editingProduct.priceUnit || undefined,
      materials: editingProduct.materials || undefined,
      dimensions: editingProduct.dimensions || undefined,
      weight: editingProduct.weight || undefined,
      images: editingProduct.images || undefined,
      isActive: editingProduct.isActive ?? true,
      stockStatus: (editingProduct.stockStatus as "in_stock" | "to_order") || "in_stock",
      tags: editingProduct.tags || undefined,
      slug: editingProduct.slug || undefined,
      metaTitle: editingProduct.metaTitle || undefined,
      metaDescription: editingProduct.metaDescription || undefined,
    });
  };

  const handleBulkEdit = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkUpdateMutation.mutate({
      ids,
      stockStatus: bulkStockStatus ? (bulkStockStatus as "in_stock" | "to_order") : undefined,
      priceMin: bulkPrice ? parseFloat(bulkPrice) : undefined,
      discountPercent: bulkDiscount ? parseFloat(bulkDiscount) : undefined,
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInCategory = () => {
    if (!productsData?.products) return;
    setSelectedIds(new Set(productsData.products.map((p) => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const allSelected = productsData?.products && productsData.products.length > 0 &&
    productsData.products.every((p) => selectedIds.has(p.id));

  const handlePhotoHover = (e: React.MouseEvent, src: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setHoveredImg({ src, x: rect.right + 8, y: rect.top });
  };

  return (
    <div className="space-y-4">
      <style>{catalogStyles}</style>

      {hoveredImg && (
        <div className="cat-photo-preview" style={{ top: hoveredImg.y, left: hoveredImg.x }}>
          <img src={hoveredImg.src} alt="" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего товаров</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{catalogStats?.total || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">В наличии</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{catalogStats?.inStock || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Категорий</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{catalogStats?.categories || 0}</div></CardContent>
        </Card>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="cat-bulk-bar">
          <div className="cat-bulk-info"><CheckSquare size={18} /><span>Выбрано: <strong>{selectedIds.size}</strong></span></div>
          <div className="cat-bulk-actions">
            <button className="cat-bulk-btn" onClick={clearSelection}><X size={14} /> Снять</button>
            <button className="cat-bulk-btn cat-bulk-btn-primary" onClick={() => setBulkEditOpen(true)}><Edit3 size={14} /> Редактировать</button>
            <button className="cat-bulk-btn" onClick={() => setPrintLabelsOpen(true)}><Barcode size={14} /> Штрихкоды</button>
          </div>
        </div>
      )}

      {/* Main */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Каталог товаров</CardTitle>
              <CardDescription>Управление товарами и услугами</CardDescription>
            </div>
            <Button onClick={() => setIsAddingProduct(true)}><Plus className="w-4 h-4 mr-2" /> Добавить товар</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию, артикулу..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
            </div>
            <CategoryDropdown value={category} onChange={(v) => { setCategory(v); setSubcategory("all"); setPage(1); }} categories={mainCategories} placeholder="Все категории" />
            {category !== "all" && subcategoriesForMain.length > 0 && (
              <CategoryDropdown value={subcategory} onChange={(v) => { setSubcategory(v); setPage(1); }} categories={subcategoriesForMain} placeholder="Все подкатегории" />
            )}
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-sm">Скрытые</Label>
            </div>
            {productsData?.products && productsData.products.length > 0 && (
              <Button variant="outline" size="sm" onClick={allSelected ? clearSelection : selectAllInCategory}>
                {allSelected ? <><CheckSquare className="w-4 h-4 mr-1" /> Снять</> : <><Square className="w-4 h-4 mr-1" /> Выбрать все</>}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : productsData?.products && productsData.products.length > 0 ? (
            <>
              <div className="cat-table">
                <div className="cat-table-head">
                  <span></span><span>Фото</span><span>Товар</span><span>Цена</span><span>Категория</span><span>Статус</span><span></span>
                </div>
                {productsData.products.map((product) => {
                  const firstImage = (product.images as string[] | null)?.[0];
                  const stockLabel = (product as any).stockStatus === "to_order" ? "Под заказ" : "В наличии";
                  const stockClass = (product as any).stockStatus === "to_order" ? "cat-status-order" : "cat-status-stock";
                  return (
                    <div key={product.id} className={`cat-table-row ${!product.isActive ? "cat-row-inactive" : ""}`}>
                      <span className="cat-checkbox" onClick={() => toggleSelect(product.id)}>
                        {selectedIds.has(product.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                      </span>
                      <span className="cat-photo" onMouseEnter={(e) => firstImage && handlePhotoHover(e, firstImage)} onMouseLeave={() => setHoveredImg(null)}>
                        {firstImage ? <img src={firstImage} alt="" className="cat-photo-img" /> : <div className="cat-photo-placeholder"><Image size={16} /></div>}
                      </span>
                      <div className="cat-product-info">
                        <span className="cat-product-name">{product.name}</span>
                        <span className="cat-product-article">{product.article}</span>
                        {((product as any).dimensions || (product as any).weight || (product as any).materials) && (
                          <div className="cat-product-chars">
                            {(product as any).dimensions && (product as any).dimensions !== "—" && <span>{(product as any).dimensions}</span>}
                            {(product as any).weight && (product as any).weight !== "—" && <span>{(product as any).weight}</span>}
                            {(product as any).materials && (product as any).materials !== "—" && <span>{(product as any).materials}</span>}
                          </div>
                        )}
                      </div>
                      <span className="cat-price">
                        {product.priceMin ? <>{parseFloat(product.priceMin).toLocaleString("ru-RU")} ₽</> : <span className="text-muted-foreground">—</span>}
                      </span>
                      <span className="cat-category">{product.category || "—"}</span>
                      <span className={`cat-status ${stockClass}`}>
                        {stockLabel}
                        {!product.isActive && <Badge variant="secondary" className="ml-1 text-[10px]">Скрыт</Badge>}
                      </span>
                      <span className="cat-actions">
                        <button className="cat-action-btn" onClick={() => { setEditingProduct({ ...product, stockStatus: (product as any).stockStatus || "in_stock", tags: product.tags || null, images: (product.images as string[] | null) || null }); setShowSeo(false); }}>
                          <Edit3 size={15} />
                        </button>
                        <button className="cat-action-btn cat-action-delete" onClick={() => { if (confirm("Удалить товар?")) deleteProductMutation.mutate({ id: product.id }); }}>
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              {(productsData?.total || 0) > 20 && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
                  <span className="flex items-center px-4 text-sm">{page} / {Math.ceil((productsData?.total || 0) / 20)}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil((productsData?.total || 0) / 20)}>Вперед</Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Товаров не найдено</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Product ─── */}
      <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
        <DialogContent className="dialog-content cat-modal max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый товар</DialogTitle>
            <DialogDescription>Добавьте новый товар в каталог</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Артикул *</Label>
              <Input placeholder="КОВ-001" value={newProduct.article} onChange={(e) => setNewProduct({ ...newProduct, article: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input placeholder="Кованые перила" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Описание</Label>
              <Textarea placeholder="Подробное описание товара..." value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <CategoryDropdown value={newProduct.category || "all"} onChange={(v) => setNewProduct({ ...newProduct, category: v === "all" ? "" : v })} categories={mainCategories} placeholder="Выберите категорию" />
            </div>
            <div className="space-y-2">
              <Label>Подкатегория</Label>
              <CategoryDropdown
                value={(newProduct as any).subcategory || "all"}
                onChange={(v) => setNewProduct({ ...newProduct, subcategory: v === "all" ? "" : v } as any)}
                categories={(() => {
                  if (!categoryTree || !newProduct.category) return categories || [];
                  const parent = (categoryTree as any[]).find(c => !c.parentId && c.name === newProduct.category);
                  if (!parent) return categories || [];
                  return (categoryTree as any[]).filter(c => c.parentId === parent.id).map(c => c.name);
                })()}
                allowAdd
                placeholder="Выберите подкатегорию"
              />
            </div>
            <div className="space-y-2">
              <Label>Цена (₽)</Label>
              <Input type="number" placeholder="5000" value={newProduct.priceMin} onChange={(e) => setNewProduct({ ...newProduct, priceMin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Единица измерения</Label>
              <Input placeholder="шт / м.п. / м²" value={newProduct.priceUnit} onChange={(e) => setNewProduct({ ...newProduct, priceUnit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Наличие</Label>
              <Select value={newProduct.stockStatus} onValueChange={(v) => setNewProduct({ ...newProduct, stockStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">В наличии</SelectItem>
                  <SelectItem value="to_order">Под заказ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Материалы</Label>
              <Select value={newProduct.materials || "none"} onValueChange={(v) => setNewProduct({ ...newProduct, materials: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Выберите материал" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не указан</SelectItem>
                  <SelectItem value="Сталь">Сталь</SelectItem>
                  <SelectItem value="Чугун">Чугун</SelectItem>
                  <SelectItem value="Нержавеющая сталь">Нержавеющая сталь</SelectItem>
                  <SelectItem value="Алюминий">Алюминий</SelectItem>
                  <SelectItem value="Медь">Медь</SelectItem>
                  <SelectItem value="Латунь">Латунь</SelectItem>
                  <SelectItem value="Дерево + металл">Дерево + металл</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Размеры</Label>
              <Input placeholder="1000x500x50 мм" value={newProduct.dimensions} onChange={(e) => setNewProduct({ ...newProduct, dimensions: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Вес</Label>
              <Input placeholder="5 кг" value={newProduct.weight} onChange={(e) => setNewProduct({ ...newProduct, weight: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Теги (через запятую)</Label>
              <Input placeholder="перила, ковка, лестница" value={newProduct.tags} onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <PhotoUploader images={newProduct.images} onChange={(imgs) => setNewProduct({ ...newProduct, images: imgs })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingProduct(false)}>Отмена</Button>
            <Button onClick={handleCreateProduct} disabled={!newProduct.article || !newProduct.name || createProductMutation.isPending}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Product ─── */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="dialog-content cat-modal max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
            <DialogDescription>Артикул: <code className="bg-muted px-1 rounded">{editingProduct?.article}</code></DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="md:col-span-2">
                <PhotoUploader images={editingProduct.images || []} onChange={(imgs) => setEditingProduct({ ...editingProduct, images: imgs })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Название</Label>
                <Input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Описание</Label>
                <Textarea value={editingProduct.description || ""} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <CategoryDropdown value={editingProduct.category || "all"} onChange={(v) => setEditingProduct({ ...editingProduct, category: v === "all" ? null : v })} categories={mainCategories} placeholder="Выберите категорию" />
              </div>
              <div className="space-y-2">
                <Label>Подкатегория</Label>
                <CategoryDropdown
                  value={editingProduct.subcategory || "all"}
                  onChange={(v) => setEditingProduct({ ...editingProduct, subcategory: v === "all" ? null : v })}
                  categories={(() => {
                    if (!categoryTree || !editingProduct.category) return categories || [];
                    const parent = (categoryTree as any[]).find(c => !c.parentId && c.name === editingProduct.category);
                    if (!parent) return categories || [];
                    return (categoryTree as any[]).filter(c => c.parentId === parent.id).map(c => c.name);
                  })()}
                  allowAdd
                  placeholder="Выберите подкатегорию"
                />
              </div>
              <div className="space-y-2">
                <Label>Цена (₽)</Label>
                <Input type="number" value={editingProduct.priceMin || ""} onChange={(e) => setEditingProduct({ ...editingProduct, priceMin: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Единица измерения</Label>
                <Input value={editingProduct.priceUnit || ""} onChange={(e) => setEditingProduct({ ...editingProduct, priceUnit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Наличие</Label>
                <Select value={editingProduct.stockStatus || "in_stock"} onValueChange={(v) => setEditingProduct({ ...editingProduct, stockStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">В наличии</SelectItem>
                    <SelectItem value="to_order">Под заказ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Материалы</Label>
                <Select value={editingProduct.materials || "none"} onValueChange={(v) => setEditingProduct({ ...editingProduct, materials: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не указан</SelectItem>
                    <SelectItem value="Сталь">Сталь</SelectItem>
                    <SelectItem value="Чугун">Чугун</SelectItem>
                    <SelectItem value="Нержавеющая сталь">Нержавеющая сталь</SelectItem>
                    <SelectItem value="Алюминий">Алюминий</SelectItem>
                    <SelectItem value="Медь">Медь</SelectItem>
                    <SelectItem value="Латунь">Латунь</SelectItem>
                    <SelectItem value="Дерево + металл">Дерево + металл</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Размеры</Label>
                <Input value={editingProduct.dimensions || ""} onChange={(e) => setEditingProduct({ ...editingProduct, dimensions: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Вес</Label>
                <Input value={editingProduct.weight || ""} onChange={(e) => setEditingProduct({ ...editingProduct, weight: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Теги (через запятую)</Label>
                <Input value={editingProduct.tags?.join(", ") || ""} onChange={(e) => setEditingProduct({ ...editingProduct, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch checked={editingProduct.isActive ?? true} onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, isActive: checked })} />
                <Label>Товар активен (отображается на сайте)</Label>
              </div>
              {/* Collapsible SEO */}
              <div className="md:col-span-2 border-t pt-2">
                <button type="button" className="cat-seo-toggle" onClick={() => setShowSeo(!showSeo)}>
                  <ChevronDown size={14} className={showSeo ? "rotated" : ""} />
                  <span>SEO-настройки</span>
                </button>
                {showSeo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label>Slug (URL)</Label>
                      <Input value={editingProduct.slug || ""} onChange={(e) => setEditingProduct({ ...editingProduct, slug: e.target.value })} placeholder="balyasina-kovanaya-bk-01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Title</Label>
                      <Input value={editingProduct.metaTitle || ""} onChange={(e) => setEditingProduct({ ...editingProduct, metaTitle: e.target.value })} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Meta Description</Label>
                      <Textarea value={editingProduct.metaDescription || ""} onChange={(e) => setEditingProduct({ ...editingProduct, metaDescription: e.target.value })} rows={2} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Отмена</Button>
            <Button onClick={handleUpdateProduct} disabled={updateProductMutation.isPending}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Edit ─── */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="dialog-content cat-modal">
          <DialogHeader>
            <DialogTitle>Массовое редактирование</DialogTitle>
            <DialogDescription>Изменить {selectedIds.size} товаров</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Статус наличия</Label>
              <Select value={bulkStockStatus || "unchanged"} onValueChange={(v) => setBulkStockStatus(v === "unchanged" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unchanged">Не менять</SelectItem>
                  <SelectItem value="in_stock">В наличии</SelectItem>
                  <SelectItem value="to_order">Под заказ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Установить цену (₽)</Label>
              <Input type="number" placeholder="Оставить без изменений" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Скидка <Percent size={12} /></Label>
              <Input type="number" placeholder="Процент скидки от текущей цены" value={bulkDiscount} onChange={(e) => setBulkDiscount(e.target.value)} min="0" max="100" />
              {bulkDiscount && <p className="text-xs text-muted-foreground">Цена каждого товара уменьшится на {bulkDiscount}%</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkEdit} disabled={bulkUpdateMutation.isPending || (!bulkStockStatus && !bulkPrice && !bulkDiscount)}>
              {bulkUpdateMutation.isPending ? "Сохранение..." : "Применить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Print Dialog */}
      <PrintLabelsDialog
        open={printLabelsOpen}
        onClose={() => setPrintLabelsOpen(false)}
        productIds={Array.from(selectedIds)}
      />
    </div>
  );
}

const catalogStyles = `
/* ─── Light modal ─── */
.cat-modal { background: #FFFCF9 !important; border: 1px solid #E8E4DF !important; color: #3D3530 !important; }
.cat-modal [data-slot="dialog-title"] { color: #3D3530 !important; }
.cat-modal [data-slot="dialog-description"] { color: #6B5E54 !important; }
.cat-modal label { color: #3D3530 !important; }
.cat-modal input, .cat-modal textarea { background: #fff !important; border-color: #E8E4DF !important; color: #3D3530 !important; }
.cat-modal input::placeholder, .cat-modal textarea::placeholder { color: #B5B0AA !important; }
.cat-modal input:focus, .cat-modal textarea:focus { border-color: #C75D3C !important; box-shadow: 0 0 0 2px rgba(199,93,60,0.15) !important; }
.cat-modal button[data-slot="select-trigger"] { background: #fff !important; border-color: #E8E4DF !important; color: #3D3530 !important; }
.cat-modal code { background: #F5F0EB !important; color: #6B5E54 !important; }

/* ─── Photo upload ─── */
.cat-upload-area { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 20px; border: 2px dashed #E8E4DF; border-radius: 10px; background: #FAF8F5; color: #6B5E54; cursor: pointer; font-size: 14px; transition: all 0.15s; }
.cat-upload-area:hover { border-color: #C75D3C; background: #FFF7ED; color: #C75D3C; }
.cat-upload-area:disabled { opacity: 0.6; cursor: wait; }
.cat-upload-hint { font-size: 11px; color: #B5B0AA; }
.cat-upload-thumb { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid #E8E4DF; }
.cat-upload-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cat-upload-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.cat-upload-thumb:hover .cat-upload-remove { opacity: 1; }

/* ─── Category dropdown ─── */
.cat-dropdown-wrap { position: relative; min-width: 200px; }
.cat-dropdown-trigger { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 12px; border: 1px solid #E8E4DF; border-radius: 8px; background: #fff; font-size: 14px; cursor: pointer; color: #3D3530; transition: border-color 0.15s; }
.cat-dropdown-trigger:hover { border-color: #C75D3C; }
.cat-dropdown-placeholder { color: #B5B0AA; }
.cat-dropdown-val { color: #3D3530; }
.cat-dropdown-arrow { color: #9A938C; transition: transform 0.2s; }
.cat-dropdown-arrow.rotated { transform: rotate(180deg); }
.cat-dropdown-overlay { position: fixed; inset: 0; z-index: 99; }
.cat-dropdown-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100; background: #fff; border: 1px solid #E8E4DF; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden; min-width: 220px; }
.cat-dropdown-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #F0EDE8; color: #9A938C; }
.cat-dropdown-search input { flex: 1; border: none; outline: none; font-size: 13px; color: #3D3530; background: transparent; }
.cat-dropdown-list { max-height: 240px; overflow-y: auto; padding: 4px 0; }
.cat-dropdown-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; font-size: 13px; color: #3D3530; cursor: pointer; transition: background 0.1s; }
.cat-dropdown-item:hover { background: #FAF8F5; }
.cat-dropdown-item.active { color: #C75D3C; font-weight: 500; }
.cat-dropdown-empty { padding: 12px; text-align: center; font-size: 13px; color: #B5B0AA; }
.cat-dropdown-footer { border-top: 1px solid #F0EDE8; padding: 6px; }
.cat-dropdown-add-btn { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px; border: none; background: none; font-size: 13px; color: #C75D3C; cursor: pointer; border-radius: 6px; transition: background 0.1s; }
.cat-dropdown-add-btn:hover { background: #FFF7ED; }
.cat-dropdown-add-form { display: flex; align-items: center; gap: 4px; padding: 4px; }
.cat-dropdown-add-form input { flex: 1; padding: 6px 8px; border: 1px solid #E8E4DF; border-radius: 6px; font-size: 13px; outline: none; color: #3D3530; }
.cat-dropdown-add-form input:focus { border-color: #C75D3C; }
.cat-dropdown-add-form button { padding: 6px; border: none; background: none; cursor: pointer; border-radius: 6px; color: #6B5E54; transition: all 0.1s; }
.cat-dropdown-add-form button:hover { background: #F5F0EB; color: #C75D3C; }
.cat-dropdown-add-form button:disabled { opacity: 0.4; cursor: default; }

/* ─── SEO toggle ─── */
.cat-seo-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; font-size: 13px; font-weight: 500; color: #9A938C; cursor: pointer; padding: 4px 0; }
.cat-seo-toggle:hover { color: #6B5E54; }
.cat-seo-toggle .rotated { transform: rotate(180deg); }

/* ─── Photo hover preview ─── */
.cat-photo-preview { position: fixed; z-index: 1000; pointer-events: none; width: 200px; height: 200px; background: #fff; border: 1px solid #E8E4DF; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden; }
.cat-photo-preview img { width: 100%; height: 100%; object-fit: contain; }

/* ─── Table ─── */
.cat-table { border: 1px solid #E8E4DF; border-radius: 10px; overflow: hidden; }
.cat-table-head { display: grid; grid-template-columns: 40px 56px 2fr 100px 120px 100px 80px; padding: 8px 12px; background: #F5F0EB; font-size: 12px; font-weight: 600; color: #6B5E54; text-transform: uppercase; letter-spacing: 0.04em; align-items: center; }
.cat-table-row { display: grid; grid-template-columns: 40px 56px 2fr 100px 120px 100px 80px; padding: 10px 12px; border-top: 1px solid #F0EDE8; align-items: center; transition: background 0.15s; }
.cat-table-row:hover { background: #FAF8F5; }
.cat-row-inactive { opacity: 0.55; }
.cat-checkbox { cursor: pointer; display: flex; align-items: center; justify-content: center; color: #B5B0AA; }
.cat-checkbox:hover { color: #6B5E54; }
.cat-photo { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.cat-photo-img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #E8E4DF; transition: transform 0.15s; }
.cat-photo:hover .cat-photo-img { transform: scale(1.1); }
.cat-photo-placeholder { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #F5F0EB; border-radius: 6px; color: #B5B0AA; }
.cat-product-info { display: flex; flex-direction: column; min-width: 0; }
.cat-product-name { font-size: 14px; color: #3D3530; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-product-article { font-size: 11px; color: #9A938C; }
.cat-product-chars { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 2px; }
.cat-product-chars span { font-size: 11px; color: #9A938C; white-space: nowrap; }
.cat-price { font-size: 14px; font-weight: 600; color: #3D3530; }
.cat-category { font-size: 13px; color: #6B5E54; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-status { font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; width: fit-content; }
.cat-status-stock { background: #DCFCE7; color: #166534; }
.cat-status-order { background: #FEF3C7; color: #92400E; }
.cat-actions { display: flex; gap: 4px; }
.cat-action-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; color: #9A938C; transition: all 0.15s; }
.cat-action-btn:hover { background: #F5F0EB; color: #3D3530; }
.cat-action-delete:hover { color: #DC2626; background: #FEF2F2; }
.cat-bulk-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 10px; }
.cat-bulk-info { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #C2410C; }
.cat-bulk-actions { display: flex; gap: 8px; }
.cat-bulk-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; border: 1px solid #E8E4DF; background: white; font-size: 13px; cursor: pointer; color: #6B5E54; transition: all 0.15s; }
.cat-bulk-btn:hover { background: #F5F0EB; }
.cat-bulk-btn-primary { background: #C75D3C; color: white; border-color: #C75D3C; }
.cat-bulk-btn-primary:hover { background: #B5502F; }

@media (max-width: 768px) {
  .cat-table-head, .cat-table-row { grid-template-columns: 36px 44px 1fr 80px 70px; }
  .cat-table-head > :nth-child(5), .cat-table-row > :nth-child(5) { display: none; }
  .cat-table-head > :nth-child(7), .cat-table-row > :nth-child(7) { display: none; }
}
`;
