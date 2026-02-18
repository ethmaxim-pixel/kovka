import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  barcode: string;
  sku: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  priceMin: string | null;
  dimensions: string | null;
}

export function BarcodeLabel({ barcode, sku, name, category, subcategory, priceMin, dimensions }: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: "CODE128",
          width: 1.5,
          height: 35,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // fallback for invalid barcode
      }
    }
  }, [barcode]);

  const price = priceMin ? parseFloat(priceMin) : null;
  const categoryLine = [category, subcategory].filter(Boolean).join(" / ");

  return (
    <div style={{
      width: "60mm",
      height: "60mm",
      padding: "2.5mm",
      border: "1px solid #ccc",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      fontFamily: "Arial, sans-serif",
      fontSize: "8px",
      boxSizing: "border-box",
      pageBreakInside: "avoid",
      overflow: "hidden",
    }}>
      {/* Name */}
      <div style={{
        fontWeight: 700,
        fontSize: "11px",
        textAlign: "center",
        lineHeight: 1.2,
        maxHeight: "28px",
        overflow: "hidden",
      }}>
        {name}
      </div>

      {/* Category + subcategory */}
      <div style={{
        fontSize: "7px",
        color: "#666",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {categoryLine}
      </div>

      {/* Barcode SVG */}
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <svg ref={svgRef} style={{ width: "100%", maxHeight: "20mm" }} />
      </div>

      {/* SKU under barcode */}
      <div style={{
        textAlign: "center",
        fontFamily: "monospace",
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.5px",
      }}>
        {sku || barcode}
      </div>

      {/* Bottom row: price + dimensions */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid #ddd",
        paddingTop: "1mm",
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700, fontSize: "13px" }}>
            {price ? `${price.toLocaleString("ru-RU")} ₽` : "—"}
          </span>
          {price && <span style={{ fontSize: "6px", color: "#888" }}>цена за 1 шт</span>}
        </div>
        {dimensions && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: "8px", color: "#444", fontWeight: 500 }}>
              {dimensions}
            </span>
            <span style={{ fontSize: "6px", color: "#888" }}>размер изделия</span>
          </div>
        )}
      </div>
    </div>
  );
}
