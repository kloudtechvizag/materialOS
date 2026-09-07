import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { ERROR_RECOVERY_HINTS, type ErrorCode } from "@/lib/errorCodes";

/** G5/G94: never "Something went wrong" -- show the real reason and a
 * recovery action mapped from the error code. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isApiError = error instanceof ApiError;
  const message = isApiError ? error.message : "An unexpected error occurred.";
  const hint = isApiError ? ERROR_RECOVERY_HINTS[error.code as ErrorCode] : undefined;
  const retryable = isApiError ? error.retryable : true;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">{message}</p>
        {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      </div>
      {retryable && onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
