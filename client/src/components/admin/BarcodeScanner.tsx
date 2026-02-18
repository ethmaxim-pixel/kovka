import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !scannerRef.current) return;

        const scannerId = "barcode-scanner-region";
        scannerRef.current.id = scannerId;

        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            if (hasScanned.current) return;
            hasScanned.current = true;

            // Вибро feedback
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }

            onScan(decodedText);
          },
          () => {} // ignore scan failures
        );
      } catch (err: any) {
        if (mounted) {
          console.error("Scanner error:", err);
          if (err?.toString?.().includes("NotAllowedError")) {
            setError("Доступ к камере запрещён. Разрешите доступ в настройках браузера.");
          } else if (err?.toString?.().includes("NotFoundError")) {
            setError("Камера не найдена на этом устройстве.");
          } else {
            setError("Не удалось запустить камеру. Попробуйте ещё раз.");
          }
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Сканер штрихкода</span>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {error ? (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>{error}</p>
            <button style={styles.retryBtn} onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div ref={scannerRef} style={styles.scannerArea} />
            <p style={styles.hint}>Наведите камеру на штрихкод товара</p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.85)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  container: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #eee",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: "#3D3530",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#888",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },
  scannerArea: {
    width: "100%",
    minHeight: 300,
  },
  hint: {
    textAlign: "center" as const,
    padding: "12px 16px",
    fontSize: 14,
    color: "#888",
    margin: 0,
  },
  errorContainer: {
    padding: 32,
    textAlign: "center" as const,
  },
  errorText: {
    color: "#C75D3C",
    fontSize: 14,
    marginBottom: 16,
  },
  retryBtn: {
    background: "#C75D3C",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    cursor: "pointer",
  },
};
