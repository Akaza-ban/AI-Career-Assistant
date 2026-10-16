import logging
import smtplib
from email.message import EmailMessage

from src.config import get_settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str, html: str | None = None) -> None:
    """
    Gửi email qua SMTP: văn bản thuần, kèm bản HTML nếu có (ứng dụng mail tự chọn bản hiển thị được). Chưa cấu hình SMTP_HOST (môi trường phát triển) thì chỉ ghi nội dung
    vào log để lấy link đặt lại mật khẩu. Lỗi gửi được ghi log, không làm hỏng request.
    """
    settings = get_settings()
    if not settings.smtp_host:
        logger.warning("SMTP chưa cấu hình, email tới %s không được gửi.\nTiêu đề: %s\n%s", to, subject, body)
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    if html:
        message.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Không gửi được email tới %s", to)
