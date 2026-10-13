from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.database import get_db
from src.db.models import User
from src.services.auth import COOKIE_NAME, session_user

DbSession = Annotated[Session, Depends(get_db)]

def get_current_user(request: Request, db: DbSession) -> User:
    """Only a verified session establishes identity; roles are read from the database."""
    return session_user(db, request.cookies.get(COOKIE_NAME))


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_student(user: CurrentUser) -> User:
    if user.role != "student":
        raise AppError(403, "Chức năng này chỉ dành cho sinh viên.", "forbidden")
    return user


CurrentStudent = Annotated[User, Depends(get_current_student)]


def get_current_advisor(user: CurrentUser) -> User:
    if user.role != "advisor":
        raise AppError(403, "Chức năng này chỉ dành cho cố vấn.", "forbidden")
    return user


CurrentAdvisor = Annotated[User, Depends(get_current_advisor)]
