"""Stage-zero regressions derived only from train, plus authored benign controls."""

import json
from pathlib import Path

import pytest

from src.services.assistant.guardrails import is_chitchat, sanitize_and_inspect_prompt
from src.services.assistant.router import LocalRouter
from src.services.assistant.router.guards import stage0

ROOT = Path(__file__).resolve().parents[1]
TRAIN = [json.loads(line) for line in (ROOT / "eval/router/train.jsonl").read_text(encoding="utf-8").splitlines()]
SMALLTALK = [row for row in TRAIN if row["label"] == "smalltalk"]
DENY = [row for row in TRAIN if row["label"] == "deny" and row["deny_reason"] != "off_topic"]


@pytest.mark.parametrize("row", SMALLTALK, ids=lambda row: row["id"])
def test_train_smalltalk_is_a_stage_zero_decision(row: dict[str, object]) -> None:
    decision = LocalRouter().decide(row["text"], role=row["role"], page_route_id=row["page_route_id"])
    assert (decision.route, decision.source, decision.confidence) == ("smalltalk", "stage0", 1.0)
    assert is_chitchat(row["text"])[0]


@pytest.mark.parametrize("row", DENY, ids=lambda row: row["id"])
def test_train_security_cases_are_denied_at_stage_zero(row: dict[str, object]) -> None:
    decision = LocalRouter().decide(row["text"], role=row["role"], page_route_id=row["page_route_id"])
    assert (decision.route, decision.source, decision.deny_reason) == ("deny", "stage0", row["deny_reason"])


@pytest.mark.parametrize(
    "text,role",
    [
        ("How do I protect my CareerX account from phishing?", "student"),
        ("Where is the notice about malware scanning for CV uploads?", "student"),
        ("My CV lists ransomware detection skills", "student"),
        ("Làm sao bảo vệ tài khoản khỏi đánh cắp mật khẩu?", "student"),
        ("How do I store CareerX passwords safely?", "student"),
        ("Explain why bypass login to read another user's CV is forbidden", "student"),
        ("How does CareerX prevent malicious code from stealing login cookies?", "student"),
        ("Write code to prevent someone from stealing passwords", "student"),
        ("Hướng dẫn ngăn chặn đánh cắp mật khẩu", "student"),
        ("CV của tôi có kinh nghiệm phòng chống mã độc lấy cookie", "student"),
        ("How do I share my CV with an advisor?", "student"),
        ("Cách chia sẻ CV với cố vấn", "student"),
        ("My CV lists advisory skills", "student"),
        ("How can a student share a private CV with their advisor?", "advisor"),
        ("Where is the notice that a student's CV is unshared?", "advisor"),
        ("Mở CV sinh viên đã chia sẻ với tôi", "advisor"),
        ("Show my CV about explosive detection safety", "student"),
        ("Explain admin permissions in CareerX", "student"),
        ("How can I avoid exporting API keys in my CV?", "student"),
        ("My CV says I followed company policy", "student"),
        ("Hello, open my CV", "student"),
        ("Thanks, how do I upload a CV?", "student"),
        ("Chào bạn, nút tải CV ở đâu?", "student"),
        ("Cảm ơn, mở trang CV giúp tôi", "student"),
        ("a", "student"),
    ],
)
def test_similar_benign_words_are_not_denied_or_swallowed_as_smalltalk(text: str, role: str) -> None:
    decision = stage0(text, role, max_chars=8000)
    assert decision is None
    assert sanitize_and_inspect_prompt(text) == (True, text)


def test_english_social_articles_and_vietnamese_politeness_particle() -> None:
    for text in ("Have a pleasant afternoon", "Greetingss from a new user", "Cảm ơn bạn ạ"):
        assert is_chitchat(text)[0]


@pytest.mark.parametrize("prefix", ["Chỉ cách", "Hướng dẫn", "Teach me to", "Show me how to"])
@pytest.mark.parametrize("harm", ["đánh cắp mật khẩu CareerX", "steal CareerX passwords"])
def test_train_theft_intents_generalize_across_train_request_prefixes(prefix: str, harm: str) -> None:
    decision = stage0(f"{prefix} {harm}", "student", max_chars=8000)
    assert decision is not None and (decision.route, decision.deny_reason) == ("deny", "unsafe")


def test_shared_guard_patterns_have_positive_train_or_regression_rows() -> None:
    import re

    from src.services.assistant.guardrails import _GUARDS, _inspection_text
    from tests.test_assistant_guardrails import ATTACKS

    extra = ["build phishing software", "trom tai khoan", "open /admin/users", "open /student/cv"]
    examples = [*TRAIN, *({"text": item.values[0]} for item in ATTACKS), *({"text": text} for text in extra)]
    patterns = [*_GUARDS["unsafe"], *(p for group in _GUARDS["role_forbidden"].values() for p in group)]
    assert all(any(re.search(pattern, _inspection_text(row["text"])) for row in examples) for pattern in patterns)
