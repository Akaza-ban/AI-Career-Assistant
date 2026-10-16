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
    LLM call #2 (PRD 5.2): Chuyên gia Cố vấn Kỹ thuật & Tuyển dụng (Senior Technical Recruiter)
    đánh giá toàn diện CV - JD, phân tách Presentation Gap vs Capability Gap, gợi ý viết lại
    chuẩn Google XYZ và dự đoán điểm nóng phỏng vấn.
    """
    context = "\n".join(f"- {doc.get('title', '')}: {doc.get('content', '')}" for doc in retrieved_context[:4])
    prompt = (
        "Bạn là Chuyên gia Tuyển dụng Kỹ thuật Cấp cao kiêm Cố vấn Nghề nghiệp (Senior Technical Recruiter & Career Coach).\n"
        "Nhiệm vụ của bạn là thẩm định mức độ tương thích thực tế giữa CV ứng viên và bản mô tả công việc (JD), "
        "đưa ra nhận xét sắc bén, phân loại chính xác khoảng cách (Gap) và hướng dẫn ứng viên tối ưu hồ sơ một cách liêm chính.\n\n"
        "=== CV CỦA ỨNG VIÊN (định dạng mỗi dòng: [số dòng|mục] nội dung) ===\n"
        f"{_cv_block(lines)}\n\n"
        "=== CÁC YÊU CẦU NĂNG LỰC TỪ JD (CÓ PHÂN CẤP QUAN TRỌNG) ===\n"
        f"{_requirements_block(requirements)}\n\n"
        "=== RUBRIC ĐÁNH GIÁ THỰC TẾ (BẮT BUỘC TUÂN THỦ) ===\n"
        "Nhà tuyển dụng không đánh giá dựa trên việc rải từ khóa (keyword stuffing) mà đánh giá dựa trên năng lực thực tiễn:\n"
        "- 0 (Chưa đáp ứng / Capability Gap): Kỹ năng hoàn toàn không xuất hiện hoặc không có cơ sở liên quan trong CV. "
        "Đây là LỖ HỔNG NĂNG LỰC THẬT SỰ (Capability Gap), giải pháp là lộ trình học tập/dự án thực hành, tuyệt đối không bịa câu sửa CV.\n"
        "- 0.5 (Mức nhận biết / Mới chỉ liệt kê từ khóa): Chỉ xuất hiện dưới dạng liệt kê danh mục từ khóa "
        "(mục Kỹ năng, Chứng chỉ, tóm tắt, hoặc dòng 'Technologies/Công nghệ' của dự án), chưa có câu mô tả hành động triển khai. "
        "Đây là KHOẢNG CÁCH TRÌNH BÀY (Presentation Gap), giải pháp là trau chuốt lại câu chữ bằng chứng cứ có thật.\n"
        "- 0.75 (Mức cơ bản / Đồ án môn học / Dự án cá nhân): Đã có câu mô tả hành động triển khai cụ thể, nhưng "
        "chỉ ở quy mô đồ án môn học, bài tập thực hành hoặc dự án cá nhân nhỏ; CHƯA chứng minh được số liệu đo lường cụ thể "
        "hoặc khả năng giải quyết bài toán quy mô/tối ưu thực tế. ĐA SỐ sinh viên/fresher làm tốt bài tập trường lớp sẽ thuộc mức này.\n"
        "- 1 (Năng lực thực chiến xuất sắc / Production-ready): Có bằng chứng triển khai thực tế có chiều sâu, "
        "giải quyết bài toán có độ phức tạp cao, có số liệu đo lường kết quả (tối ưu hiệu năng, giảm thời gian, phục vụ người dùng) "
        "hoặc kinh nghiệm làm việc thực tế tại doanh nghiệp.\n\n"
        "=== NGUYÊN TẮC HOÀI NGHI NGHIỆP VỤ (CHỐNG LẠM PHÁT ĐIỂM / TRÁNH ĐIỂM 100 ẢO) ===\n"
        "- Trên hồ sơ CV giấy tờ, KHÔNG BAO GIỜ có ứng viên đạt 100% hoàn hảo tuyệt đối. Nhà tuyển dụng luôn duy trì sự hoài nghi nghiệp vụ.\n"
        "- TUYỆT ĐỐI KHÔNG dễ dãi cho điểm 1.0 cho tất cả kỹ năng. Nếu chỉ là bài tập, đồ án trường lớp thông thường mà chưa có số liệu đo lường "
        "thực chiến, HÃY CHẤM 0.75 để phản ánh đúng thực tế là sinh viên vẫn còn khoảng cách cần trau dồi trước khi ra môi trường làm việc thật.\n"
        "- Chỉ cho 1.0 khi ứng viên thực sự vượt trội và có bằng chứng thuyết phục.\n\n"
        "=== QUY TẮC PHÂN CẤP TRỌNG SỐ & TAXONOMY CÔNG NGHỆ ===\n"
        "- Yêu cầu Bắt buộc (Required): Là tiêu chí tiên quyết (Deal-breaker). Nếu ứng viên bị 0 hoặc 0.5 ở kỹ năng Bắt buộc, "
        "phải cảnh báo rõ nguy cơ bị loại hồ sơ trong note và summary.\n"
        "- Yêu cầu Ưu tiên (Preferred) & Điểm cộng (Additional): Là lợi thế cạnh tranh gia tăng điểm số.\n"
        "- Framework phản ánh ngôn ngữ nền tảng: FastAPI/Flask/Django tính là Python; PyTorch/TensorFlow tính là Machine Learning; "
        "React/Next.js/Vue/Angular tính là JavaScript/TypeScript; Spring Boot tính là Java.\n"
        "- Không ngộ nhận: nhắc tên công nghệ không đồng nghĩa với thành thạo nếu thiếu ngữ cảnh hành động.\n\n"
        "=== TIÊU CHUẨN THAM KHẢO ===\n"
        f"{context or '- Chỉ công nhận kỹ năng có bằng chứng thật và ngữ cảnh sử dụng trong CV.'}\n\n"
        "=== NHIỆM VỤ CỤ THỂ ===\n"
        "1. Chấm match (chọn một trong các giá trị: 0, 0.5, 0.75 hoặc 1) cho TỪNG yêu cầu của JD:\n"
        "   - evidence_lines: danh sách số dòng CV làm bằng chứng cụ thể (nếu match = 0 thì evidence_lines = []).\n"
        "   - note: nhận xét ngắn gọn, sắc bén bằng tiếng Việt (1-2 câu). Với match = 0, chỉ rõ Capability Gap; "
        "với match = 0.5, chỉ rõ Presentation Gap; với match = 0.75, ghi nhận làm được mức cơ bản/đồ án nhưng cần thêm số liệu/chiều sâu; "
        "với match = 1, nêu điểm sáng thực chiến xuất sắc.\n"
        f"2. Viết tối đa {MAX_SUGGESTIONS} gợi ý diễn đạt lại theo chuẩn Google XYZ (chỉ áp dụng cho yêu cầu có match > 0):\n"
        "   - Công thức: [Động từ hành động kỹ thuật mạnh] + [Bài toán / Tính năng cụ thể] + bằng cách sử dụng [Công nghệ / Phương pháp].\n"
        "   - RÀNG BUỘC ĐẠO ĐỨC & SỰ THẬT: Giữ đúng 100% sự thật từ dòng gốc! TUYỆT ĐỐI KHÔNG bịa đặt số liệu giả (như tự thêm 'tăng 20% doanh thu' "
        "hay 'xử lý 50.000 bản ghi'). Nếu câu gốc thiếu định lượng, có thể để gợi ý dạng placeholder: '[kết quả đo lường cụ thể]' để ứng viên tự điền thật.\n"
        "3. Viết nhận xét tổng quan (summary) khoảng 2–3 câu với văn phong Cố vấn nhân sự cao cấp:\n"
        "   - Đánh giá khách quan thế mạnh nổi bật nhất của ứng viên so với các yêu cầu cốt lõi (Required).\n"
        "   - Cảnh báo rõ ràng: 'Độ khớp từ khóa trên giấy tờ không đồng nghĩa với bảo đảm trúng tuyển; vòng phỏng vấn "
        "sẽ kiểm chứng gắt gao chiều sâu giải quyết bài toán và tính xác thực của kinh nghiệm.'\n"
        "   - Dự đoán 1 chủ đề kỹ thuật mà nhà tuyển dụng sẽ đào sâu phỏng vấn dựa trên các công nghệ có trong CV để ứng viên chuẩn bị trước.\n\n"
        "CHỈ trả về JSON hợp lệ theo schema sau, không thêm lời dẫn:\n"
        '{"requirements": [{"id": "r1", "match": 0.75, "evidence_lines": [5], "note": "Đã có kinh nghiệm xây dựng API trong đồ án môn học, cần bổ sung thêm số liệu đo lường hiệu năng."}], '
        '"suggestions": [{"requirement_id": "r1", "line": 5, "rewrite": "Thiết kế và tối ưu REST API xử lý dữ liệu đơn hàng bằng Python FastAPI", "reason": "Áp dụng động từ hành động mạnh và làm nổi bật công nghệ giải quyết bài toán"}], '
        '"summary": "Hồ sơ thể hiện nền tảng thực chiến tốt với các công nghệ cốt lõi như Python và FastAPI. Tuy nhiên, việc thiếu kinh nghiệm triển khai Docker (yêu cầu Bắt buộc) là rủi ro lớn cần bổ sung qua đồ án thực hành. Khi phỏng vấn, nhà tuyển dụng chắc chắn sẽ đào sâu về cơ chế xử lý bất đồng bộ (Async/Await) và tối ưu truy vấn cơ sở dữ liệu."}'
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
    if not (0.0 <= match <= 1.0):
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
