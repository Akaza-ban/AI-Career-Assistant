"""
Đo chất lượng đọc CV (PDF có chữ, PDF scan, ảnh chụp, DOCX) bằng đúng hàm hệ thống dùng khi tải CV lên
(src.services.cv_files.extract_cv). Không gọi AI.

Chỉ số mỗi file:
- Chữ đúng: tỉ lệ từ của đáp án có trong chữ đọc ra (bỏ dấu, hoa/thường, dấu câu khi so).
- Dính: tỉ lệ "từ" dài bất thường (> 18 ký tự, không phải email/link) trong chữ đọc ra; càng thấp càng tốt.
- Tách sai: tỉ lệ chỗ một từ của đáp án bị cắt làm hai ("Strea mlit"); càng thấp càng tốt.
- Thứ tự: trong các dòng của đáp án tìm thấy, tỉ lệ cặp dòng liền nhau giữ đúng trước–sau.
- Tiêu đề: tỉ lệ tiêu đề mục của đáp án được hệ thống nhận là tiêu đề đúng mục.
- Tên đầu: họ tên nằm ở dòng đầu tiên (mẫu CV xuất ra lấy dòng đầu làm họ tên).
- Dấu: số chữ có dấu tiếng Việt đọc ra / số chữ có dấu trong đáp án (chỉ CV tiếng Việt).

Chạy từ thư mục gốc:
  python -m eval.ocr.run_ocr_eval                 # bộ mẫu hư cấu eval/ocr/samples
  python -m eval.ocr.run_ocr_eval --real D:/cv    # thêm CV thật để đo trên máy (không đưa vào repo):
                                                  # <tên>.pdf|.docx kèm <tên>.expect.json {"name", "phrases"}
  python -m eval.ocr.run_ocr_eval --save          # ghi bảng kết quả vào eval/ocr/results.md
"""

import argparse
import json
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path

from src.services.cv_files import extract_cv
from src.services.skill_matching import _match_section, split_cv_lines

HERE = Path(__file__).parent
SAMPLES = HERE / "samples"
_VIET = re.compile(
    "[ĂăÂâĐđÊêÔôƠơƯư" + "".join(chr(c) for c in range(0x1EA0, 0x1EFA)) + "àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]"
)


def tokens(text: str) -> list[str]:
    plain = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    plain = "".join(c for c in plain if not unicodedata.combining(c)).lower()
    return re.findall(r"[a-z0-9]+", plain)


def glue_rate(text: str) -> float:
    words = [w for w in text.split() if not re.search(r"@|https?:|www\.|\.com|/", w)]
    return sum(1 for w in words if len(re.sub(r"[^\w]", "", w)) > 18) / max(1, len(words))


def split_rate(vocab: set[str], out_tokens: list[str]) -> float:
    """Cặp từ liền nhau ghép lại thành một từ của đáp án mà từng mảnh không phải từ của đáp án."""
    bad = sum(
        1
        for a, b in zip(out_tokens, out_tokens[1:], strict=False)
        if a + b in vocab and len(a + b) >= 4 and not (a in vocab and b in vocab)
    )
    return bad / max(1, len(out_tokens))


def _find(seq: list[str], part: list[str]) -> int | None:
    n = len(part)
    for i in range(len(seq) - n + 1):
        if seq[i : i + n] == part:
            return i
    return None


def order_score(truth_text: str, out_tokens: list[str]) -> float | None:
    positions = []
    for line in truth_text.splitlines():
        toks = tokens(line)
        if len(toks) >= 3 and (pos := _find(out_tokens, toks[:3])) is not None:
            positions.append(pos)
    if len(positions) < 2:
        return None
    return sum(1 for a, b in zip(positions, positions[1:], strict=False) if b > a) / (len(positions) - 1)


def heading_score(headings: list[str], out_text: str) -> float | None:
    expected = {sec for h in headings if (sec := _match_section(h)[0])}
    if not expected:
        return None
    found = {line["block"] for line in split_cv_lines(out_text) if line["is_heading"]}
    return len(expected & found) / len(expected)


def name_first(name: str, out_text: str) -> bool:
    first = next((line for line in out_text.splitlines() if line.strip()), "")
    want = "".join(tokens(name))
    return bool(want) and want in "".join(tokens(first))


def measure(path: Path, truth: dict) -> dict:
    kind = "docx" if path.suffix == ".docx" else "pdf"
    t0 = time.perf_counter()
    try:
        result = extract_cv(kind, path.read_bytes())
        out, ocr = result.text, result.read_by_ocr
    except Exception as e:  # file không đọc được vẫn ghi vào bảng
        out, ocr = "", f"lỗi: {e}"
    seconds = time.perf_counter() - t0
    out_tokens = tokens(out)
    if "phrases" in truth:  # CV thật: đo theo các cụm quan trọng
        flat = "".join(out_tokens)
        found = sum(1 for p in truth["phrases"] if "".join(tokens(p)) in flat)
        words = found / len(truth["phrases"])
        splits = split_rate({t for p in truth["phrases"] for t in tokens(p)}, out_tokens)
        order = headings = None
        marks = None
    else:
        want = Counter(tokens(truth["text"]))
        words = sum((want & Counter(out_tokens)).values()) / max(1, sum(want.values()))
        splits = split_rate(set(want), out_tokens)
        order = order_score(truth["text"], out_tokens)
        headings = heading_score(truth.get("headings", []), out)
        gt_marks = len(_VIET.findall(truth["text"]))
        marks = len(_VIET.findall(out)) / gt_marks if gt_marks >= 20 else None
    return {
        "words": words,
        "glue": glue_rate(out),
        "splits": splits,
        "order": order,
        "headings": headings,
        "name": name_first(truth.get("name", ""), out),
        "marks": marks,
        "seconds": seconds,
        "ocr": ocr,
    }


def _pct(v: float | None) -> str:
    return "–" if v is None else f"{v * 100:.0f}%"


def run(real: Path | None) -> str:
    truth = json.loads((SAMPLES / "truth.json").read_text(encoding="utf-8"))
    jobs = [
        (SAMPLES / f["file"], f["kind"], truth[f["sample"]]) for f in json.loads((SAMPLES / "files.json").read_text())
    ]
    if real:
        for exp in sorted(real.glob("*.expect.json")):
            stem = exp.name.removesuffix(".expect.json")
            src = next((p for p in (real / f"{stem}.pdf", real / f"{stem}.docx") if p.exists()), None)
            if src:
                jobs.append((src, "thật", json.loads(exp.read_text(encoding="utf-8"))))

    rows, by_kind = [], {}
    header = "| File | Loại | Chữ đúng | Dính | Tách sai | Thứ tự | Tiêu đề | Tên đầu | Dấu | Thời gian |\n|---|---|---|---|---|---|---|---|---|---|"
    for path, kind, t in jobs:
        m = measure(path, t)
        by_kind.setdefault(kind, []).append(m)
        rows.append(
            f"| {path.name} | {kind} | {_pct(m['words'])} | {_pct(m['glue'])} | {m['splits'] * 100:.1f}% | {_pct(m['order'])} | "
            f"{_pct(m['headings'])} | {'có' if m['name'] else 'không'} | {_pct(m['marks'])} | {m['seconds']:.1f}s |"
        )
        print(rows[-1], flush=True)

    def avg(ms: list[dict], key: str) -> float | None:
        vals = [m[key] for m in ms if m[key] is not None]
        return sum(vals) / len(vals) if vals else None

    summary = [
        "| Loại | Số file | Chữ đúng | Dính | Tách sai | Thứ tự | Tiêu đề | Tên đầu | Dấu | Thời gian TB |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for kind, ms in by_kind.items():
        summary.append(
            f"| {kind} | {len(ms)} | {_pct(avg(ms, 'words'))} | {_pct(avg(ms, 'glue'))} | {avg(ms, 'splits') * 100:.1f}% | "
            f"{_pct(avg(ms, 'order'))} | "
            f"{_pct(avg(ms, 'headings'))} | {sum(m['name'] for m in ms)}/{len(ms)} | {_pct(avg(ms, 'marks'))} | "
            f"{avg(ms, 'seconds'):.1f}s |"
        )
    return (
        "## Tổng hợp theo loại file\n\n"
        + "\n".join(summary)
        + "\n\n## Từng file\n\n"
        + header
        + "\n"
        + "\n".join(rows)
        + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo chất lượng đọc CV")
    parser.add_argument("--real", type=Path, help="Thư mục CV thật kèm <tên>.expect.json (chỉ đo trên máy)")
    parser.add_argument("--save", action="store_true", help="Ghi kết quả vào eval/ocr/results.md")
    args = parser.parse_args()
    report = run(args.real)
    print("\n" + report)
    if args.save:
        (HERE / "results.md").write_text("# Kết quả đo đọc CV\n\n" + report, encoding="utf-8")


if __name__ == "__main__":
    main()
