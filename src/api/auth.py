from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from src.api.deps import DbSession
from src.config import get_settings
from src.models.schemas import UserProfile
from src.services import auth

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


@router.post("/login", response_model=UserProfile)
def login(body: LoginRequest, request: Request, response: Response, db: DbSession) -> UserProfile:
    user = auth.authenticate(db, body.email, body.password)
    cookie = auth.issue_session(db, user, request.cookies.get(auth.COOKIE_NAME))
    response.set_cookie(
        auth.COOKIE_NAME,
        cookie,
        max_age=get_settings().auth_session_ttl_seconds,
        httponly=True,
        secure=get_settings().app_env == "production",
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return UserProfile.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: DbSession) -> Response:
    auth.revoke_session(db, request.cookies.get(auth.COOKIE_NAME))
    db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
    response.delete_cookie(
        auth.COOKIE_NAME, path="/", httponly=True, secure=get_settings().app_env == "production", samesite="lax"
    )
    return response
