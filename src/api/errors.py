"""Chuẩn hoá lỗi API về một định dạng duy nhất: {"detail": str, "code": str}.

Frontend (frontend/lib/api.ts) hiển thị `detail` trực tiếp cho người dùng và dựa vào `code`
để xử lý các trường hợp riêng (ví dụ "jd_too_short", "wrong_password").
"""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_DEFAULT_CODES = {
    400: "bad_request",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    422: "validation_error",
    429: "rate_limited",
}


class AppError(Exception):
    """Lỗi nghiệp vụ có thông báo tiếng Việt cho người dùng và mã lỗi máy đọc được."""

    def __init__(self, status_code: int, detail: str, code: str | None = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code or _DEFAULT_CODES.get(status_code, "error")


def _error_response(status_code: int, detail: str, code: str, **extra) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, "code": code, **extra})


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, exc.detail, exc.code)


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Yêu cầu không hợp lệ."
    response = _error_response(exc.status_code, detail, _DEFAULT_CODES.get(exc.status_code, "error"))
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(part) for part in first.get("loc", ())[1:]) or "body"
    detail = f"Dữ liệu không hợp lệ ở trường '{field}': {first.get('msg', 'giá trị không hợp lệ')}"
    return _error_response(422, detail, "validation_error", errors=jsonable_encoder(errors))


async def _provider_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return _error_response(503, "Không thể xử lý an toàn lúc này. Vui lòng thử lại sau.", "provider_unavailable")


def register_error_handlers(app: FastAPI) -> None:
    from src.services.privacy.types import PrivacyError
    from src.services.providers.gateway import GatewayError

    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(PrivacyError, _provider_error_handler)
    app.add_exception_handler(GatewayError, _provider_error_handler)
