import asyncio
import json
from pathlib import Path
import sys

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Đưa thư mục gốc dự án vào PYTHONPATH
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.agents.gap_analysis.graph import gap_analysis_agent


async def main():
    from src.services.providers.gateway import initialize_gateway_runtime

    initialize_gateway_runtime()
    print("=" * 70)
    print("🎯 CHẠY THỬ NGHIỆM CV GAP-ANALYSIS AGENT (TÍCH HỢP LLM)")
    print("=" * 70)

    # Đọc sample CV và sample JD
    cv_path = Path("data/cv_samples/sample_cv_1.md")
    jd_path = Path("data/jd_samples.json")

    if not cv_path.exists() or not jd_path.exists():
        print("❌ Không tìm thấy file dữ liệu mẫu trong thư mục data/")
        return

    with open(cv_path, encoding="utf-8") as f:
        cv_text = f.read().strip()

    with open(jd_path, encoding="utf-8") as f:
        jds = json.load(f)
        target_jd = jds[0]
        jd_text = (
            f"Vị trí: {target_jd.get('title', '')}\n"
            f"Mô tả: {target_jd.get('description', '')}\n"
            f"Kỹ năng yêu cầu: {', '.join(target_jd.get('required_skills', []))}"
        )

    print("\n📄 [1. DỮ LIỆU ĐẦU VÀO]")
    print("--- CV Ứng viên ---")
    print(cv_text)
    print("\n--- JD Tuyển dụng mục tiêu ---")
    print(jd_text)

    print("\n🤖 [2. ĐANG GỌI AI LLM QUA LANGGRAPH (parse -> retrieve -> compare -> generate)]...")
    result = await gap_analysis_agent.ainvoke({"cv_raw": cv_text, "jd_raw": jd_text})

    print("\n✅ [3. KẾT QUẢ ĐỐI CHIẾU KỸ NĂNG]")
    print(f"🔹 Kỹ năng khớp (Matched): {result.get('matched_skills')}")
    print(f"🔸 Kỹ năng thiếu (Missing): {result.get('missing_skills')}")

    tax_matches = result.get("taxonomy_matches", {})
    if tax_matches:
        print("\n🧠 [4. ÁNH XẠ QUA TAXONOMY TĨNH]")
        for req_skill, note in tax_matches.items():
            print(f"  • {req_skill}: {note}")

    print("\n💡 [5. GỢI Ý DO AI TỐI ƯU CÂU CHỮ (KÈM EVIDENCE SPAN)]")
    suggestions = result.get("suggestions", [])
    if not suggestions:
        print("  (Không có gợi ý)")
    for idx, s in enumerate(suggestions, 1):
        print(f"\n  [Gợi ý #{idx}] Kỹ năng: {s.get('skill')}")
        print(f"   📌 Evidence span (Trích từ CV gốc): \"{s.get('evidence_span')}\"")
        print(f"   ✍️ Diễn đạt lại (AI LLM Rewrite): \"{s.get('suggested_revision')}\"")
        print(f"   🔎 Lý do: {s.get('rationale')}")

    print("\n🛡️ [6. KIỂM ĐỊNH GUARDRAIL & GROUNDING]")
    print(f"  • Grounding Score: {result.get('grounding_score', 1.0)} / 1.0")
    print(f"  • Is Grounded: {'✅ ĐẠT' if result.get('is_grounded') else '❌ CHƯA ĐẠT'}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
