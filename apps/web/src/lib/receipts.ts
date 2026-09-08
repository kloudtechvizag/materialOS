import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

export interface ReceiptSettings {
  show_logo: boolean;
  show_customer_details: boolean;
  show_gst_breakdown: boolean;
  show_sku: boolean;
  show_cashier: boolean;
  show_qr_code: boolean;
  footer_message: string | null;
  terms_and_conditions: string | null;
  return_policy: string | null;
  upi_id: string | null;
  social_contact_info: string | null;
  default_paper_width_mm: number;
}

export interface ReceiptLineItem {
  name: string;
  sku: string | null;
  qty: string;
  uom: string;
  rate: string;
  discount: string;
  tax_rate: string;
  line_total: string;
}

export type ReceiptDocumentType = "invoice" | "pos_receipt" | "payment_receipt" | "estimate" | "delivery_receipt" | "credit_note";

export interface ReceiptData {
  document_type: ReceiptDocumentType;
  document_number: string;
  document_date: string;
  document_time: string | null;

  company_name: string;
  company_legal_name: string;
  company_gstin: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;

  branch_name: string;
  branch_gstin: string | null;

  cashier_name: string | null;

  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  place_of_supply: string | null;

  items: ReceiptLineItem[];

  subtotal: string;
  total_discount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  round_off: string;
  grand_total: string;

  payment_method: string | null;
  amount_paid: string | null;
  balance_due: string | null;
  change_due: string | null;
  customer_credit_balance: string | null;

  notes: string | null;
  settings: ReceiptSettings;
}

export const DOCUMENT_TYPE_LABELS: Record<ReceiptDocumentType, string> = {
  invoice: "Tax Invoice",
  pos_receipt: "Receipt",
  payment_receipt: "Payment Receipt",
  estimate: "Estimate",
  delivery_receipt: "Delivery Note",
  credit_note: "Credit Note",
};

export function useReceiptData(documentType: ReceiptDocumentType | null, documentId: string | null) {
  return useQuery({
    queryKey: ["receipt", documentType, documentId],
    queryFn: () => apiFetch<ReceiptData>(`/receipts/${documentType}/${documentId}`),
    enabled: !!documentType && !!documentId,
  });
}
