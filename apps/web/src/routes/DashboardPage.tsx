import { useQuery } from "@tanstack/react-query";
import { Building2, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  legal_name: string;
  gstin: string | null;
}

export function DashboardPage() {
  const { data: companies, isLoading, error, refetch } = useQuery({
    queryKey: ["companies"],
    queryFn: () => apiFetch<Company[]>("/companies"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Slices 1-6 (sales, stock, dispatch, accounting, AI) land here as they ship. Today, get your existing
          Tally or Busy data in.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {companies && companies.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No company set up yet"
          description="Your workspace was created without a company record. Contact support to fix this."
        />
      )}

      {companies && companies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <CardTitle>{company.name}</CardTitle>
                <CardDescription>{company.gstin ?? "GSTIN not set"}</CardDescription>
              </CardHeader>
            </Card>
          ))}

          <Card className="border-dashed">
            <CardHeader>
              <UploadCloud className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">Import your Tally or Busy data</CardTitle>
              <CardDescription>
                Bring in customers, suppliers, items, opening balances, and opening stock in one guided flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link to="/imports">Start import</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
