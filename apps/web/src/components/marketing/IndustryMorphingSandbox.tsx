import { useState } from "react";
import {
  Building2,
  Pill,
  Printer,
  FlaskConical,
  GraduationCap,
  Gem,
  Car,
  Atom,
  ShoppingCart,
  Shirt,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  Boxes,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IndustryProfileData {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  terminology: {
    item: string;
    lot: string;
    customer: string;
    unit: string;
  };
  metrics: {
    label: string;
    value: string;
    change: string;
    status: "good" | "warning" | "neutral";
  }[];
  attentionAlert: {
    severity: "critical" | "warning" | "info";
    title: string;
    subtitle: string;
    action: string;
  };
  goldenWorkflow: string[];
  recentRows: {
    col1: string;
    col2: string;
    col3: string;
    col4: string;
    status: string;
  }[];
}

const INDUSTRY_PROFILES: IndustryProfileData[] = [
  {
    id: "building_materials",
    name: "Building Materials",
    category: "Construction & Steel",
    icon: Building2,
    tagline: "Cement, steel, TMT rebar, and aggregate supply rebalancing with weight & piece tracking.",
    terminology: { item: "Item (TMT / Cement)", lot: "Batch / Heat No.", customer: "Contractor", unit: "MT / BAG" },
    metrics: [
      { label: "TMT Bar Stock Value", value: "₹42.8 Lakh", change: "+₹3.4L today", status: "good" },
      { label: "Active Vehicle Dispatches", value: "8 In Transit", change: "4 pending POD", status: "neutral" },
      { label: "Dealer Outstanding", value: "₹14.2 Lakh", change: "₹2.1L due >30d", status: "warning" },
      { label: "Godown Capacity", value: "86% Utilized", change: "Visakhapatnam Godown", status: "good" },
    ],
    attentionAlert: {
      severity: "warning",
      title: "3 Delivery Challans Pending Driver Confirmation",
      subtitle: "Vehicles AP-31-TE-1049 & AP-39-U-2041 dispatched 4 hours ago without signed digital POD.",
      action: "Review Dispatches",
    },
    goldenWorkflow: ["Quotation", "Credit Check", "Sales Order", "Dispatch & E-Way Bill", "Tax Invoice", "Payment Collection"],
    recentRows: [
      { col1: "JSW Fe500D 12mm TMT", col2: "Heat #H-9402", col3: "12.50 MT", col4: "₹63,000 / MT", status: "Dispatched" },
      { col1: "UltraTech OPC 53 Grade", col2: "Batch #UT-88", col3: "450 Bags", col4: "₹385 / Bag", status: "Delivered" },
      { col1: "Tata Tiscon 16mm Rebar", col2: "Heat #TT-312", col3: "8.20 MT", col4: "₹65,200 / MT", status: "In Transit" },
    ],
  },
  {
    id: "pharmacy",
    name: "Pharmacy & Healthcare",
    category: "Pharma Retail & Wholesale",
    icon: Pill,
    tagline: "Strict FEFO lot dispensing, automated drug expiry quarantine, and Schedule H/H1 registers.",
    terminology: { item: "Medicine / Formulation", lot: "Batch & Exp. Date", customer: "Patient / Clinic", unit: "STRIP / VIAL" },
    metrics: [
      { label: "Active FEFO Batches", value: "1,248 Batches", change: "100% Barcoded", status: "good" },
      { label: "Expiring within 30 Days", value: "4 Batches", change: "₹18,400 at risk", status: "warning" },
      { label: "Schedule H1 Dispensed", value: "62 Prescriptions", change: "Audit log verified", status: "good" },
      { label: "Today's Counter Footfall", value: "184 Walk-ins", change: "+14% vs avg", status: "good" },
    ],
    attentionAlert: {
      severity: "critical",
      title: "2 Batches Crossing Expiry Window",
      subtitle: "Amoxicillin Clavulanate 625mg (Batch #AMX-091) expires in 12 days. Auto-return triggered.",
      action: "Initiate Vendor Return",
    },
    goldenWorkflow: ["Purchase Inward (FEFO)", "Batch Expiry Tagging", "Rx Verification", "POS Billing", "Schedule H1 Register"],
    recentRows: [
      { col1: "Augmentin 625 Duo Tablet", col2: "B# AG-2024 / Exp 10/26", col3: "12 Strips", col4: "₹204.50", status: "Dispensed" },
      { col1: "Pantocid DSR Capsule", col2: "B# PN-4491 / Exp 04/27", col3: "25 Strips", col4: "₹189.00", status: "In Stock" },
      { col1: "Azithral 500mg Tablet", col2: "B# AZ-1082 / Exp 08/26", col3: "8 Strips", col4: "₹119.20", status: "Dispensed" },
    ],
  },
  {
    id: "printing_press",
    name: "Printing Press & Digital Lab",
    category: "Commercial Print & Packaging",
    icon: Printer,
    tagline: "13-stage pressroom Kanban scheduling, substrate tracking, and ink charge-rate recovery.",
    terminology: { item: "Print Product", lot: "Job Run / Plate ID", customer: "Agency / Publisher", unit: "SHEETS / IMP" },
    metrics: [
      { label: "Pressroom Utilization", value: "91.4% OEE", change: "Heidelberg 4-Color", status: "good" },
      { label: "Prepress Proofs Pending", value: "6 Jobs", change: "Awaiting approval", status: "warning" },
      { label: "Paper Ream Inventory", value: "420 Reams", change: "300 GSM Art Board", status: "good" },
      { label: "Active Print Queue", value: "14 Jobs Running", change: "Due today: 8", status: "good" },
    ],
    attentionAlert: {
      severity: "warning",
      title: "High Ink Coverage Job Awaiting Client Signoff",
      subtitle: "Brochure Run #JOB-4089 for Zenith Agency requires UV coating approval before plate mounting.",
      action: "Open Proof Viewer",
    },
    goldenWorkflow: ["Job Estimation", "Prepress Proofing", "Plate Making", "Press Run", "Finishing & Die-cut", "Dispatch"],
    recentRows: [
      { col1: "Annual Report 2026 (Booklet)", col2: "Run #JOB-8821", col3: "2,500 Pcs", col4: "₹48.00 / Pc", status: "In Press" },
      { col1: "Matte Foil Medicine Cartons", col2: "Run #JOB-8834", col3: "20,000 Pcs", col4: "₹4.20 / Pc", status: "Die-Cutting" },
      { col1: "Hardbound Menu Cards (Gloss)", col2: "Run #JOB-8840", col3: "150 Pcs", col4: "₹240.00 / Pc", status: "Binding" },
    ],
  },
  {
    id: "laboratory",
    name: "Laboratory & LIMS",
    category: "Scientific & Clinical Testing",
    icon: FlaskConical,
    tagline: "Sample accessioning, analyte test worksheets, instrument calibration, and NABL-grade reporting.",
    terminology: { item: "Test Panel / Parameter", lot: "Sample Barcode", customer: "Referring Physician", unit: "TEST / RUN" },
    metrics: [
      { label: "Samples Accessioned", value: "312 Samples", change: "Today's intake", status: "good" },
      { label: "Turnaround Time (TAT)", value: "3.2 Hours Avg", change: "-22 min vs SLA", status: "good" },
      { label: "QC Verification Queue", value: "9 Worksheets", change: "3 STAT Priority", status: "warning" },
      { label: "NABL Instrument Health", value: "100% Calibrated", change: "Roche Cobas 6000", status: "good" },
    ],
    attentionAlert: {
      severity: "critical",
      title: "2 STAT Samples Approaching SLA Threshold",
      subtitle: "Cardiac Troponin I samples from Apollo Emergency exceed 45min processing turnaround.",
      action: "Expedite Worksheet",
    },
    goldenWorkflow: ["Accessioning", "Barcode Affixing", "Bench Testing", "Automated Instrument Sync", "Pathologist Signoff"],
    recentRows: [
      { col1: "Complete Blood Count (CBC)", col2: "Sample #SMP-9102", col3: "Sysmex XN-550", col4: "₹350.00", status: "Verified" },
      { col1: "Lipid Profile + HbA1c", col2: "Sample #SMP-9105", col3: "Cobas c311", col4: "₹1,200.00", status: "Testing" },
      { col1: "Thyroid Stimulating Hormone", col2: "Sample #SMP-9118", col3: "Abbott Architect", col4: "₹450.00", status: "Published" },
    ],
  },
  {
    id: "school_erp",
    name: "School & Academy ERP",
    category: "K-12 & Higher Education",
    icon: GraduationCap,
    tagline: "Automated student admission pipeline, fee term installment schedules, and attendance alerts.",
    terminology: { item: "Course / Grade", lot: "Academic Batch / Section", customer: "Guardian / Student", unit: "TERM / SEAT" },
    metrics: [
      { label: "Total Enrolled Students", value: "1,420 Active", change: "Across 42 Sections", status: "good" },
      { label: "Term 2 Fee Collections", value: "₹42.80 Lakh", change: "88.4% realized", status: "good" },
      { label: "Defaulter / Overdue Fees", value: "₹5.60 Lakh", change: "24 accounts flagged", status: "warning" },
      { label: "Daily Student Attendance", value: "96.2% Present", change: "Real-time RFID sync", status: "good" },
    ],
    attentionAlert: {
      severity: "warning",
      title: "18 Admission Enquiries Awaiting Counselor Follow-up",
      subtitle: "New admissions cycle Grade 11 Science enquiries received over 48 hours without contact log.",
      action: "Open Admissions CRM",
    },
    goldenWorkflow: ["Enquiry Lead", "Document Verification", "Fee Invoicing", "Section Allotment", "Parent Portal Access"],
    recentRows: [
      { col1: "Grade 10 - Section A Tuition", col2: "Roll #1024 / Term 2", col3: "Quarterly Installment", col4: "₹24,500.00", status: "Paid" },
      { col1: "Grade 8 - Section B Tuition", col2: "Roll #0812 / Term 2", col3: "Quarterly Installment", col4: "₹21,000.00", status: "Overdue" },
      { col1: "School Bus Transport Route #4", col2: "Pass #TR-402", col3: "Monthly Pass", col4: "₹3,200.00", status: "Active" },
    ],
  },
  {
    id: "jewellery",
    name: "Jewellery & Bullion",
    category: "Retail & Manufacturing",
    icon: Gem,
    tagline: "Gold rate ticker, purity hallmark (BIS 916), stone weight deduction, and old gold exchange.",
    terminology: { item: "Jewellery Piece", lot: "Hallmark / Tag ID", customer: "Retail Customer", unit: "GRAM / CT" },
    metrics: [
      { label: "22K Gold Base Rate", value: "₹6,840 / g", change: "Updated 09:30 AM", status: "good" },
      { label: "Vault Gross Weight", value: "4,210.50 g", change: "Net purity verified", status: "good" },
      { label: "Old Gold Exchange Stock", value: "348.20 g", change: "Awaiting melting test", status: "neutral" },
      { label: "BIS Hallmarking Pending", value: "14 Ornaments", change: "Consigned to center", status: "warning" },
    ],
    attentionAlert: {
      severity: "info",
      title: "Daily Bullion Market Rate Update Available",
      subtitle: "MCX Spot Gold surged +₹42/g. Automatic item catalog repricing is ready to apply.",
      action: "Sync Daily Rates",
    },
    goldenWorkflow: ["Bullion Inward", "Karat Testing", "Barcoded Tagging", "Making Charge Calculation", "BIS Hallmarked Sale"],
    recentRows: [
      { col1: "22K Antique Choker Necklace", col2: "Tag #JW-9901 / BIS916", col3: "48.25 g Net", col4: "₹3,62,400.00", status: "In Showcase" },
      { col1: "18K Diamond Solitaire Ring", col2: "Tag #JW-9914 / VVS-EF", col3: "3.40 g (0.75ct)", col4: "₹92,000.00", status: "Billed" },
      { col1: "22K Traditional Bangles (Pair)", col2: "Tag #JW-9922 / BIS916", col3: "32.10 g Net", col4: "₹2,38,200.00", status: "Reserved" },
    ],
  },
];

export function IndustryMorphingSandbox() {
  const [activeProfile, setActiveProfile] = useState<IndustryProfileData>(INDUSTRY_PROFILES[0]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "action_center" | "transactions">("dashboard");

  return (
    <section id="demo-sandbox" className="relative bg-[#070B14] py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            <Sparkles className="h-3 w-3" />
            <span>Interactive Industry Sandbox</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Configured for the way your business{" "}
            <span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
              actually operates.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400 sm:text-lg">
            Click any industry below. Watch MaterialOS immediately adapt its terminology, golden workflow, attention triggers,
            and compliance rules in real-time.
          </p>
        </div>

        {/* Industry Selector Strip */}
        <div className="mt-10 flex gap-2.5 overflow-x-auto pb-4 pt-2 no-scrollbar sm:justify-center">
          {INDUSTRY_PROFILES.map((profile) => {
            const Icon = profile.icon;
            const isSelected = activeProfile.id === profile.id;
            return (
              <button
                key={profile.id}
                onClick={() => setActiveProfile(profile)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all duration-200",
                  isSelected
                    ? "border-violet-500 bg-violet-600/20 text-white shadow-[0_0_20px_-3px_rgba(124,58,237,0.5)] scale-[1.03]"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
                )}
              >
                <Icon className={cn("h-4 w-4", isSelected ? "text-violet-400" : "text-zinc-500")} />
                <span>{profile.name}</span>
              </button>
            );
          })}
        </div>

        {/* Live Mock Screen Container */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F19] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
          {/* Simulated Browser Bar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0E1322] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-xs text-zinc-400">
                app.materialos.internal/{activeProfile.id}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all",
                    activeTab === "dashboard" ? "bg-violet-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("action_center")}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all",
                    activeTab === "action_center" ? "bg-violet-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Attention Center
                </button>
                <button
                  onClick={() => setActiveTab("transactions")}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all",
                    activeTab === "transactions" ? "bg-violet-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Work Records
                </button>
              </div>
            </div>
          </div>

          {/* Morphing Content Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header with Active Profile Context */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-400 uppercase tracking-wider">
                  <Activity className="h-3.5 w-3.5" />
                  <span>{activeProfile.category} Engine</span>
                </div>
                <h3 className="mt-1 text-2xl font-bold text-white">{activeProfile.name} Workspace</h3>
                <p className="mt-0.5 text-xs text-zinc-400">{activeProfile.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 font-mono">
                  Primary Unit: <strong className="text-white">{activeProfile.terminology.unit}</strong>
                </span>
                <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 font-mono">
                  Traceability: <strong className="text-white">{activeProfile.terminology.lot}</strong>
                </span>
              </div>
            </div>

            {/* TAB 1: METRICS & WORKFLOW */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* MetricStrip Showcase */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {activeProfile.metrics.map((metric, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-violet-500/30 hover:bg-white/[0.05]"
                    >
                      <p className="text-xs font-medium text-zinc-400">{metric.label}</p>
                      <p className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{metric.value}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                        {metric.status === "good" ? (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <TrendingUp className="h-3 w-3" /> {metric.change}
                          </span>
                        ) : metric.status === "warning" ? (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> {metric.change}
                          </span>
                        ) : (
                          <span>{metric.change}</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Golden Workflow Interactive Track */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-violet-400" />
                      Standard {activeProfile.name} Golden Workflow
                    </span>
                    <span className="text-[11px] text-zinc-500">Auto-validates prerequisites at every step</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {activeProfile.goldenWorkflow.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                        {idx < activeProfile.goldenWorkflow.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ATTENTION CENTER */}
            {activeTab === "action_center" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 mt-0.5">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 uppercase">
                          {activeProfile.attentionAlert.severity} Attention Required
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-white">
                        {activeProfile.attentionAlert.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {activeProfile.attentionAlert.subtitle}
                      </p>
                    </div>
                  </div>
                  <button className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-400 transition-colors">
                    {activeProfile.attentionAlert.action}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-400">
                    <span className="font-semibold text-white block mb-1">Automated Anomaly Detection</span>
                    Monitors standard deviations in customer payment turnaround and warns before credit limit breach.
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-400">
                    <span className="font-semibold text-white block mb-1">Smart Notification Engine</span>
                    Sends direct WhatsApp & SMS alerts to branch supervisors when critical exceptions trigger.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: WORK RECORDS TABLE */}
            {activeTab === "transactions" && (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] animate-in fade-in duration-300">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.04] text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">{activeProfile.terminology.item}</th>
                      <th className="px-4 py-3 font-medium">{activeProfile.terminology.lot}</th>
                      <th className="px-4 py-3 font-medium">Quantity</th>
                      <th className="px-4 py-3 font-medium">Rate / Unit</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {activeProfile.recentRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{row.col1}</td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{row.col2}</td>
                        <td className="px-4 py-3">{row.col3}</td>
                        <td className="px-4 py-3 font-medium text-white">{row.col4}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            <FileCheck2 className="h-3 w-3" /> {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
