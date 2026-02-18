import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Loader2, Barcode } from "lucide-react";
import { BarcodeLabel } from "./BarcodeLabel";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PrintLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  productIds: number[];
}

type ProductForLabel = {
  id: number;
  name: string;
  article: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  subcategory: string | null;
  priceMin: string | null;
  dimensions: string | null;
};

export function PrintLabelsDialog({ open, onClose, productIds }: PrintLabelsDialogProps) {
  const [copies, setCopies] = useState(1);
  const [generated, setGenerated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Reset generated state when dialog opens/closes or products change
  useEffect(() => {
    if (!open) setGenerated(false);
  }, [open]);

  // Fetch products for labels
  const { data: productsData, isLoading } = trpc.catalog.products.list.useQuery(
    { limit: 1000, page: 1 },
    { enabled: open && productIds.length > 0 }
  );

  const selectedProducts: ProductForLabel[] = (productsData?.products || [])
    .filter((p: any) => productIds.includes(p.id))
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      article: p.article,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      subcategory: p.subcategory,
      priceMin: p.priceMin,
      dimensions: p.dimensions,
    }));

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("Не удалось открыть окно печати");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Штрихкоды</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .labels-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm;
            padding: 5mm;
          }
          @media print {
            @page { size: auto; margin: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="labels-grid">
          ${printRef.current.innerHTML}
        </div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent style={{ maxWidth: 700, maxHeight: "85vh", overflow: "auto" }}>
        <DialogHeader>
          <DialogTitle>Печать штрихкодов</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : selectedProducts.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", padding: 20 }}>Товары не выбраны</p>
        ) : !generated ? (
          /* ── Step 1: Product list + Generate button ── */
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 12 }}>
              <div>
                <Label>Копий каждой этикетки</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 80 }}
                />
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "#666" }}>
                Выбрано: {selectedProducts.length} товаров, итого {selectedProducts.length * copies} этикеток
              </div>
            </div>

            {/* Product list (lightweight, no barcode rendering) */}
            <div style={{
              maxHeight: 300,
              overflow: "auto",
              border: "1px solid #e5ddd5",
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9f6f3", borderBottom: "1px solid #e5ddd5" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#3D3530" }}>Артикул</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#3D3530" }}>Название</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#3D3530" }}>Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f0ebe6" }}>
                      <td style={{ padding: "6px 12px", fontFamily: "monospace", fontSize: 12, color: "#888" }}>{p.article}</td>
                      <td style={{ padding: "6px 12px", color: "#3D3530" }}>{p.name}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#3D3530" }}>
                        {p.priceMin ? `${parseFloat(p.priceMin).toLocaleString("ru-RU")} ₽` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={() => setGenerated(true)}
              style={{ background: "#C75D3C", width: "100%" }}
              size="lg"
            >
              <Barcode size={18} />
              Сгенерировать штрихкоды ({selectedProducts.length * copies} шт)
            </Button>
          </>
        ) : (
          /* ── Step 2: Barcode labels preview + Print ── */
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <Button variant="outline" size="sm" onClick={() => setGenerated(false)}>
                ← Назад
              </Button>
              <div style={{ flex: 1, fontSize: 13, color: "#666" }}>
                {selectedProducts.length} товаров × {copies} = {selectedProducts.length * copies} этикеток
              </div>
              <Button onClick={handlePrint} style={{ background: "#C75D3C" }}>
                <Printer size={16} />
                Печать
              </Button>
            </div>

            {/* Barcode labels preview */}
            <div
              ref={printRef}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "3mm",
                padding: 8,
                background: "#f9f9f9",
                borderRadius: 8,
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              {selectedProducts.flatMap((product) => {
                const barcodeVal = product.barcode || product.sku || product.article;
                return Array.from({ length: copies }, (_, i) => (
                  <BarcodeLabel
                    key={`${product.id}-${i}`}
                    barcode={barcodeVal}
                    sku={product.sku}
                    name={product.name}
                    category={product.category}
                    subcategory={product.subcategory}
                    priceMin={product.priceMin}
                    dimensions={product.dimensions}
                  />
                ));
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
