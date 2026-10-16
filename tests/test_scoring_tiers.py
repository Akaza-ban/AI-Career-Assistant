"""Chấm 4 mức (0 / 0,5 / 0,75 / 1) có kiểm tra chéo bằng quy tắc, chủ đề phỏng vấn và chấm STAR."""

import pytest

from src.agents.gap_analysis.nodes.compare_gap import _interview_focus, _merge
from src.agents.gap_analysis.nodes.generate_suggestions import build_suggestions
from src.agents.interview.nodes import score_answer
from src.agents.interview.nodes.score_answer import STARScoreOutput, evaluate_answer_fallback, score_answer_node
from src.services.fit_summary import compose_summary
from src.services.skill_matching import (
    assess_by_rules,
    assessment,
    evidence_level,
    normalize_requirements,
    split_cv_lines,
)

CV = """EXPERIENCE
ABC Corp 06/2024 - 08/2024
Viết API đặt lịch bằng FastAPI cho phòng khám.
PROJECTS
Library App 2023
Xây dựng ứng dụng quản lý thư viện bằng React.
Tối ưu truy vấn SQL giúp giảm 40% thời gian tải trang.
SKILLS
Docker, Git
"""


def setup(names: list[str]):
    lines = split_cv_lines(CV)
    reqs = normalize_requirements([{"name": n, "importance": "required"} for n in names])
    return lines, reqs, {line["line_no"]: line for line in lines}


def line_no(lines, text: str) -> int:
    return next(line["line_no"] for line in lines if text in line["text"])


def test_rule_levels_follow_evidence():
    lines, reqs, _ = setup(["FastAPI", "React", "SQL", "Docker", "Kubernetes"])
    got = {r["name"]: assess_by_rules(r, lines) for r in reqs}
    # Kinh nghiệm làm việc hoặc có số liệu → 1; mô tả trong dự án chưa có số liệu → 0,75; chỉ liệt kê → 0,5
    assert {k: v["match"] for k, v in got.items()} == {
        "FastAPI": 1,
        "React": 0.75,
        "SQL": 1,
        "Docker": 0.5,
        "Kubernetes": 0,
    }
    assert got["React"]["status"] == "matched" and "số liệu" in got["React"]["note"]
    assert got["Docker"]["status"] == "partial"
    # Năm / tháng không tính là số liệu kết quả
    assert evidence_level(next(line for line in lines if line["text"] == "Library App 2023")) == 0.75


def test_llm_score_is_capped_by_evidence_and_cross_checked():
    lines, reqs, by_no = setup(["React", "Docker", "FastAPI"])
    react, docker, fastapi = reqs
    rule = {r["id"]: assess_by_rules(r, lines) for r in reqs}

    # LLM chấm 1 cho dòng mô tả chưa có số liệu → hạ về 0,75
    item = {"match": 1, "evidence_lines": [line_no(lines, "React")], "note": ""}
    assert _merge(react, rule[react["id"]], item, by_no)["match"] == 0.75
    # LLM chấm 1 cho dòng chỉ liệt kê → hạ về 0,5, ghi chú cố định
    item = {"match": 1, "evidence_lines": [line_no(lines, "Docker")], "note": "Rất tốt"}
    merged = _merge(docker, rule[docker["id"]], item, by_no)
    assert merged["match"] == 0.5 and merged["note"] == rule[docker["id"]]["note"]
    # Số lẻ ngoài 4 mức, hoặc LLM chấm 0 khi CV có ghi rõ → dùng kết quả quy tắc
    assert _merge(fastapi, rule[fastapi["id"]], {"match": 0.6, "evidence_lines": [3]}, by_no) is rule[fastapi["id"]]
    assert _merge(fastapi, rule[fastapi["id"]], {"match": 0, "evidence_lines": []}, by_no) is rule[fastapi["id"]]
    # LLM cho là chỉ liệt kê thì giữ 0,5; còn 0,75 hay 1 do dòng bằng chứng quyết định (kinh nghiệm làm việc → 1)
    item = {"match": 0.5, "evidence_lines": [line_no(lines, "FastAPI")], "note": ""}
    assert _merge(fastapi, rule[fastapi["id"]], item, by_no)["match"] == 0.5
    item = {"match": 0.75, "evidence_lines": [line_no(lines, "FastAPI")], "note": ""}
    assert _merge(fastapi, rule[fastapi["id"]], item, by_no)["match"] == 1


def test_interview_focus_must_name_a_described_jd_skill():
    lines, reqs, _ = setup(["React", "Docker", "Kubernetes"])
    rows = [assess_by_rules(r, lines) for r in reqs]
    focus = "Nhà tuyển dụng có thể hỏi sâu về **React**: chuẩn bị kể cách bạn chia component trong Library App."
    assert _interview_focus(focus, reqs, rows) == focus.replace("**", "")
    # Kỹ năng mới liệt kê tên, CV không có, ngoài JD, hoặc quá dài → bỏ
    assert _interview_focus("Chuẩn bị kể về Docker.", reqs, rows) is None
    assert _interview_focus("Chuẩn bị kể về Kubernetes.", reqs, rows) is None
    assert _interview_focus("Chuẩn bị kể về Git.", reqs, rows) is None
    assert _interview_focus("React " + "rất dài " * 60, reqs, rows) is None
    assert _interview_focus(None, reqs, rows) is None


def test_rewrite_that_drops_real_numbers_is_discarded():
    lines, reqs, _ = setup(["SQL", "React"])
    rows = [assess_by_rules(r, lines) for r in reqs]
    sql, react = line_no(lines, "SQL"), line_no(lines, "React")
    raw = [
        {"requirement_id": reqs[0]["id"], "line": sql, "rewrite": "Tối ưu truy vấn SQL, giảm [thời gian] tải trang."},
        {
            "requirement_id": reqs[1]["id"],
            "line": react,
            "rewrite": "Phát triển ứng dụng quản lý thư viện bằng React, đạt [kết quả đo được].",
        },
    ]
    kept = build_suggestions(raw, rows, lines)
    assert [s["line_no"] for s in kept] == [react]
    # Dòng tiếng Việt bị dịch sang tiếng Anh → bỏ
    translated = [{**raw[1], "rewrite": "Built a library management app with React."}]
    assert build_suggestions(translated, rows, lines) == []
    # Dòng tiếng Anh bị dịch sang tiếng Việt → bỏ
    lines = split_cv_lines("PROJECTS\nLibrary App 2023\nBuilt a library management app with React.\n")
    reqs = normalize_requirements([{"name": "React", "importance": "required"}])
    rows = [assess_by_rules(reqs[0], lines)]
    raw = [
        {"requirement_id": reqs[0]["id"], "line": line_no(lines, "React"), "rewrite": "Xây dựng ứng dụng bằng React."}
    ]
    assert build_suggestions(raw, rows, lines) == []
    raw[0]["rewrite"] = "Developed a library management web app with React, achieving [measurable result]."
    assert len(build_suggestions(raw, rows, lines)) == 1


def test_interview_focus_strips_internal_ids():
    lines, reqs, _ = setup(["React"])
    rows = [assess_by_rules(r, lines) for r in reqs]
    assert _interview_focus("Chuẩn bị kể về React (r1) trong Library App.", reqs, rows) == (
        "Chuẩn bị kể về React trong Library App."
    )


def test_summary_mentions_metrics_and_outlook():
    lines, reqs, _ = setup(["FastAPI", "React"])
    rows = [assess_by_rules(r, lines) for r in reqs]
    summary = compose_summary(rows, lines)
    assert summary.startswith("Đáp ứng tốt: FastAPI, React. Với React, thêm kết quả đo được")
    assert "vòng phỏng vấn" in summary

    lines, reqs, _ = setup(["Kubernetes", "Go", "Kafka"])
    summary = compose_summary([assess_by_rules(r, lines) for r in reqs], lines)
    assert summary.startswith("Còn thiếu 3 yêu cầu Bắt buộc: Kubernetes, Go, Kafka.")
    assert "dự án nhỏ" in summary and "vòng phỏng vấn" not in summary


def test_star_fallback_uses_role_neutral_signals():
    personal = (
        "Trong đợt thực tập marketing ở công ty ABC, em phụ trách fanpage của cửa hàng. Em lên lịch đăng bài hằng "
        "tuần và viết nội dung theo từng nhóm khách hàng. Em theo dõi lượt tương tác mỗi tối để chỉnh nội dung. "
        "Sau hai tháng lượt theo dõi tăng 35% và có thêm 120 đơn hàng."
    )
    team = (
        "Trong đợt thực tập marketing ở công ty ABC, nhóm em phụ trách fanpage của cửa hàng. Nhóm em lên lịch đăng "
        "bài hằng tuần và viết nội dung theo từng nhóm khách hàng. Chúng em theo dõi lượt tương tác mỗi tối. "
        "Sau hai tháng lượt theo dõi tăng 35% và có thêm 120 đơn hàng."
    )
    a = evaluate_answer_fallback(personal, "Marketing Intern", 1, 3)
    b = evaluate_answer_fallback(team, "Marketing Intern", 1, 3)
    assert a.task_score > b.task_score
    assert a.result_score >= 3.5
    assert "riêng bạn" in b.feedback_text.splitlines()[1]
    assert max(a.situation_score, a.task_score, a.action_score, a.result_score) <= 4.0

    # Câu trả lời quá ngắn hoặc chỉ liệt kê từ khoá → điểm thấp, không cộng vì từ khoá
    stuffed = evaluate_answer_fallback("Python, SQL, Docker, triển khai, tối ưu, kết quả.", "Backend Intern", 1, 3)
    assert max(stuffed.situation_score, stuffed.task_score, stuffed.action_score, stuffed.result_score) <= 1.0
    listed = evaluate_answer_fallback(
        "Em có kiến thức về SEO, SEM, Google Ads, Facebook Ads, TikTok, KOL, KPI, ROI, CTR, A/B testing, Canva, "
        "content marketing, branding, insight khách hàng và 4P. Em rất sáng tạo.",
        "Marketing Intern",
        1,
        3,
    )
    assert max(listed.situation_score, listed.task_score, listed.action_score, listed.result_score) <= 1.5
    assert "liệt kê" in listed.feedback_text.splitlines()[1]
    no_metric = evaluate_answer_fallback(personal.replace("35%", "nhiều").replace("120", "thêm"), "Marketing", 1, 3)
    assert no_metric.result_score < a.result_score


@pytest.mark.asyncio
async def test_team_only_answer_caps_task_and_action(monkeypatch):
    async def generous(*args, **kwargs):
        return STARScoreOutput(
            situation_score=4, task_score=4.5, action_score=4.5, result_score=4, feedback_text="Điểm tốt: rõ ràng."
        )

    monkeypatch.setattr(score_answer, "score_answer_with_llm", generous)
    state = {"job_role": "Marketing Intern", "current_round": 1, "total_rounds": 3, "current_question": "Kể về..."}
    team = await score_answer_node({**state, "user_answer": "Nhóm em làm poster và chúng em đăng bài lên các group."})
    assert (team["task_score"], team["action_score"], team["situation_score"]) == (3.0, 3.0, 4)
    mine = await score_answer_node({**state, "user_answer": "Nhóm em làm sự kiện, em phụ trách thiết kế poster."})
    assert (mine["task_score"], mine["action_score"]) == (4.5, 4.5)


def test_placeholder_rules_for_rewrites():
    lines, reqs, _ = setup(["React", "SQL"])
    rows = [assess_by_rules(r, lines) for r in reqs]
    react = line_no(lines, "React")
    ok = {
        "requirement_id": reqs[0]["id"],
        "line": react,
        "rewrite": "Phát triển ứng dụng quản lý thư viện bằng React, đạt [kết quả đo được].",
    }
    claimed = {
        **ok,
        "rewrite": "Phát triển ứng dụng quản lý thư viện bằng React, giảm thời gian tải xuống [thời gian].",
    }
    assert len(build_suggestions([ok], rows, lines)) == 1
    assert build_suggestions([claimed], rows, lines) == []
    # Dòng đã có số liệu: viết rõ hơn thì giữ, thêm chỗ trống thì bỏ
    sql = line_no(lines, "SQL")
    clearer = {
        "requirement_id": reqs[1]["id"],
        "line": sql,
        "rewrite": "Viết lại truy vấn SQL, giảm 40% thời gian tải trang.",
    }
    padded = {**clearer, "rewrite": "Tối ưu truy vấn SQL giúp giảm 40% thời gian tải trang, đạt [kết quả đo được]."}
    assert len(build_suggestions([clearer], rows, lines)) == 1
    assert build_suggestions([padded], rows, lines) == []


def test_rewrite_adding_tools_not_in_cv_is_discarded():

    from src.services.cv_rewrite import new_names

    lines, reqs, _ = setup(["React"])
    cv = CV
    assert new_names("Phát triển giao diện bằng React và Redux, triển khai trên AWS.", cv) == ["Redux", "AWS"]
    assert new_names("Xây dựng Library App bằng React, đạt [kết quả đo được]", cv) == []
    rows = [assess_by_rules(reqs[0], lines)]
    raw = [
        {
            "requirement_id": reqs[0]["id"],
            "line": line_no(lines, "React"),
            "rewrite": "Xây dựng giao diện bằng React và Redux.",
        }
    ]
    assert build_suggestions(raw, rows, lines) == []


def test_interview_focus_never_mentions_internal_scores():
    lines, reqs, _ = setup(["React"])
    rows = [assess_by_rules(reqs[0], lines)]
    assert _interview_focus("Chuẩn bị kể về React, kỹ năng được chấm 0.75.", reqs, rows) is None
    assert _interview_focus("React có match cao, nên chuẩn bị kể kỹ.", reqs, rows) is None


def test_tools_must_come_from_the_same_cv_entry():
    cv = (
        "PROJECTS\nLibrary App 2023\nTechnologies: React, Firebase\nXây dựng giao diện quản lý mượn trả sách cho thư viện.\n"
        "Chat App 2024\nThiết kế màn hình nhắn tin theo thời gian thực cho sinh viên.\nSKILLS\nPython, SQL\n"
    )
    lines = split_cv_lines(cv)
    reqs = normalize_requirements([{"name": "React", "importance": "required"}])
    rows = [assessment(reqs[0], 0.75, lines[3], None, "llm")]
    library, chat = line_no(lines, "mượn trả"), line_no(lines, "nhắn tin")
    same_entry = {
        "requirement_id": reqs[0]["id"],
        "line": library,
        "rewrite": "Xây dựng giao diện mượn trả sách bằng React.",
    }
    other_entry = {**same_entry, "line": chat, "rewrite": "Thiết kế màn hình nhắn tin bằng React."}
    from_skills = {**same_entry, "rewrite": "Xây dựng giao diện mượn trả sách bằng Python."}
    assert len(build_suggestions([same_entry], rows, lines)) == 1
    assert build_suggestions([other_entry], rows, lines) == []
    assert build_suggestions([from_skills], rows, lines) == []


def test_placeholder_follows_line_language():
    from src.services.cv_rewrite import with_placeholder_of as _with_placeholder_of

    assert _with_placeholder_of("Built the app, achieving [kết quả đo được]", "Built the app with React") == (
        "Built the app, achieving [measurable result]"
    )
    assert _with_placeholder_of("Xây dựng app, đạt [measurable result]", "Xây dựng app bằng React").endswith(
        "[kết quả đo được]"
    )
    assert _with_placeholder_of("Xay dung app, dat [kết quả đo được]", "Xay dung app bang React").endswith(
        "[ket qua do duoc]"
    )
