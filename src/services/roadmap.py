"""Dịch vụ ánh xạ kỹ năng sang lộ trình học tập trên roadmap.sh (US-SV-02, US-SV-05).

Cung cấp đường dẫn lộ trình chuẩn từ cộng đồng https://roadmap.sh/ cho các kỹ năng
còn thiếu của sinh viên sau khi phân tích Gap Analysis.
"""

import re
from typing import Any

# Bảng ánh xạ chuẩn từ kỹ năng (chuẩn hoá dạng chữ thường) sang link roadmap.sh
SKILL_ROADMAP_MAP: dict[str, str] = {
    # Ngôn ngữ lập trình (Programming Languages)
    "python": "https://roadmap.sh/python",
    "java": "https://roadmap.sh/java",
    "javascript": "https://roadmap.sh/javascript",
    "js": "https://roadmap.sh/javascript",
    "typescript": "https://roadmap.sh/typescript",
    "ts": "https://roadmap.sh/typescript",
    "c++": "https://roadmap.sh/cpp",
    "cpp": "https://roadmap.sh/cpp",
    "c#": "https://roadmap.sh/csharp",
    "csharp": "https://roadmap.sh/csharp",
    ".net": "https://roadmap.sh/aspnet-core",
    "asp.net": "https://roadmap.sh/aspnet-core",
    "aspnet": "https://roadmap.sh/aspnet-core",
    "golang": "https://roadmap.sh/golang",
    "go": "https://roadmap.sh/golang",
    "rust": "https://roadmap.sh/rust",
    "php": "https://roadmap.sh/php",
    "ruby": "https://roadmap.sh/ruby",
    "kotlin": "https://roadmap.sh/kotlin",
    "swift": "https://roadmap.sh/swift",
    "sql": "https://roadmap.sh/sql",
    # Frontend Frameworks & Công nghệ web
    "frontend": "https://roadmap.sh/frontend",
    "react": "https://roadmap.sh/react",
    "reactjs": "https://roadmap.sh/react",
    "react.js": "https://roadmap.sh/react",
    "vue": "https://roadmap.sh/vue",
    "vuejs": "https://roadmap.sh/vue",
    "vue.js": "https://roadmap.sh/vue",
    "angular": "https://roadmap.sh/angular",
    "next.js": "https://roadmap.sh/react",
    "nextjs": "https://roadmap.sh/react",
    "html": "https://roadmap.sh/frontend",
    "css": "https://roadmap.sh/frontend",
    "tailwind": "https://roadmap.sh/frontend",
    "tailwindcss": "https://roadmap.sh/frontend",
    # Backend Frameworks & Runtimes
    "backend": "https://roadmap.sh/backend",
    "nodejs": "https://roadmap.sh/nodejs",
    "node.js": "https://roadmap.sh/nodejs",
    "node": "https://roadmap.sh/nodejs",
    "express": "https://roadmap.sh/nodejs",
    "expressjs": "https://roadmap.sh/nodejs",
    "spring": "https://roadmap.sh/spring-boot",
    "spring boot": "https://roadmap.sh/spring-boot",
    "springboot": "https://roadmap.sh/spring-boot",
    "fastapi": "https://roadmap.sh/python",
    "django": "https://roadmap.sh/python",
    "flask": "https://roadmap.sh/python",
    "nest.js": "https://roadmap.sh/nodejs",
    "nestjs": "https://roadmap.sh/nodejs",
    "rest api": "https://roadmap.sh/backend",
    "restful": "https://roadmap.sh/backend",
    "graphql": "https://roadmap.sh/graphql",
    # Cơ sở dữ liệu & Caching
    "postgresql": "https://roadmap.sh/postgresql",
    "postgres": "https://roadmap.sh/postgresql",
    "mysql": "https://roadmap.sh/sql",
    "mongodb": "https://roadmap.sh/mongodb",
    "redis": "https://roadmap.sh/redis",
    # DevOps, Cloud & Hệ thống
    "devops": "https://roadmap.sh/devops",
    "docker": "https://roadmap.sh/docker",
    "kubernetes": "https://roadmap.sh/kubernetes",
    "k8s": "https://roadmap.sh/kubernetes",
    "linux": "https://roadmap.sh/linux",
    "git": "https://roadmap.sh/git-github",
    "github": "https://roadmap.sh/git-github",
    "gitlab": "https://roadmap.sh/git-github",
    "aws": "https://roadmap.sh/aws",
    "cloud": "https://roadmap.sh/aws",
    "ci/cd": "https://roadmap.sh/devops",
    "cicd": "https://roadmap.sh/devops",
    # AI, Data & Machine Learning
    "ai": "https://roadmap.sh/ai-data-scientist",
    "artificial intelligence": "https://roadmap.sh/ai-data-scientist",
    "machine learning": "https://roadmap.sh/ai-data-scientist",
    "deep learning": "https://roadmap.sh/ai-data-scientist",
    "data science": "https://roadmap.sh/ai-data-scientist",
    "data analyst": "https://roadmap.sh/data-analyst",
    "data analysis": "https://roadmap.sh/data-analyst",
    "data engineer": "https://roadmap.sh/data-engineer",
    "pytorch": "https://roadmap.sh/ai-data-scientist",
    "tensorflow": "https://roadmap.sh/ai-data-scientist",
    "nlp": "https://roadmap.sh/ai-data-scientist",
    # Mobile
    "android": "https://roadmap.sh/android",
    "ios": "https://roadmap.sh/ios",
    "flutter": "https://roadmap.sh/flutter",
    "react native": "https://roadmap.sh/react-native",
    # An ninh mạng & Kiểm thử
    "cyber security": "https://roadmap.sh/cyber-security",
    "security": "https://roadmap.sh/cyber-security",
    "qa": "https://roadmap.sh/qa",
    "testing": "https://roadmap.sh/qa",
    "software testing": "https://roadmap.sh/qa",
    # Nền tảng & Kiến trúc
    "computer science": "https://roadmap.sh/computer-science",
    "system design": "https://roadmap.sh/system-design",
    "fullstack": "https://roadmap.sh/full-stack",
    "full-stack": "https://roadmap.sh/full-stack",
    "blockchain": "https://roadmap.sh/blockchain",
}

DEFAULT_ROADMAP_URL = "https://roadmap.sh/roadmaps"


def _clean_skill_name(name: str) -> str:
    """Loại bỏ ký tự thừa, khoảng trắng và chuẩn hóa về chữ thường."""
    # Bỏ các phần mô tả phụ trong ngoặc đơn ví dụ 'Python (cơ bản)' -> 'Python'
    cleaned = re.sub(r"\(.*?\)", "", name)
    cleaned = cleaned.strip().lower()
    return cleaned


def get_roadmap_url(skill_name: str | None) -> str:
    """
    Lấy đường dẫn roadmap.sh cho kỹ năng được chỉ định.
    Nếu không tìm thấy roadmap tương ứng cụ thể, trả về trang danh sách https://roadmap.sh/roadmaps.
    """
    if not skill_name or not skill_name.strip():
        return DEFAULT_ROADMAP_URL

    cleaned = _clean_skill_name(skill_name)

    # 1. Khớp chính xác
    if cleaned in SKILL_ROADMAP_MAP:
        return SKILL_ROADMAP_MAP[cleaned]

    # 2. Khớp từng từ hoặc tiền tố/hậu tố trong mapping
    # Ví dụ "lập trình python" -> khớp "python"
    for keyword, url in SKILL_ROADMAP_MAP.items():
        if len(keyword) >= 2 and re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", cleaned):
            return url

    # 3. Fallback mặc định
    return DEFAULT_ROADMAP_URL


def get_roadmap_info(skill_name: str | None) -> dict[str, Any]:
    """Trả về chi tiết gồm tên kỹ năng, link roadmap và cờ xác định có khớp chính xác không."""
    url = get_roadmap_url(skill_name)
    is_matched = url != DEFAULT_ROADMAP_URL
    return {
        "skill": skill_name or "",
        "roadmap_url": url,
        "is_matched": is_matched,
    }
