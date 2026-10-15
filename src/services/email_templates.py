"""
Mẫu email gửi cho người dùng: bản HTML theo màu CareerV và bản văn bản thuần đi kèm.

HTML dựng bằng bảng + style inline để hiển thị đúng trên Gmail / Outlook. Logo là ảnh PNG trên frontend
(public/brand/careerv/email-logo.png), chỉ chèn khi FRONTEND_URL là tên miền công khai: Gmail tải ảnh qua máy chủ
của Google nên không đọc được ảnh từ localhost. Không có ảnh (hoặc ảnh bị chặn) vẫn còn chữ CareerV.
"""

from html import escape
from urllib.parse import urlparse

INK, INK_2, INK_3 = "#18181b", "#52525b", "#6b6b74"
GOLD, ACCENT, PANEL, LINE = "#d9a93a", "#5b5bd6", "#f7f7f9", "#ececef"
FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
LOGO_PATH = "/brand/careerv/email-logo.png"
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def logo_url(frontend_url: str) -> str | None:
    """Đường dẫn ảnh logo nếu frontend chạy trên tên miền công khai; localhost thì None (chỉ dùng chữ CareerV)."""
    parsed = urlparse(frontend_url)
    host = (parsed.hostname or "").lower()
    if not host or host in _LOCAL_HOSTS or host.endswith(".local"):
        return None
    return f"{frontend_url.rstrip('/')}{LOGO_PATH}"


def _layout(preheader: str, body: str, logo: str | None) -> str:
    mark = (
        f'<img src="{escape(logo)}" width="47" height="36" alt="" '
        f'style="display:inline-block;vertical-align:middle;border:0;margin-right:10px;">'
        if logo
        else ""
    )
    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>CareerV</title></head>
<body style="margin:0;padding:0;background:{PANEL};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PANEL};padding:32px 12px;font-family:{FONT};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px;font-size:22px;line-height:36px;font-weight:700;letter-spacing:-0.02em;color:{INK};">{mark}<span style="vertical-align:middle;">Career<span style="color:{GOLD};">V</span></span></td></tr>
<tr><td style="background:#ffffff;border:1px solid {LINE};border-radius:16px;padding:32px 28px 28px;">
{body}
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:18px;color:{INK_3};">Email tự động từ CareerV, trợ lý nghề nghiệp cho sinh viên. Vui lòng không trả lời email này.</td></tr>
</table></td></tr></table>
</body></html>"""


def password_reset(full_name: str, email: str, link: str, minutes: int, logo: str | None) -> tuple[str, str]:
    """(văn bản thuần, HTML) của email đặt lại mật khẩu."""
    text = "\n".join(
        [
            f"Chào {full_name},",
            "",
            f"Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản CareerV {email}.",
            f"Mở link sau trong {minutes} phút để đặt mật khẩu mới (link chỉ dùng được một lần):",
            link,
            "",
            "Không phải bạn yêu cầu? Bỏ qua email này, mật khẩu hiện tại vẫn giữ nguyên. "
            "Đừng chuyển tiếp email này cho người khác.",
            "",
            "Email tự động từ CareerV. Vui lòng không trả lời email này.",
        ]
    )
    href = escape(link)
    body = f"""<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:{INK};">Đặt lại mật khẩu</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:{INK};">Chào {escape(full_name)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:24px;color:{INK_2};">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản CareerV <b style="color:{INK};font-weight:600;">{escape(email)}</b>. Bấm nút bên dưới để tạo mật khẩu mới.</p>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:999px;background:{INK};">
<a href="{href}" style="display:inline-block;padding:13px 26px;font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">Đặt lại mật khẩu</a>
</td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:{INK_3};">Link có hiệu lực trong <b style="color:{INK};font-weight:600;">{minutes} phút</b> và chỉ dùng được một lần.</p>
<div style="margin:24px 0 0;padding:14px 16px;border-radius:12px;background:{PANEL};font-size:13px;line-height:20px;color:{INK_2};"><b style="color:{INK};font-weight:600;">Không phải bạn yêu cầu?</b> Bỏ qua email này, mật khẩu hiện tại vẫn giữ nguyên. Đừng chuyển tiếp email này cho người khác.</div>
<p style="margin:24px 0 6px;font-size:12px;line-height:18px;color:{INK_3};">Nút không bấm được? Sao chép link sau vào trình duyệt:</p>
<p style="margin:0;font-size:12px;line-height:18px;word-break:break-all;"><a href="{href}" style="color:{ACCENT};text-decoration:none;">{href}</a></p>"""
    return text, _layout(f"Link đặt lại mật khẩu có hiệu lực trong {minutes} phút.", body, logo)
