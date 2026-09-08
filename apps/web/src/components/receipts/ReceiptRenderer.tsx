import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { DOCUMENT_TYPE_LABELS, type ReceiptData } from "@/lib/receipts";

interface ReceiptRendererProps {
  data: ReceiptData;
  paperWidthMm: number;
}

function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** ADR-016's rendering engine -- the ONE place any MaterialOS document
 * (POS sale, GST invoice, payment receipt, estimate, delivery note,
 * credit note) becomes a physical receipt layout. Every caller
 * (PosPage, InvoiceDetailPage, ...) renders this same component fed
 * by the same GET /receipts/{type}/{id} shape -- never a second,
 * module-specific receipt layout.
 *
 * Monospace, high-contrast, no color: a thermal printer's own
 * resolution and the fact that most run out of a black-only ribbon/
 * thermal head make anything else unreadable in practice, so this
 * doesn't offer a "themed" receipt option at all.
 */
export function ReceiptRenderer({ data, paperWidthMm }: ReceiptRendererProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const settings = data.settings;
  const showGst = settings.show_gst_breakdown;
  const hasGst = Number(data.cgst_amount) > 0 || Number(data.sgst_amount) > 0 || Number(data.igst_amount) > 0;

  useEffect(() => {
    if (!settings.show_qr_code || !settings.upi_id) {
      setQrDataUrl(null);
      return;
    }
    const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(data.company_name)}&am=${encodeURIComponent(data.grand_total)}&cu=INR&tn=${encodeURIComponent(data.document_number)}`;
    QRCode.toDataURL(upiUrl, { margin: 0, width: 160, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [settings.show_qr_code, settings.upi_id, data.company_name, data.grand_total, data.document_number]);

  // Narrower columns on 58mm -- SKU/tax columns are the first to go
  // rather than truncating the item name into illegibility.
  const compact = paperWidthMm <= 58;

  return (
    <div
      className="receipt-root bg-white text-black"
      style={{ width: `${paperWidthMm}mm`, fontFamily: "'Courier New', Courier, monospace", fontSize: compact ? "10px" : "11px", lineHeight: 1.35, padding: "3mm" }}
    >
      {settings.show_logo && (
        <div className="flex justify-center pb-1">
          <img src="/brand/symbol.png" alt="" style={{ height: "28px", width: "28px", filter: "grayscale(1) contrast(1.2)" }} />
        </div>
      )}

      <div className="text-center font-bold" style={{ fontSize: compact ? "12px" : "13px" }}>{data.company_name}</div>
      {data.company_address && <div className="text-center">{data.company_address}</div>}
      <div className="text-center">
        {[data.company_phone && `Ph: ${data.company_phone}`, data.company_email].filter(Boolean).join(" | ")}
      </div>
      {data.company_gstin && <div className="text-center">GSTIN: {data.company_gstin}</div>}
      {data.branch_name && <div className="text-center">{data.branch_name}</div>}

      <div className="my-1 border-t border-dashed border-black" />

      <div className="text-center font-bold" style={{ fontSize: compact ? "11px" : "12px" }}>{DOCUMENT_TYPE_LABELS[data.document_type]}</div>
      <div className="flex justify-between">
        <span>No: {data.document_number}</span>
        <span>{data.document_date}{data.document_time ? ` ${data.document_time}` : ""}</span>
      </div>
      {settings.show_cashier && data.cashier_name && <div>Cashier: {data.cashier_name}</div>}

      {settings.show_customer_details && (data.customer_name || data.customer_phone) && (
        <>
          <div className="my-1 border-t border-dashed border-black" />
          {data.customer_name && <div>Customer: {truncate(data.customer_name, compact ? 22 : 34)}</div>}
          {data.customer_phone && <div>Phone: {data.customer_phone}</div>}
          {data.customer_gstin && <div>GSTIN: {data.customer_gstin}</div>}
          {data.place_of_supply && <div>Place of supply: {data.place_of_supply}</div>}
        </>
      )}

      <div className="my-1 border-t border-solid border-black" />

      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr className="border-b border-dashed border-black text-left">
            <th className="py-0.5 pr-1">Item</th>
            <th className="py-0.5 pr-1 text-right">Qty</th>
            <th className="py-0.5 pr-1 text-right">Rate</th>
            <th className="py-0.5 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-1">
                {truncate(item.name, compact ? 16 : 24)}
                {settings.show_sku && item.sku && <span className="block text-[9px] text-gray-600">{item.sku}</span>}
              </td>
              <td className="py-0.5 pr-1 text-right">{Number(item.qty)}{!compact && ` ${item.uom}`}</td>
              <td className="py-0.5 pr-1 text-right">{formatAmount(item.rate)}</td>
              <td className="py-0.5 text-right">{formatAmount(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-1 border-t border-dashed border-black" />

      <div className="flex justify-between"><span>Subtotal</span><span>{formatAmount(data.subtotal)}</span></div>
      {Number(data.total_discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatAmount(data.total_discount)}</span></div>}
      {showGst && hasGst && (
        <>
          {Number(data.cgst_amount) > 0 && <div className="flex justify-between"><span>CGST</span><span>{formatAmount(data.cgst_amount)}</span></div>}
          {Number(data.sgst_amount) > 0 && <div className="flex justify-between"><span>SGST</span><span>{formatAmount(data.sgst_amount)}</span></div>}
          {Number(data.igst_amount) > 0 && <div className="flex justify-between"><span>IGST</span><span>{formatAmount(data.igst_amount)}</span></div>}
        </>
      )}
      {Number(data.round_off) !== 0 && <div className="flex justify-between"><span>Round off</span><span>{formatAmount(data.round_off)}</span></div>}

      <div className="my-1 border-t border-solid border-black" />
      <div className="flex justify-between font-bold" style={{ fontSize: compact ? "12px" : "13px" }}>
        <span>TOTAL</span><span>₹{formatAmount(data.grand_total)}</span>
      </div>
      <div className="my-1 border-t border-solid border-black" />

      {data.payment_method && <div className="flex justify-between"><span>Paid via</span><span>{data.payment_method}</span></div>}
      {data.amount_paid !== null && <div className="flex justify-between"><span>Amount paid</span><span>{formatAmount(data.amount_paid)}</span></div>}
      {data.change_due !== null && Number(data.change_due) > 0 && <div className="flex justify-between font-bold"><span>Change</span><span>{formatAmount(data.change_due)}</span></div>}
      {data.balance_due !== null && Number(data.balance_due) > 0 && <div className="flex justify-between"><span>A/c balance due</span><span>{formatAmount(data.balance_due)}</span></div>}

      {data.notes && (
        <>
          <div className="my-1 border-t border-dashed border-black" />
          <div>{data.notes}</div>
        </>
      )}

      {qrDataUrl && (
        <div className="mt-2 flex flex-col items-center">
          <img src={qrDataUrl} alt="UPI QR" style={{ width: "100px", height: "100px" }} />
          <span className="text-[9px]">Scan to pay via UPI</span>
        </div>
      )}

      {(settings.footer_message || settings.terms_and_conditions || settings.return_policy || settings.social_contact_info) && (
        <div className="mt-2 border-t border-dashed border-black pt-1 text-center" style={{ fontSize: "9px" }}>
          {settings.footer_message && <div className="font-medium">{settings.footer_message}</div>}
          {settings.terms_and_conditions && <div className="mt-0.5">{settings.terms_and_conditions}</div>}
          {settings.return_policy && <div className="mt-0.5">{settings.return_policy}</div>}
          {settings.social_contact_info && <div className="mt-0.5">{settings.social_contact_info}</div>}
        </div>
      )}
    </div>
  );
}
