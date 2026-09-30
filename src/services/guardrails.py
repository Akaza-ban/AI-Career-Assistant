import re

# Danh sách từ khoá hoặc mẫu câu cấm / prompt injection cơ bản
INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"system override",
    r"jailbreak",
    r"reveal your system prompt",
    r"drop database",
]


def check_input_safety(text: str) -> tuple[bool, str]:
    """Kiểm tra an toàn đầu vào (Input Guardrail) - chống Prompt Injection và nội dung độc hại."""
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            return False, f"Phát hiện nội dung không hợp lệ hoặc nghi vấn injection: {pattern}"
    return True, "Input an toàn"


def check_output_grounding(output: str, source_context: str, threshold: float = 0.2) -> tuple[bool, float]:
    """
    Kiểm tra mức độ bám sát ngữ cảnh nguồn của kết quả (Output Guardrail - Grounding / Hallucination Check).
    Trả về (is_grounded, grounding_score).
    """
    if not output.strip():
        return True, 1.0

    if not source_context.strip():
        # Nếu không có context nguồn để đối chiếu, gán điểm cơ bản
        return True, 0.5

    # Đơn giản hóa: tính độ trùng lặp từ khóa / token n-gram giữa context và output
    output_words = set(re.findall(r"\w+", output.lower()))
    context_words = set(re.findall(r"\w+", source_context.lower()))

    if not output_words:
        return True, 1.0

    overlap = output_words.intersection(context_words)
    score = len(overlap) / len(output_words)

    is_grounded = score >= threshold
    return is_grounded, round(score, 2)
