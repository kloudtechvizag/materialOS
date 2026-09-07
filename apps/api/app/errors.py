"""G5: every error is typed -- {error: {code, message, details, retryable}}
with a code enum shared by backend and frontend (see apps/web/src/lib/errorCodes.ts).
"Something went wrong" is a build failure.
"""

from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    CONFLICT = "CONFLICT"
    CREDIT_LIMIT_EXCEEDED = "CREDIT_LIMIT_EXCEEDED"
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    PERIOD_LOCKED = "PERIOD_LOCKED"
    GSTIN_INVALID = "GSTIN_INVALID"
    EWB_DOCUMENT_TOO_OLD = "EWB_DOCUMENT_TOO_OLD"
    IMPORT_FORMAT_UNRECOGNISED = "IMPORT_FORMAT_UNRECOGNISED"
    IMPORT_VALIDATION_FAILED = "IMPORT_VALIDATION_FAILED"
    IDEMPOTENCY_KEY_REQUIRED = "IDEMPOTENCY_KEY_REQUIRED"
    IDEMPOTENCY_KEY_CONFLICT = "IDEMPOTENCY_KEY_CONFLICT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


RETRYABLE_CODES = {ErrorCode.CONFLICT, ErrorCode.INTERNAL_ERROR, ErrorCode.IDEMPOTENCY_KEY_CONFLICT}


class AppError(Exception):
    def __init__(self, code: ErrorCode, message: str, status_code: int = 400, details: dict[str, Any] | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def _envelope(code: str, message: str, details: dict[str, Any] | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "retryable": code in {c.value for c in RETRYABLE_CODES},
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code.value, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(ErrorCode.VALIDATION_ERROR.value, "Request validation failed.", {"errors": exc.errors()}),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = ErrorCode.NOT_FOUND if exc.status_code == 404 else ErrorCode.INTERNAL_ERROR
        if exc.status_code == 401:
            code = ErrorCode.UNAUTHORIZED
        elif exc.status_code == 403:
            code = ErrorCode.FORBIDDEN
        return JSONResponse(status_code=exc.status_code, content=_envelope(code.value, str(exc.detail)))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_envelope(ErrorCode.INTERNAL_ERROR.value, "An unexpected error occurred."),
        )
