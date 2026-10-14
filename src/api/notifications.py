from fastapi import APIRouter, status

from src.api.deps import CurrentUser, DbSession
from src.models.schemas import NotificationResponse
from src.services import notifications

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user: CurrentUser, db: DbSession) -> list[dict]:
    """Tối đa 50 thông báo gần nhất, mới nhất trước."""
    return notifications.list_for(db, user)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: CurrentUser, db: DbSession) -> None:
    notifications.mark_all_read(db, user)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: str, user: CurrentUser, db: DbSession) -> None:
    notifications.mark_read(db, user, notification_id)
