export interface PortalQuotationItem {
  id: string;
  item_id: string;
  qty: string;
  uom: string;
  rate: string;
  line_subtotal: string;
  line_tax: string;
  line_total: string;
}

export interface PortalQuotation {
  id: string;
  number: string;
  status: string;
  quote_date: string;
  valid_until: string | null;
  subtotal: string;
  tax_total: string;
  total: string;
  items: PortalQuotationItem[];
}

export interface PortalSalesOrderItem {
  id: string;
  item_id: string;
  qty: string;
  uom: string;
  rate: string;
  line_total: string;
  qty_dispatched: string;
}

export interface PortalSalesOrder {
  id: string;
  number: string;
  status: string;
  order_date: string;
  subtotal: string;
  tax_total: string;
  total: string;
  items: PortalSalesOrderItem[];
}

export interface PortalInvoiceItem {
  id: string;
  item_id: string;
  qty: string;
  uom: string;
  rate: string;
  taxable_value: string;
  line_total: string;
}

export interface PortalInvoice {
  id: string;
  number: string;
  invoice_date: string;
  subtotal: string;
  tax_total: string;
  total: string;
  status: string;
  items: PortalInvoiceItem[];
}

export interface PortalDeliveryChallan {
  id: string;
  number: string;
  sales_order_id: string;
  dispatch_date: string;
  status: string;
  trip_id: string | null;
}

export interface PortalStatementLine {
  entry_date: string;
  doc_type: string;
  doc_number: string;
  debit: string;
  credit: string;
  balance: string;
}
