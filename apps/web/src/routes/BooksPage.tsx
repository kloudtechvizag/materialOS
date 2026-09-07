import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { SingleColumnLedger, TwoColumnLedger } from "@/components/reports/LedgerTable";
import type { LedgerRow } from "@/components/reports/LedgerTable";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINRPrecise } from "@/lib/format";
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

      <div className="flex gap-1 rounded-lg border border-border p-1 print:hidden">
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

      {tab === "Trial Balance" && (
        <div className="space-y-3">
          <ReportToolbar
            dateLabel="At the end of"
            onDownload={() =>
              trialBalance.data &&
              downloadCsv(`trial-balance-${toDate}.csv`, [
                ["Code", "Account", "Type", "Debit", "Credit"],
                ...trialBalance.data.map((l) => [l.account_code, l.account_name, l.account_type, l.debit, l.credit]),
                ["", "", "Total", totalDebit.toFixed(2), totalCredit.toFixed(2)],
              ])
            }
          >
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </ReportToolbar>

          {trialBalance.isLoading && <Skeleton className="h-40" />}
          {trialBalance.error && <ErrorState error={trialBalance.error} onRetry={() => trialBalance.refetch()} />}
          {trialBalance.data && (
            <>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="w-10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Code</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Debit (Rs.)</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credit (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.data.map((line, i) => (
                      <tr key={line.account_id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.account_code}</td>
                        <td className="px-3 py-2">{line.account_name}</td>
                        <td className="px-3 py-2"><Badge variant="outline">{line.account_type}</Badge></td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(line.debit) ? formatINRPrecise(line.debit) : ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(line.credit) ? formatINRPrecise(line.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-foreground/15 bg-muted/30 font-semibold">
                      <td className="px-3 py-2" colSpan={4}>Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINRPrecise(totalDebit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINRPrecise(totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className={cn("text-sm font-medium", Math.abs(totalDebit - totalCredit) < 0.01 ? "text-success" : "text-destructive")}>
                {Math.abs(totalDebit - totalCredit) < 0.01 ? "✓ Ties -- debits equal credits" : "Does not tie"}
              </p>
            </>
          )}
        </div>
      )}

      {tab === "Profit & Loss" && (
        <div className="space-y-3">
          <ReportToolbar
            dateLabel="For the period"
            onDownload={() =>
              pnl.data &&
              downloadCsv(`profit-and-loss-${fromDate}_to_${toDate}.csv`, [
                ["Income account", "Amount"],
                ...pnl.data.income_by_account.map(([, name, amt]) => [name, amt]),
                ["Expense account", "Amount"],
                ...pnl.data.expense_by_account.map(([, name, amt]) => [name, amt]),
                ["Net profit", pnl.data.net_profit],
              ])
            }
          >
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </ReportToolbar>

          {pnl.isLoading && <Skeleton className="h-40" />}
          {pnl.error && <ErrorState error={pnl.error} onRetry={() => pnl.refetch()} />}
          {pnl.data && (
            <TwoColumnLedger
              leftTitle="Expenses"
              rightTitle="Income"
              leftRows={[
                ...pnl.data.expense_by_account.map(([, name, amt]): LedgerRow => ({ label: name, amount: amt })),
                { label: "Net profit for the period", amount: pnl.data.net_profit, highlight: true },
              ]}
              rightRows={pnl.data.income_by_account.map(([, name, amt]): LedgerRow => ({ label: name, amount: amt }))}
              leftTotal={(Number(pnl.data.total_expense) + Number(pnl.data.net_profit)).toFixed(2)}
              rightTotal={pnl.data.total_income}
            />
          )}
        </div>
      )}

      {tab === "Balance Sheet" && (
        <div className="space-y-3">
          <ReportToolbar
            dateLabel="At the end of"
            onDownload={() =>
              balanceSheet.data &&
              downloadCsv(`balance-sheet-${toDate}.csv`, [
                ["Liabilities", "Amount"],
                ["Profit for the period (computed)", balanceSheet.data.retained_earnings],
                ...balanceSheet.data.liabilities_by_account.map(([, name, amt]) => [name, amt]),
                ["Assets", "Amount"],
                ...balanceSheet.data.assets_by_account.map(([, name, amt]) => [name, amt]),
              ])
            }
          >
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </ReportToolbar>

          {balanceSheet.isLoading && <Skeleton className="h-40" />}
          {balanceSheet.error && <ErrorState error={balanceSheet.error} onRetry={() => balanceSheet.refetch()} />}
          {balanceSheet.data && (
            <TwoColumnLedger
              leftTitle="Liabilities"
              rightTitle="Assets"
              leftRows={[
                { label: "Profit for the period (computed)", amount: balanceSheet.data.retained_earnings, highlight: true },
                ...balanceSheet.data.liabilities_by_account.map(([, name, amt]): LedgerRow => ({ label: name, amount: amt })),
              ]}
              rightRows={balanceSheet.data.assets_by_account.map(([, name, amt]): LedgerRow => ({ label: name, amount: amt }))}
              leftTotal={(Number(balanceSheet.data.total_liabilities) + Number(balanceSheet.data.retained_earnings)).toFixed(2)}
              rightTotal={balanceSheet.data.total_assets}
            />
          )}
        </div>
      )}

      {tab === "Cash Flow" && (
        <div className="space-y-3">
          <ReportToolbar
            dateLabel="For the period"
            onDownload={() =>
              cashFlow.data &&
              downloadCsv(`cash-flow-${fromDate}_to_${toDate}.csv`, [
                ["Line", "Amount"],
                ["Opening balance", cashFlow.data.opening_balance],
                ...cashFlow.data.by_document_type.map((l) => [l.document_type, l.net_amount]),
                ["Closing balance", cashFlow.data.closing_balance],
              ])
            }
          >
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </ReportToolbar>

          <p className="text-xs text-muted-foreground">Cash-basis, by document type. No investing/financing sections are modeled yet (see ADR-008).</p>

          {cashFlow.isLoading && <Skeleton className="h-40" />}
          {cashFlow.error && <ErrorState error={cashFlow.error} onRetry={() => cashFlow.refetch()} />}
          {cashFlow.data && (
            <SingleColumnLedger
              title="Cash movement"
              rows={[
                { label: "Opening balance", amount: cashFlow.data.opening_balance, bold: true },
                ...cashFlow.data.by_document_type.map(
                  (l): LedgerRow => ({ label: l.document_type.replace("_", " "), amount: l.net_amount })
                ),
              ]}
              total={cashFlow.data.closing_balance}
            />
          )}
        </div>
      )}
    </div>
  );
}
