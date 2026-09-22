import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface Book { id: string; title: string; author: string | null; isbn: string | null; }
interface Copy { id: string; book_id: string; branch_id: string; accession_number: string; status: string; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Student { id: string; first_name: string; last_name: string; }
interface Issue { id: string; book_title: string; accession_number: string; student_id: string; due_date: string; is_overdue: boolean; }
interface Branch { id: string; name: string; }

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Library (spec sec19): a real book catalog, individually-tracked
 * physical copies, and issue/return circulation with fines. */
export function LibraryPage() {
  const queryClient = useQueryClient();
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "" });
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [accessionNumber, setAccessionNumber] = useState("");
  const [copyBranchId, setCopyBranchId] = useState("");
  const [issueForm, setIssueForm] = useState({ branch_id: "", school_class_id: "", section_id: "", student_id: "", copy_id: "", due_date: addDaysISO(14) });
  const [returnFine, setReturnFine] = useState<Record<string, string>>({});

  const { data: books } = useQuery({ queryKey: ["library-books"], queryFn: () => apiFetch<Book[]>("/library/books") });
  const { data: copies, refetch: refetchCopies } = useQuery({
    queryKey: ["library-copies", activeBookId],
    queryFn: () => apiFetch<Copy[]>(`/library/books/${activeBookId}/copies`),
    enabled: !!activeBookId,
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<{ id: string; is_current: boolean }[]>("/academic-years") });
  const activeYearId = years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId, issueForm.branch_id],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}&branch_id=${issueForm.branch_id}`),
    enabled: !!activeYearId && !!issueForm.branch_id,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", issueForm.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${issueForm.school_class_id}`),
    enabled: !!issueForm.school_class_id,
  });
  const { data: sectionStudents } = useQuery({
    queryKey: ["students", issueForm.section_id],
    queryFn: () => apiFetch<Student[]>(`/students?section_id=${issueForm.section_id}`),
    enabled: !!issueForm.section_id,
  });
  const { data: activeIssues, refetch: refetchIssues } = useQuery({ queryKey: ["library-active-issues"], queryFn: () => apiFetch<Issue[]>("/library/issues") });

  const activeBook = books?.find((b) => b.id === activeBookId) ?? null;
  const availableCopies = (copies ?? []).filter((c) => c.status === "available" && (!issueForm.branch_id || c.branch_id === issueForm.branch_id));

  const addBook = useMutation({
    mutationFn: () => apiFetch("/library/books", { method: "POST", body: { ...bookForm, author: bookForm.author || null, isbn: bookForm.isbn || null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["library-books"] }); setShowAddBook(false); setBookForm({ title: "", author: "", isbn: "" }); },
  });

  const addCopy = useMutation({
    mutationFn: () => apiFetch(`/library/books/${activeBookId}/copies`, { method: "POST", body: { branch_id: copyBranchId, accession_number: accessionNumber } }),
    onSuccess: () => { refetchCopies(); setAccessionNumber(""); setCopyBranchId(""); },
  });

  const issueBook = useMutation({
    mutationFn: () => apiFetch("/library/issues", { method: "POST", body: { book_copy_id: issueForm.copy_id, student_id: issueForm.student_id, due_date: issueForm.due_date } }),
    onSuccess: () => { refetchCopies(); refetchIssues(); setIssueForm((f) => ({ ...f, student_id: "", copy_id: "" })); },
  });

  const returnBook = useMutation({
    mutationFn: ({ issueId, lost }: { issueId: string; lost: boolean }) =>
      apiFetch(`/library/issues/${issueId}/return`, { method: "POST", body: { lost, fine_amount: returnFine[issueId] || null } }),
    onSuccess: () => { refetchIssues(); refetchCopies(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">Book catalog, copies, and circulation.</p>
        </div>
        <Button size="sm" onClick={() => setShowAddBook((v) => !v)}>{showAddBook ? "Cancel" : "New book"}</Button>
      </div>

      {showAddBook && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-4">
          <Input placeholder="Title" value={bookForm.title} onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))} className="w-56" />
          <Input placeholder="Author" value={bookForm.author} onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))} className="w-48" />
          <Input placeholder="ISBN" value={bookForm.isbn} onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))} className="w-40" />
          <Button size="sm" onClick={() => addBook.mutate()} disabled={!bookForm.title || addBook.isPending}>Add</Button>
          {addBook.error instanceof ApiError && <p className="w-full text-xs text-destructive">{addBook.error.message}</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Books</h2>
          <div className="space-y-1">
            {books?.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveBookId(b.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${activeBookId === b.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
              >
                <span>{b.title}</span>
                <span className="text-xs text-muted-foreground">{b.author}</span>
              </button>
            ))}
            {books?.length === 0 && <p className="text-sm text-muted-foreground">No books yet.</p>}
          </div>

          {activeBook && (
            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Copies — {activeBook.title}</h3>
              <ul className="space-y-1 text-sm">
                {copies?.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span>{c.accession_number}{branches && branches.length > 1 ? ` · ${branches.find((b) => b.id === c.branch_id)?.name ?? "-"}` : ""}</span>
                    <Badge variant={c.status === "available" ? "success" : c.status === "issued" ? "outline" : "destructive"}>{c.status}</Badge>
                  </li>
                ))}
                {copies?.length === 0 && <li className="text-muted-foreground">No copies yet.</li>}
              </ul>
              <div className="flex gap-2">
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={copyBranchId} onChange={(e) => setCopyBranchId(e.target.value)}>
                  <option value="">Campus...</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Input placeholder="Accession number" value={accessionNumber} onChange={(e) => setAccessionNumber(e.target.value)} />
                <Button size="sm" onClick={() => addCopy.mutate()} disabled={!accessionNumber || !copyBranchId || addCopy.isPending}>Add copy</Button>
              </div>
              {addCopy.error instanceof ApiError && <p className="text-xs text-destructive">{addCopy.error.message}</p>}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Issue a book</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.branch_id} onChange={(e) => setIssueForm((f) => ({ ...f, branch_id: e.target.value, school_class_id: "", section_id: "", student_id: "", copy_id: "" }))}>
              <option value="">Campus...</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.school_class_id} onChange={(e) => setIssueForm((f) => ({ ...f, school_class_id: e.target.value, section_id: "", student_id: "" }))} disabled={!issueForm.branch_id}>
              <option value="">Class...</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.section_id} onChange={(e) => setIssueForm((f) => ({ ...f, section_id: e.target.value, student_id: "" }))} disabled={!issueForm.school_class_id}>
              <option value="">Section...</option>
              {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.student_id} onChange={(e) => setIssueForm((f) => ({ ...f, student_id: e.target.value }))} disabled={!issueForm.section_id}>
              <option value="">Student...</option>
              {sectionStudents?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.copy_id} onChange={(e) => setIssueForm((f) => ({ ...f, copy_id: e.target.value }))} disabled={!activeBookId}>
              <option value="">Copy...</option>
              {availableCopies.map((c) => <option key={c.id} value={c.id}>{activeBook?.title} — {c.accession_number}</option>)}
            </select>
            <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={issueForm.due_date} onChange={(e) => setIssueForm((f) => ({ ...f, due_date: e.target.value }))} />
            <Button size="sm" onClick={() => issueBook.mutate()} disabled={!issueForm.student_id || !issueForm.copy_id || issueBook.isPending}>Issue</Button>
          </div>
          {!activeBookId && <p className="text-xs text-muted-foreground">Select a book on the left to pick an available copy.</p>}
          {issueBook.error instanceof ApiError && <p className="text-xs text-destructive">{issueBook.error.message}</p>}

          <h2 className="pt-2 text-sm font-medium">Currently issued</h2>
          <div className="space-y-2">
            {activeIssues?.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                <div>
                  <p className="font-medium">{i.book_title} <span className="text-xs text-muted-foreground">({i.accession_number})</span></p>
                  <p className="text-xs text-muted-foreground">Due {i.due_date} {i.is_overdue && <span className="text-destructive">· Overdue</span>}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input placeholder="Fine" value={returnFine[i.id] ?? ""} onChange={(e) => setReturnFine((f) => ({ ...f, [i.id]: e.target.value }))} className="h-8 w-20" />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => returnBook.mutate({ issueId: i.id, lost: false })} disabled={returnBook.isPending}>Return</Button>
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => returnBook.mutate({ issueId: i.id, lost: true })}>Lost</button>
                </div>
              </div>
            ))}
            {activeIssues?.length === 0 && <p className="text-sm text-muted-foreground">No books currently on loan.</p>}
          </div>
          {returnBook.error instanceof ApiError && <p className="text-xs text-destructive">{returnBook.error.message}</p>}
        </div>
      </div>

      {books?.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>Start by adding a book, then a copy, then issue it.</span>
        </div>
      )}
    </div>
  );
}
