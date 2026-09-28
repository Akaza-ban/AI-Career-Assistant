# Bảng taxonomy tĩnh ánh xạ kỹ năng con về công nghệ / lĩnh vực cốt lõi
# Theo yêu cầu đề bài: {"FastAPI": "Python", "Flask": "Python", "Django": "Python", "PyTorch": "Machine Learning", ...}
STATIC_TAXONOMY: dict[str, str] = {
    # Yêu cầu bắt buộc
    "FastAPI": "Python",
    "Flask": "Python",
    "Django": "Python",
    "PyTorch": "Machine Learning",
    "TensorFlow": "Machine Learning",
    "React": "JavaScript",
    "Next.js": "JavaScript",
    # Mở rộng thêm các kỹ năng phổ biến
    "Vue": "JavaScript",
    "Angular": "JavaScript",
    "Express": "JavaScript",
    "NestJS": "TypeScript",
    "TypeScript": "JavaScript",
    "Keras": "Machine Learning",
    "Scikit-Learn": "Machine Learning",
    "PostgreSQL": "SQL",
    "MySQL": "SQL",
    "SQLite": "SQL",
    "LangChain": "AI / GenAI",
    "LangGraph": "AI / GenAI",
}


def normalize_skill_name(skill: str) -> str:
    """Chuẩn hoá tên kỹ năng về dạng viết thường, loại bỏ khoảng trắng dư thừa."""
    return skill.strip().lower()


def get_parent_skill(skill: str) -> str | None:
    """Tra cứu kỹ năng/công nghệ cha trong bảng taxonomy tĩnh (case-insensitive)."""
    normalized = normalize_skill_name(skill)
    for child, parent in STATIC_TAXONOMY.items():
        if normalize_skill_name(child) == normalized:
            return parent
    return None


def get_child_skills(parent_skill: str) -> list[str]:
    """Lấy danh sách các kỹ năng con thuộc về kỹ năng cha."""
    normalized = normalize_skill_name(parent_skill)
    children = []
    for child, parent in STATIC_TAXONOMY.items():
        if normalize_skill_name(parent) == normalized:
            children.append(child)
    return children


def check_skill_match(candidate_skill: str, required_skill: str) -> tuple[bool, str | None]:
    """
    Kiểm tra xem kỹ năng của ứng viên có đáp ứng yêu cầu của JD không.
    Trả về (is_match, reason).
    """
    norm_c = normalize_skill_name(candidate_skill)
    norm_r = normalize_skill_name(required_skill)

    # 1. Trùng khớp trực tiếp
    if norm_c == norm_r:
        return True, "Trùng khớp trực tiếp"

    # 2. Ứng viên có kỹ năng con của yêu cầu JD (VD: CV có FastAPI -> thỏa mãn JD yêu cầu Python)
    parent_of_candidate = get_parent_skill(candidate_skill)
    if parent_of_candidate and normalize_skill_name(parent_of_candidate) == norm_r:
        return True, f"Thỏa mãn qua taxonomy: {candidate_skill} thuộc hệ sinh thái {parent_of_candidate}"

    # 3. JD yêu cầu kỹ năng cụ thể và ứng viên có kỹ năng cùng framework trong cùng hệ sinh thái
    # (VD: JD yêu cầu FastAPI, CV có Flask hoặc Django - cùng thuộc Python)
    parent_of_required = get_parent_skill(required_skill)
    if parent_of_candidate and parent_of_required:
        if normalize_skill_name(parent_of_candidate) == normalize_skill_name(parent_of_required):
            return True, f"Cùng nhóm công nghệ {parent_of_candidate} ({candidate_skill} ~ {required_skill})"

    # 4. JD yêu cầu kỹ năng con mà CV có kỹ năng cha tổng quát (VD: JD yêu cầu FastAPI, CV có Python)
    if parent_of_required and normalize_skill_name(candidate_skill) == normalize_skill_name(parent_of_required):
        return True, f"Thỏa mãn nền tảng: ứng viên có nền tảng {candidate_skill} ({required_skill})"

    return False, None


def apply_taxonomy_matching(cv_skills: list[str], jd_skills: list[str]) -> tuple[list[str], list[str], dict[str, str]]:
    """
    So khớp danh sách kỹ năng CV và JD có áp dụng bảng taxonomy tĩnh.

    Returns:
        matched_skills: Danh sách kỹ năng trong JD mà CV đáp ứng được.
        missing_skills: Danh sách kỹ năng trong JD mà CV còn thiếu.
        taxonomy_details: Ghi chú giải thích cho các trường hợp match qua taxonomy.
    """
    matched: set[str] = set()
    taxonomy_details: dict[str, str] = {}

    for req in jd_skills:
        req_clean = req.strip()
        for cand in cv_skills:
            cand_clean = cand.strip()
            is_match, reason = check_skill_match(cand_clean, req_clean)
            if is_match:
                matched.add(req_clean)
                if reason and (
                    "taxonomy" in reason.lower() or "nhóm" in reason.lower() or "nền tảng" in reason.lower()
                ):
                    taxonomy_details[req_clean] = f"{cand_clean} -> {req_clean} ({reason})"
                break

    matched_list = [req for req in jd_skills if req in matched]
    missing_list = [req for req in jd_skills if req not in matched]

    return matched_list, missing_list, taxonomy_details
