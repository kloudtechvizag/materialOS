import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IndianRupee } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface AcademicYear { id: string; name: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface FeeHead { id: string; name: string; code: string; }
interface FeeStructureItem { id: string; academic_year_id: string; school_class_id: string; fee_head_id: string; amount: string; due_date: string; }
interface Branch { id: string; name: string; }
interface FeeInvoiceOut { id: string; student_id: string; invoice_number: string; total: string; }

/** Fee Management (spec sec16/17): fee heads are real, GST-correct
 * invoiceable Items under the hood; generating invoices creates real
 * core Invoices billed to each student's primary guardian (as a
 * Customer), collectible via the existing /receipts endpoint. */
export function FeesPage() {
  const queryClient = useQueryClient();
  const [headForm, setHeadForm] = useState({ name: "", code: "" });
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [structureForm, setStructureForm] = useState({ school_class_id: "", fee_head_id: "", amount: "", due_date: "" });
  const [genClassId, setGenClassId] = useState<string | null>(null);
  const [genBranchId, setGenBranchId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [genResult, setGenResult] = useState<{ created: FeeInvoiceOut[]; skipped_student_ids: string[] } | null>(null);

  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const activeYearId = academicYearId ?? years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;
  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: feeHeads } = useQuery({ queryKey: ["fee-heads"], queryFn: () => apiFetch<FeeHead[]>("/fee-heads") });
  const { data: structureItems, refetch: refetchStructure } = useQuery({
    queryKey: ["fee-structure-items", activeYearId],
    queryFn: () => apiFetch<FeeStructureItem[]>(`/fee-structure-items?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });

  const classById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const feeHeadById = new Map((feeHeads ?? []).map((f) => [f.id, f]));

  const createHead = useMutation({
    mutationFn: () => apiFetch("/fee-heads", { method: "POST", body: headForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-heads"] });
      setHeadForm({ name: "", code: "" });
    },
  });

  const createStructureItem = useMutation({
    mutationFn: () => apiFetch("/fee-structure-items", { method: "POST", body: { ...structureForm, academic_year_id: activeYearId } }),
    onSuccess: () => {
      refetchStructure();
      setStructureForm({ school_class_id: "", fee_head_id: "", amount: "", due_date: "" });
    },
  });

  const genClassItems = (structureItems ?? []).filter((i) => i.school_class_id === genClassId);

  const generate = useMutation({
    mutationFn: () =>
      apiFetch<{ created: FeeInvoiceOut[]; skipped_student_ids: string[] }>("/fee-invoices/generate", {
        method: "POST",
        body: { school_class_id: genClassId, branch_id: genBranchId, fee_structure_item_ids: Array.from(selectedItemIds) },
      }),
    onSuccess: (result) => setGenResult(result),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fees</h1>
        <p className="text-sm text-muted-foreground">Fee heads, per-class fee structure, and invoice generation.</p>
      </div>

      <select className="flex h-9 w-56 rounded-md border border-input bg-background px-2 text-sm" value={activeYearId ?? ""} onChange={(e) => setAcademicYearId(e.target.value)}>
        {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
      </select>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Fee heads</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {feeHeads?.map((f) => <li key={f.id}>{f.name} <span className="text-xs">({f.code})</span></li>)}
            {feeHeads?.length === 0 && <li>No fee heads yet.</li>}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Name, e.g. Tuition Fee" value={headForm.name} onChange={(e) => setHeadForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Code" value={headForm.code} onChange={(e) => setHeadForm((f) => ({ ...f, code: e.target.value }))} className="w-28" />
            <Button size="sm" onClick={() => createHead.mutate()} disabled={!headForm.name || !headForm.code || createHead.isPending}>Add</Button>
          </div>
          {createHead.error instanceof ApiError && <p className="text-xs text-destructive">{createHead.error.message}</p>}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Fee structure</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {structureItems?.map((i) => (
              <li key={i.id}>{classById.get(i.school_class_id) ?? "-"} — {feeHeadById.get(i.fee_head_id)?.name ?? "-"}: ₹{i.amount} (due {i.due_date})</li>
            ))}
            {structureItems?.length === 0 && <li>No fee structure defined yet.</li>}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={structureForm.school_class_id} onChange={(e) => setStructureForm((f) => ({ ...f, school_class_id: e.target.value }))}>
              <option value="">Class...</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={structureForm.fee_head_id} onChange={(e) => setStructureForm((f) => ({ ...f, fee_head_id: e.target.value }))}>
              <option value="">Fee head...</option>
              {feeHeads?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Input type="number" placeholder="Amount" value={structureForm.amount} onChange={(e) => setStructureForm((f) => ({ ...f, amount: e.target.value }))} className="w-28" />
            <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={structureForm.due_date} onChange={(e) => setStructureForm((f) => ({ ...f, due_date: e.target.value }))} />
            <Button size="sm" onClick={() => createStructureItem.mutate()} disabled={!structureForm.school_class_id || !structureForm.fee_head_id || !structureForm.amount || !structureForm.due_date || createStructureItem.isPending}>Add</Button>
          </div>
          {createStructureItem.error instanceof ApiError && <p className="text-xs text-destructive">{createStructureItem.error.message}</p>}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Generate fee invoices</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={genClassId ?? ""} onChange={(e) => { setGenClassId(e.target.value); setSelectedItemIds(new Set()); setGenResult(null); }}>
            <option value="">Class...</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={genBranchId ?? ""} onChange={(e) => setGenBranchId(e.target.value)}>
            <option value="">Branch...</option>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {genClassId && genClassItems.length === 0 && <p className="text-sm text-muted-foreground">No fee structure defined for this class yet.</p>}
        {genClassId && genClassItems.length > 0 && (
          <div className="space-y-1.5">
            {genClassItems.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedItemIds.has(i.id)}
                  onChange={(e) => setSelectedItemIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(i.id); else next.delete(i.id); return next; })}
                />
                {feeHeadById.get(i.fee_head_id)?.name ?? "-"} — ₹{i.amount} (due {i.due_date})
              </label>
            ))}
          </div>
        )}

        {generate.error instanceof ApiError && <p className="text-sm text-destructive">{generate.error.message}</p>}
        <Button onClick={() => generate.mutate()} disabled={!genClassId || !genBranchId || selectedItemIds.size === 0 || generate.isPending}>
          {generate.isPending ? "Generating..." : "Generate invoices"}
        </Button>

        {genResult && (
          <div className="space-y-1 pt-2 text-sm">
            <p className="text-emerald-600">{genResult.created.length} invoice{genResult.created.length === 1 ? "" : "s"} generated.</p>
            {genResult.skipped_student_ids.length > 0 && (
              <p className="text-muted-foreground">{genResult.skipped_student_ids.length} student{genResult.skipped_student_ids.length === 1 ? "" : "s"} already billed for the selected fees -- skipped.</p>
            )}
          </div>
        )}
      </div>

      {feeHeads?.length === 0 && structureItems?.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <IndianRupee className="h-4 w-4" />
          <span>Start by adding a fee head, then a fee structure item for a class.</span>
        </div>
      )}
    </div>
  );
}
