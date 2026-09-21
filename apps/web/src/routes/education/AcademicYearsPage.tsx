import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export function AcademicYearsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_current: false });

  const { data: years, isLoading, error, refetch } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => apiFetch<AcademicYear[]>("/academic-years"),
  });

  const createYear = useMutation({
    mutationFn: () => apiFetch<AcademicYear>("/academic-years", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      setShowForm(false);
      setForm({ name: "", start_date: "", end_date: "", is_current: false });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Academic years</h1>
          <p className="text-sm text-muted-foreground">Classes and student enrolment are scoped to one academic year at a time.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add academic year"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New academic year</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="2026-27" />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_current} onCheckedChange={(v) => setForm((f) => ({ ...f, is_current: v === true }))} />
              Make this the current academic year
            </label>
            {createYear.isError && <ErrorState error={createYear.error} />}
            <Button
              onClick={() => createYear.mutate()}
              disabled={!form.name || !form.start_date || !form.end_date || createYear.isPending}
            >
              {createYear.isPending ? "Saving..." : "Save academic year"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {years && years.length === 0 && !showForm && (
        <EmptyState
          icon={CalendarDays}
          title="No academic years yet"
          description="Add your school's current academic year to start setting up classes and enrolling students."
          actionLabel="Add academic year"
          onAction={() => setShowForm(true)}
        />
      )}

      {years && years.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y) => (
            <Card key={y.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{y.name}</CardTitle>
                {y.is_current && <Badge variant="success">Current</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{y.start_date} &rarr; {y.end_date}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
