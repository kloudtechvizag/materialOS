import {
  Boxes, Briefcase, Building2, Car, Cpu, CreditCard, Factory, FlaskConical, Package, Pill,
  Printer, Receipt, Shirt, ShoppingCart, Smartphone, Sofa, Store, Truck, UtensilsCrossed, Wheat,
} from "lucide-react";

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export const FEATURE_ICONS: Record<string, IconComponent> = {
  "inventory-management": Package,
  "sales-quotation-management": Receipt,
  "credit-management": CreditCard,
  pos: CreditCard,
  "warehouse-dispatch-management": Truck,
  "serial-imei-rma-tracking": Smartphone,
  "gst-accounting-financial-reports": Receipt,
  "report-builder": Building2,
};

export const INDUSTRY_ICONS: Record<string, IconComponent> = {
  building_materials: Building2,
  retail: Store,
  pharmacy: Pill,
  printing_press: Printer,
  mobile: Smartphone,
};

export const CATEGORY_ICONS: Record<string, IconComponent> = {
  construction: Building2,
  retail: Store,
  healthcare: Pill,
  ecommerce: ShoppingCart,
  distribution: Truck,
  automotive: Car,
  food: UtensilsCrossed,
  chemical: FlaskConical,
  electronics: Cpu,
  furniture: Sofa,
  publishing: Briefcase,
  services: Briefcase,
  manufacturing: Factory,
  printing: Printer,
  fashion: Shirt,
  agriculture: Wheat,
};

export const DEFAULT_ICON = Boxes;
