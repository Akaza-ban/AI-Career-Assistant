"""Private ORM storage, accessed only by the privacy module and its migration."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.db.database import Base
from src.services.privacy.types import MAX_PLACEHOLDER_LENGTH


class VaultRecord(Base):
    __tablename__ = "pii_vault"

    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("assistant_conversations.id", ondelete="CASCADE"), primary_key=True
    )
    placeholder: Mapped[str] = mapped_column(String(MAX_PLACEHOLDER_LENGTH), primary_key=True)
    kind: Mapped[str] = mapped_column(String(7))
    # One original can be legitimately present in several resources; each origin
    # has a separate row under the same conversation/placeholder.
    origin: Mapped[str] = mapped_column(String(128), primary_key=True)
    ciphertext: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
