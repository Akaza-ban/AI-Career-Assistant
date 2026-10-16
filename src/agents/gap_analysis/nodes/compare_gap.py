import logging
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.llm import invoke_json, llm_configured
from src.services.skill_matching import (
    IMPORTANCE_LABELS,
    SECTION_LABELS,
    assess_by_rules,
    assessment,
    lift_parents,
)

logger = logging.getLogger(__name__)

# PRD mục 5.2: tối đa 2 lệnh gọi LLM cho một lượt phân tích
MAX_LLM_CALLS = 2
# Giới hạn độ dài CV gửi cho LLM (CV 1–2 trang thường chỉ 3.000–6.000 ký tự)
MAX_CV_CHARS = 12_000
MAX_SUGGESTIONS = 5


def _cv_block(lines: list[dict[str, Any]]) -> str:
    out, total = [], 0
    for line in lines:
        row = f"[{line['line_no']}|{SECTION_LABELS.get(line['section'], line['section'])}] {line['text']}"
        total += len(row)
        if total > MAX_CV_CHARS:
            break
        out.append(row)
    return "\n".join(out)


def _requirements_block(requirements: list[dict[str, Any]]) -> str:
    rows = []
    for r in requirements:
        aliases = f" — tên tương đương: {', '.join(r['aliases'])}" if r.get("aliases") else ""
        rows.append(f"{r['id']}. {r['name']} ({IMPORTANCE_LABELS[r['importance']]}){aliases}")
    return "\n".join(rows)


async def score_with_llm(
    lines: list[dict[str, Any]],
    requirements: list[dict[str, Any]],
    retrieved_context: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    LLM call #2 (PRD 5.2): chấm Match cho TOÀN BỘ yêu cầu trong một lần gọi (batch) theo bảng anchor,
    kèm dòng bằng chứng và gợi ý diễn đạt lại. Nhận xét tổng quan ghép bằng quy tắc từ bảng cuối (fit_summary)
    để luôn khớp với bảng.
    """
    context = "\n".join(f"- {doc.get('title', '')}: {doc.get('content', '')}" for doc in retrieved_context[:4])
    prompt = (
        "Bạn là chuyên gia tuyển dụng cao cấp (Senior Technical Recruiter), đánh giá mức độ tương thích thực tế "
        "giữa CV ứng viên và bản mô tả công việc (JD) theo rubric tuyển dụng chặt chẽ và khách quan.\n\n"
        "=== CV CỦA ỨNG VIÊN (định dạng mỗi dòng: [số dòng|mục] nội dung) ===\n"
        f"{_cv_block(lines)}\n\n"
        "=== CÁC YÊU CẦU NĂNG LỰC TỪ JD ===\n"
        f"{_requirements_block(requirements)}\n\n"
        "=== RUBRIC ĐÁNH GIÁ THỰC TẾ (BẮT BUỘC TUÂN THỦ) ===\n"
        "Nhà tuyển dụng không đánh giá dựa trên việc rải từ khóa (keyword stuffing) mà đánh giá dựa trên năng lực thực tiễn:\n"
        "- 0 (Chưa đáp ứng): Kỹ năng hoàn toàn không xuất hiện hoặc không có cơ sở liên quan trong CV.\n"
        "- 0.5 (Đáp ứng một phần / Mức nhận biết): Chỉ xuất hiện dưới dạng liệt kê danh mục từ khóa (mục Kỹ năng, "
        "Chứng chỉ, tóm tắt, hoặc dòng 'Technologies/Công nghệ' của dự án), hoặc chỉ là bài tập lý thuyết/đồ án môn học "
        "cơ bản chưa chứng minh được chiều sâu triển khai.\n"
        "- 1 (Đáp ứng tốt / Năng lực thực chiến): Có câu mô tả hành động cụ thể trong Kinh nghiệm / Dự án / Hoạt động, "
        "nêu rõ ứng viên đã dùng kỹ năng đó để giải quyết bài toán gì hoặc xây dựng tính năng/hệ thống nào.\n\n"
        "=== QUY TẮC PHẢN ÁNH NĂNG LỰC (TAXONOMY & THỰC TIỄN) ===\n"
        "- Framework cụ thể phản ánh ngôn ngữ nền tảng: FastAPI/Flask/Django tính là Python; PyTorch/TensorFlow tính là "
        "Machine Learning; React/Next.js/Vue/Angular tính là JavaScript/TypeScript; Spring Boot tính là Java.\n"
        "- Không ngộ nhận: nhắc tên công nghệ không đồng nghĩa với thành thạo nếu thiếu ngữ cảnh hành động.\n\n"
        "=== TIÊU CHUẨN THAM KHẢO ===\n"
        f"{context or '- Chỉ công nhận kỹ năng có bằng chứng thật và ngữ cảnh sử dụng trong CV.'}\n\n"
        "=== NHIỆM VỤ ===\n"
        "1. Chấm match (chỉ nhận một trong ba giá trị 0, 0.5 hoặc 1) cho TỪNG yêu cầu của JD:\n"
        "   - evidence_lines: danh sách số dòng CV làm bằng chứng cụ thể (nếu match = 0 thì evidence_lines = []).\n"
        "   - note: nhận xét ngắn gọn, sắc bén và mang tính xây dựng bằng tiếng Việt (tối đa 1-2 câu). Với match = 0, "
        "chỉ ra định hướng học tập/bổ sung; với match = 0.5, chỉ ra cần làm rõ thêm bối cảnh gì; với match = 1, "
        "nêu điểm nổi bật ứng viên đã làm được. Tuyệt đối không ghi số điểm thô vào note.\n"
        f"2. Viết tối đa {MAX_SUGGESTIONS} gợi ý diễn đạt lại chuyên nghiệp (action-oriented rewrites) cho các dòng CV "
        "thuộc Kinh nghiệm / Dự án / Học vấn / Hoạt động (chỉ áp dụng cho yêu cầu có match > 0):\n"
        "   - RÀNG BUỘC ĐẠO ĐỨC: Giữ đúng sự thật! Chỉ trau chuốt hành động, ngữ cảnh kỹ thuật; TUYỆT ĐỐI KHÔNG bịa đặt "
        "số liệu, quy mô, công nghệ hoặc thành tích không có trong dòng gốc; không viết câu cho kỹ năng CV chưa có.\n"
        "3. Viết nhận xét tổng quan (summary) ngắn gọn (khoảng 2–3 câu) với văn phong cố vấn nhân sự cao cấp, "
        "tự nhiên, mạch lạc và tinh tế:\n"
        "   - Ghi nhận những điểm sáng/thế mạnh công nghệ nổi bật mà CV đã chứng minh được.\n"
        "   - Đưa ra lời khuyên thiết thực để chuẩn bị cho vòng phỏng vấn hoặc gợi ý hoàn thiện lỗ hổng kỹ thuật (tránh lặp từ máy móc như 'đáp ứng tốt... đáp ứng rất tốt').\n\n"
        "CHỈ trả về JSON hợp lệ theo schema sau, không thêm lời dẫn:\n"
        '{"requirements": [{"id": "r1", "match": 1, "evidence_lines": [5], "note": "Đã ứng dụng xây dựng API xử lý dữ liệu thực tế."}], '
        '"suggestions": [{"requirement_id": "r1", "line": 5, "rewrite": "...", "reason": "Làm nổi bật kỹ thuật và hành động cụ thể"}], '
        '"summary": "Hồ sơ thể hiện nền tảng vững chắc với các công nghệ cốt lõi như Python, FastAPI và Docker. Tuy nhiên, nhà tuyển dụng sẽ kiểm chứng kỹ chiều sâu giải quyết bài toán trong vòng phỏng vấn, bạn nên chuẩn bị kỹ các tình huống thực tế đã triển khai."}'
    )
    # temperature 0: cùng CV và JD thì chấm lại ra cùng kết quả nhiều nhất có thể
    return await invoke_json(prompt, temperature=0.0, timeout=60.0)


def _merge(
    requirement: dict[str, Any],
    rule: dict[str, Any],
    llm_item: dict[str, Any] | None,
    lines_by_no: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """Ưu tiên 100% đánh giá chuyên môn của AI khi có LLM; nếu LLM không khả dụng thì fallback sang quy tắc."""
    if llm_item is None:
        return rule
    try:
        match = float(llm_item.get("match", 0))
    except (TypeError, ValueError):
        return rule
    if match not in (0, 0.5, 1):
        return rule

    evidence_lines = []
    for n in llm_item.get("evidence_lines") or []:
        try:
            evidence_lines.append(lines_by_no[int(n)])
        except (KeyError, TypeError, ValueError):
            continue
    evidence_lines = [line for line in evidence_lines if not line.get("is_heading")]
    note = str(llm_item.get("note") or "").strip() or None

    if match == 0:
        return assessment(requirement, 0, None, note or rule["note"], "llm")

    line = evidence_lines[0] if evidence_lines else rule.get("evidence")
    return assessment(requirement, match, line, note or rule["note"], "llm")


async def compare_gap_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 3: Compare — chấm Match từng yêu cầu JD với bằng chứng trong CV (PRD 5.2).
    Dùng LLM một lần cho cả danh sách (batch), kiểm tra chéo bằng quy tắc; không có LLM thì chấm hoàn toàn bằng quy tắc.
    """
    lines = state.get("cv_lines", [])
    requirements = state.get("requirements", [])
    llm_calls = state.get("llm_calls", 0)
    rule_results = {r["id"]: assess_by_rules(r, lines) for r in requirements}

    llm_data: dict[str, Any] | None = None
    if requirements and llm_configured():
        # Thử lại một lần nếu còn trong hạn mức 2 lệnh gọi
        while llm_data is None and llm_calls < MAX_LLM_CALLS:
            llm_calls += 1
            try:
                llm_data = await score_with_llm(lines, requirements, state.get("retrieved_context", []))
            except Exception as e:
                logger.warning("Chấm Match bằng LLM thất bại (lần %d): %s", llm_calls, e)

    llm_items = {}
    if llm_data:
        for item in llm_data.get("requirements") or []:
            if isinstance(item, dict) and item.get("id"):
                llm_items[str(item["id"])] = item

    lines_by_no = {line["line_no"]: line for line in lines}
    assessments = [_merge(r, rule_results[r["id"]], llm_items.get(r["id"]), lines_by_no) for r in requirements]
    assessments = lift_parents(requirements, assessments, lines_by_no)

    matched = [a["skill"] for a in assessments if a["match"] > 0]
    missing = [a["skill"] for a in assessments if a["match"] == 0]
    taxonomy_matches = {a["skill"]: a["note"] for a in assessments if a["note"] and "taxonomy" in a["note"]}
    raw_suggestions = [s for s in (llm_data or {}).get("suggestions") or [] if isinstance(s, dict)]
    llm_summary = str((llm_data or {}).get("summary") or "").strip() or None

    return {
        "assessments": assessments,
        "raw_suggestions": raw_suggestions,
        "llm_summary": llm_summary,
        "llm_used": llm_data is not None,
        "llm_calls": llm_calls,
        # Giữ các trường cũ cho script demo và báo cáo eval
        "matched_skills": matched,
        "missing_skills": missing,
        "taxonomy_matches": taxonomy_matches,
    }
