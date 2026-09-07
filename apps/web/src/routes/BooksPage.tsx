import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TrialBalanceLine { account_id: string; account_code: string; account_name: string; account_type: string; debit: string; credit: string; }
interface PnL { income_by_account: [string, string, string][]; expense_by_account: [string, string, string][]; total_income: string; total_expense: string; net_profit: string; }
interface BalanceSheet { assets_by_account: [string, string, string][]; liabilities_by_account: [string, string, string][]; total_assets: string; total_liabilities: string; retained_earnings: string; }
interface CashFlow { opening_balance: string; by_document_type: { document_type: string; net_amount: string }[]; closing_balance: string; }

const TABS = ["Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Flow"] as const;
type Tab = (typeof TABS)[number];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function BooksPage() {
  const [tab, setTab] = useState<Tab>("Trial Balance");
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());

  const trialBalance = useQuery({
    queryKey: ["trial-balance", toDate],
    queryFn: () => apiFetch<TrialBalanceLine[]>(`/reports/trial-balance?as_of=${toDate}`),
    enabled: tab === "Trial Balance",
  });
  const pnl = useQuery({
    queryKey: ["pnl", fromDate, toDate],
    queryFn: () => apiFetch<PnL>(`/reports/profit-and-loss?from_date=${fromDate}&to_date=${toDate}`),
    enabled: tab === "Profit & Loss",
  });
  const balanceSheet = useQuery({
    queryKey: ["balance-sheet", toDate],
    queryFn: () => apiFetch<BalanceSheet>(`/reports/balance-sheet?as_of=${toDate}`),
    enabled: tab === "Balance Sheet",
  });
  const cashFlow = useQuery({
    queryKey: ["cash-flow", fromDate, toDate],
    queryFn: () => apiFetch<CashFlow>(`/reports/cash-flow?from_date=${fromDate}&to_date=${toDate}`),
    enabled: tab === "Cash Flow",
  });

  const totalDebit = trialBalance.data?.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
  const totalCredit = trialBalance.data?.reduce((s, l) => s + Number(l.credit), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Books</h1>
        <p className="text-sm text-muted-foreground">Every figure here is read straight from the journal -- nothing is a separately maintained total.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "Trial Balance" && tab !== "Balance Sheet" && (
          <div className="flex items-center gap-2 text-sm">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </div>
        )}
        {(tab === "Trial Balance" || tab === "Balance Sheet") && (
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
        )}
      </div>

      {tab === "Trial Balance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trial balance as of {toDate}</CardTitle>
          </CardHeader>
          <CardContent>
            {trialBalance.isLoading && <Skeleton className="h-40" />}
            {trialBalance.error && <ErrorState error={trialBalance.error} onRetry={() => trialBalance.refetch()} />}
            {trialBalance.data && (
              <>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="pb-2">Code</th><th className="pb-2">Account</th><th className="pb-2">Type</th><th className="pb-2 text-right">Debit</th><th className="pb-2 text-right">Credit</th></tr>
                  </thead>
                  <tbody>
                    {trialBalance.data.map((line) => (
                      <tr key={line.account_id} className="border-t border-border">
                        <td className="py-2 text-muted-foreground">{line.account_code}</td>
                        <td className="py-2">{line.account_name}</td>
                        <td className="py-2"><Badge variant="outline">{line.account_type}</Badge></td>
                        <td className="py-2 text-right">{Number(line.debit) ? formatINR(line.debit) : ""}</td>
                        <td className="py-2 text-right">{Number(line.credit) ? formatINR(line.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className={cn("text-sm font-medium", Math.abs(totalDebit - totalCredit) < 0.01 ? "text-success" : "text-destructive")}>
                    {Math.abs(totalDebit - totalCredit) < 0.01 ? "✓ Ties -- debits equal credits" : "Does not tie"}
                  </span>
                  <div className="flex gap-6 font-semibold">
                    <span>{formatINR(totalDebit)}</span>
                    <span>{formatINR(totalCredit)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Profit & Loss" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Profit &amp; loss, {fromDate} to {toDate}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {pnl.isLoading && <Skeleton className="h-40" />}
            {pnl.error && <ErrorState error={pnl.error} onRetry={() => pnl.refetch()} />}
            {pnl.data && (
              <>
                <div>
                  <p className="mb-1 text-sm font-medium">Income</p>
                  {pnl.data.income_by_account.map(([code, name, amt]) => (
                    <div key={code} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{name}</span><span>{formatINR(amt)}</span></div>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Expenses</p>
                  {pnl.data.expense_by_account.map(([code, name, amt]) => (
                    <div key={code} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{name}</span><span>{formatINR(amt)}</span></div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-lg font-semibold">
                  <span>Net profit</span><span>{formatINR(pnl.data.net_profit)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Balance Sheet" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Balance sheet as of {toDate}</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {balanceSheet.isLoading && <Skeleton className="h-40" />}
            {balanceSheet.error && <ErrorState error={balanceSheet.error} onRetry={() => balanceSheet.refetch()} />}
            {balanceSheet.data && (
              <>
                <div>
                  <p className="mb-1 text-sm font-medium">Assets</p>
                  {balanceSheet.data.assets_by_account.map(([code, name, amt]) => (
                    <div key={code} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{name}</span><span>{formatINR(amt)}</span></div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Total assets</span><span>{formatINR(balanceSheet.data.total_assets)}</span></div>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Liabilities &amp; equity</p>
                  {balanceSheet.data.liabilities_by_account.map(([code, name, amt]) => (
                    <div key={code} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{name}</span><span>{formatINR(amt)}</span></div>
                  ))}
                  <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">Retained earnings (computed)</span><span>{formatINR(balanceSheet.data.retained_earnings)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Total</span><span>{formatINR((Number(balanceSheet.data.total_liabilities) + Number(balanceSheet.data.retained_earnings)).toString())}</span></div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Cash Flow" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cash movement, {fromDate} to {toDate}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Cash-basis, by document type. No investing/financing sections are modeled yet (see ADR-008).</p>
            {cashFlow.isLoading && <Skeleton className="h-40" />}
            {cashFlow.error && <ErrorState error={cashFlow.error} onRetry={() => cashFlow.refetch()} />}
            {cashFlow.data && (
              <>
                <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">Opening balance</span><span>{formatINR(cashFlow.data.opening_balance)}</span></div>
                {cashFlow.data.by_document_type.map((line) => (
                  <div key={line.document_type} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground capitalize">{line.document_type.replace("_", " ")}</span><span>{formatINR(line.net_amount)}</span></div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Closing balance</span><span>{formatINR(cashFlow.data.closing_balance)}</span></div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
