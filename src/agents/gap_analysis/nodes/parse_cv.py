import re
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.skill_matching import split_cv_lines
from src.services.taxonomy import STATIC_TAXONOMY

# Danh mục các từ khóa kỹ năng cần nhận diện
COMMON_TECH_SKILLS = [
    "Python",
    "FastAPI",
    "Flask",
    "Django",
    "PyTorch",
    "TensorFlow",
    "React",
    "Next.js",
    "Vue",
    "Angular",
    "Express",
    "NestJS",
    "TypeScript",
    "JavaScript",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Qdrant",
    "ChromaDB",
    "LangChain",
    "LangGraph",
    "Machine Learning",
    "Git",
    "SQL",
    "REST API",
    "CI/CD",
    "Linux",
    "RAG",
    "LLM",
]


def extract_skills_from_text(text: str) -> list[str]:
    """Trích xuất các kỹ năng công nghệ có mặt trong văn bản."""
    found_skills = []
    # Ghép tập từ khóa từ STATIC_TAXONOMY và COMMON_TECH_SKILLS
    known_skills = list(
        dict.fromkeys(list(STATIC_TAXONOMY.keys()) + list(STATIC_TAXONOMY.values()) + COMMON_TECH_SKILLS)
    )

    for skill in known_skills:
        # Regex tìm từ nguyên vẹn, hỗ trợ các từ có dấu chấm hoặc dấu gạch nối (Next.js, CI/CD)
        escaped = re.escape(skill)
        pattern = rf"(?<!\w){escaped}(?!\w)"
        if re.search(pattern, text, re.IGNORECASE):
            found_skills.append(skill)

    return found_skills


def extract_evidence_spans(text: str, skills: list[str]) -> dict[str, str]:
    """
    Tìm câu văn hoặc dòng trích đoạn chính xác (evidence span) chứa kỹ năng trong CV gốc.
    Đảm bảo 100% trích xuất từ văn bản gốc của CV.
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    evidence_map: dict[str, str] = {}

    for skill in skills:
        escaped = re.escape(skill)
        pattern = rf"(?<!\w){escaped}(?!\w)"

        for line in lines:
            if re.search(pattern, line, re.IGNORECASE):
                # Làm sạch tiền tố markdown bullet nếu có (- , * )
                clean_line = re.sub(r"^[-*#\s]+", "", line).strip()
                evidence_map[skill] = clean_line or line
                break

        # Nếu không tìm thấy theo từng dòng, tìm theo câu phân tách bằng dấu chấm
        if skill not in evidence_map:
            sentences = re.split(r"[.!?]+", text)
            for sentence in sentences:
                if re.search(pattern, sentence, re.IGNORECASE):
                    clean_sent = sentence.strip()
                    if clean_sent:
                        evidence_map[skill] = clean_sent
                        break

    return evidence_map


async def parse_cv_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 1: Parse
    Phân tích và bóc tách kỹ năng, câu bằng chứng (evidence span) từ CV gốc và yêu cầu từ JD.
    """
    cv_raw = state.get("cv_raw", "")
    jd_raw = state.get("jd_raw", "")

    cv_skills = extract_skills_from_text(cv_raw)
    evidence_spans = extract_evidence_spans(cv_raw, cv_skills)
    jd_skills = extract_skills_from_text(jd_raw)

    # Nếu JD chưa phát hiện được kỹ năng tự động qua từ điển, gán mặc định từ JD nếu có
    if not jd_skills and "required_skills" in state.get("parsed_jd", {}):
        jd_skills = state["parsed_jd"]["required_skills"]

    parsed_cv = {
        "skills": cv_skills,
        "evidence_spans": evidence_spans,
        "raw_length": len(cv_raw),
    }

    parsed_jd = {
        "required_skills": jd_skills,
        "raw_length": len(jd_raw),
    }

    return {
        "parsed_cv": parsed_cv,
        "parsed_jd": parsed_jd,
        # Dòng CV kèm mục (Kinh nghiệm, Dự án, Kỹ năng...) để chấm Match theo bảng anchor PRD 5.2
        "cv_lines": split_cv_lines(cv_raw),
    }
