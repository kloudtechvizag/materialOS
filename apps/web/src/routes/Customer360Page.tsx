import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Customer360 {
  customer: { id: string; name: string; gstin: string | null; billing_state: string | null; credit_limit: string; credit_days: number };
  outstanding: string;
  available_credit: string;
  open_quotations: number;
  open_sales_orders: number;
  posted_invoices: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export function Customer360Page() {
  const { customerId } = useParams<{ customerId: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-360", customerId],
    queryFn: () => apiFetch<Customer360>(`/customers/${customerId}/360`),
  });

  const [showPortalForm, setShowPortalForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const createPortalAccess = useMutation({
    mutationFn: () =>
      apiFetch(`/customers/${customerId}/portal-access`, {
        method: "POST",
        body: { email, password, full_name: fullName },
      }),
    onSuccess: () => {
      setCreatedEmail(email);
      setShowPortalForm(false);
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.customer.gstin ?? "No GSTIN"} · {data.customer.billing_state ?? "No state on file"}
          </p>
        </div>
        {!showPortalForm && <Button variant="outline" onClick={() => setShowPortalForm(true)}>Create portal access</Button>}
      </div>

      {createdEmail && (
        <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
          Portal login created for {createdEmail}. Share the workspace name, email, and password with your customer.
        </p>
      )}

      {showPortalForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create portal access</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="portal-full-name">Full name</Label>
                <Input id="portal-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portal-email">Email</Label>
                <Input id="portal-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-password">Temporary password</Label>
              <Input id="portal-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {createPortalAccess.isError && (
              <p className="text-sm text-destructive">
                {createPortalAccess.error instanceof ApiError ? createPortalAccess.error.message : "Could not create portal access."}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPortalForm(false)}>Cancel</Button>
              <Button onClick={() => createPortalAccess.mutate()} disabled={!email || !password || !fullName || createPortalAccess.isPending}>
                {createPortalAccess.isPending ? "Creating..." : "Create login"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Outstanding &amp; credit</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Outstanding" value={formatINR(data.outstanding)} />
          <Stat label="Credit limit" value={formatINR(data.customer.credit_limit)} />
          <Stat label="Available credit" value={formatINR(data.available_credit)} />
          <Stat label="Credit days" value={data.customer.credit_days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          <Stat label="Open quotations" value={data.open_quotations} />
          <Stat label="Open sales orders" value={data.open_sales_orders} />
          <Stat label="Posted invoices" value={data.posted_invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
