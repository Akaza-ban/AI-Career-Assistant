# Kịch bản Quay Video Demo Day

## 1. Giới thiệu tổng quan (1 - 2 phút)
- Giới thiệu thành viên team & bài toán giải quyết.
- Tổng quan kiến trúc hệ thống: Multi-agent LangGraph (Gap Analysis + Mock Interview), Qdrant Vector DB, Guardrails.

## 2. Luồng 1: Phân tích khoảng cách CV - JD (Gap Analysis Agent)
- Tải lên CV ứng viên và mô tả công việc (JD).
- Hệ thống trích xuất thông tin kỹ năng, đối chiếu qua taxonomy & truy xuất RAG.
- Xuất báo cáo matched/missing skills và gợi ý cải thiện có kiểm định Grounding.

## 3. Luồng 2: Phỏng vấn thử (Mock Interview Agent)
- Agent sinh câu hỏi phỏng vấn dựa trên JD và các kỹ năng của ứng viên.
- Ứng viên trả lời phỏng vấn.
- Agent chấm điểm theo phương pháp STAR và đưa ra nhận xét chi tiết.

## 4. Tổng kết & Q&A
- Hiệu năng hệ thống (Latency, Recall@k, Guardrails pass rate).
- Bài học rút ra và hướng phát triển tiếp theo.
