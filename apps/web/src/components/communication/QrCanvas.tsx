import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCanvas({ value, size = 260, className = "" }: QrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1.5,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).catch((err) => {
      console.error("Failed to render QR Code:", err);
    });
  }, [value, size]);

  if (!value) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 text-xs text-zinc-500 ${className}`}
        style={{ width: size, height: size }}
      >
        Waiting for QR code...
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl bg-white p-3 shadow-xl ${className}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
