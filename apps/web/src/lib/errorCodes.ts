/**
 * Mirrors app/errors.py ErrorCode on the backend (G5). Kept as a single
 * shared enum so a frontend error-code check can never silently drift
 * from what the API actually returns.
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  CREDIT_LIMIT_EXCEEDED: "CREDIT_LIMIT_EXCEEDED",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  PERIOD_LOCKED: "PERIOD_LOCKED",
  GSTIN_INVALID: "GSTIN_INVALID",
  EWB_DOCUMENT_TOO_OLD: "EWB_DOCUMENT_TOO_OLD",
  IMPORT_FORMAT_UNRECOGNISED: "IMPORT_FORMAT_UNRECOGNISED",
  IMPORT_VALIDATION_FAILED: "IMPORT_VALIDATION_FAILED",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
  IDEMPOTENCY_KEY_CONFLICT: "IDEMPOTENCY_KEY_CONFLICT",
  FEATURE_NOT_AVAILABLE: "FEATURE_NOT_AVAILABLE",
  USAGE_LIMIT_EXCEEDED: "USAGE_LIMIT_EXCEEDED",
  PLAN_DOWNGRADE_BLOCKED: "PLAN_DOWNGRADE_BLOCKED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    retryable: boolean;
  };
}

/** G5: "Something went wrong" is a build failure -- every code maps to
 * a specific, human-actionable message. Unrecognised codes still show
 * the server's own message rather than a generic fallback. */
export const ERROR_RECOVERY_HINTS: Partial<Record<ErrorCode, string>> = {
  CREDIT_LIMIT_EXCEEDED: "Ask an owner or finance manager to approve this order, or collect an advance payment.",
  INSUFFICIENT_STOCK: "Reduce the quantity or check stock in another warehouse.",
  PERIOD_LOCKED: "This financial period is closed. Ask an admin to unlock it if this entry is truly needed.",
  GSTIN_INVALID: "Check the GSTIN format: 15 characters, e.g. 37ABCDE1234F1Z5.",
  IMPORT_FORMAT_UNRECOGNISED: "Upload a Tally XML export or a Busy/Marg CSV export.",
  IMPORT_VALIDATION_FAILED: "Fix the flagged rows, or exclude them, before committing.",
  FEATURE_NOT_AVAILABLE: "This isn't included in your current plan. Upgrade to unlock it.",
  USAGE_LIMIT_EXCEEDED: "You've reached your plan's limit for this. Upgrade to add more.",
  PLAN_DOWNGRADE_BLOCKED: "You're over the target plan's limits. Reduce usage first.",
  PAYMENT_REQUIRED: "This workspace has no active subscription.",
};
