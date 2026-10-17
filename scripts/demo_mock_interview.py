import asyncio
import sys

# Thêm đường dẫn root vào sys.path để import src
sys.path.insert(0, ".")

# Thiết lập encoding UTF-8 cho Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from src.agents.interview.graph import interview_agent


async def run_interview_demo():
    from src.services.providers.gateway import initialize_gateway_runtime

    initialize_gateway_runtime()
    print("=" * 70)
    print("DEMO MOCK INTERVIEW AGENT (CHẤM ĐIỂM THEO RUBRIC STAR)")
    print("=" * 70)

    job_role = "Python Backend / AI Engineer"
    total_rounds = 3

    # VÒNG 1: Bắt đầu phỏng vấn
    print(f"\n[VÒNG 1/{total_rounds}] - Khởi tạo câu hỏi đầu tiên...")
    start_state = {
        "job_role": job_role,
        "current_round": 1,
        "total_rounds": total_rounds,
    }
    round1_init = await interview_agent.ainvoke(start_state)
    q1 = round1_init.get("current_question", "")
    print(f"Câu hỏi của AI: \"{q1}\"")

    # Giả lập câu trả lời của ứng viên cho Vòng 1
    answer1 = (
        "Trong dự án tốt nghiệp xây dựng nền tảng E-commerce với FastAPI và PostgreSQL, "
        "khi triển khai chạy thử nghiệm với 3000 người dùng đồng thời, hệ thống bị nghẽn ở endpoint checkout. "
        "Nhiệm vụ của tôi là tối ưu hóa tốc độ xử lý đơn hàng và giảm tải cho cơ sở dữ liệu. "
        "Tôi đã dùng cProfile để tìm bottleneck, sau đó thiết kế lại cơ chế caching với Redis (TTL 5 phút), "
        "đồng thời thêm composite index trên các cột trạng thái đơn hàng và dùng connection pool của asyncpg. "
        "Kết quả là latency giảm 70% từ 950ms xuống còn 140ms, hệ thống chịu tải mượt mà không còn bị timeout."
    )
    print(f"\n>> Ứng viên trả lời Vòng 1:\n\"{answer1}\"")
    print("\n... AI đang chấm điểm theo STAR Rubric (LLM Groq)...")

    round1_result = await interview_agent.ainvoke({
        "job_role": job_role,
        "user_answer": answer1,
        "current_round": 1,
        "total_rounds": total_rounds,
        "current_question": q1,
    })

    print("-" * 50)
    print(f"Điểm Situation (Bối cảnh):  {round1_result['situation_score']} / 5.0")
    print(f"Điểm Task (Nhiệm vụ):       {round1_result['task_score']} / 5.0")
    print(f"Điểm Action (Hành động):    {round1_result['action_score']} / 5.0")
    print(f"Điểm Result (Kết quả):      {round1_result['result_score']} / 5.0")
    print(f"Đánh giá chi tiết:\n{round1_result['feedback_text']}")
    print("-" * 50)

    q2 = round1_result.get("next_question")
    print(f"\n[VÒNG 2/{total_rounds}] - Câu hỏi tiếp theo do AI sinh ra:")
    print(f"\"{q2}\"")

    # Giả lập VÒNG 3 (VÒNG CUỐI CÙNG)
    print("\n" + "=" * 70)
    print(f"[VÒNG 3/{total_rounds} - VÒNG CUỐI] - Kiểm tra điều kiện kết thúc phỏng vấn...")
    answer3 = (
        "Khi làm việc nhóm, tôi và bạn Tech Lead có bất đồng về việc dùng GraphQL hay REST API. "
        "Để thuyết phục, tôi đã chủ động xây dựng PoC nhỏ đo đạc latency, kích thước payload và công sức bảo trì. "
        "Sau buổi demo số liệu thực tế, cả nhóm đã thống nhất chọn REST API kết hợp OpenAPI doc. "
        "Dự án được bàn giao trước hạn 3 ngày với độ hài lòng cao."
    )
    print(f">> Ứng viên trả lời Vòng 3:\n\"{answer3}\"")
    print("\n... AI đang chấm điểm vòng cuối...")

    round3_result = await interview_agent.ainvoke({
        "job_role": job_role,
        "user_answer": answer3,
        "current_round": 3,
        "total_rounds": total_rounds,
        "current_question": "Hãy kể về tình huống bạn giải quyết bất đồng kỹ thuật với đồng đội?",
    })

    print("-" * 50)
    print(f"Điểm Situation: {round3_result['situation_score']} / 5.0")
    print(f"Điểm Task:      {round3_result['task_score']} / 5.0")
    print(f"Điểm Action:    {round3_result['action_score']} / 5.0")
    print(f"Điểm Result:    {round3_result['result_score']} / 5.0")
    print(f"Câu hỏi tiếp theo: {round3_result['next_question']} (None/null vì đã hết vòng)")
    print(f"Đã hoàn thành phỏng vấn (is_finished): {round3_result['is_finished']}")
    print("=" * 70)
    print("KẾT THÚC DEMO THÀNH CÔNG!")


if __name__ == "__main__":
    asyncio.run(run_interview_demo())
