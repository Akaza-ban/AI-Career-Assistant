"""Draft message annotations reuse golden synthetic identities, never detectors.

Reproduce: python -m eval.pii.generate_messages. Does not touch real/ or PDFs.
"""

import json
from dataclasses import asdict

from eval.pii.dataset import ROOT, load_synthetic
from eval.pii.generate import Builder
from src.services.privacy.detectors import _fold
from src.services.privacy.types import Identity


def main() -> None:
    rows = []
    for sample in load_synthetic():
        if sample.category != "cv":
            continue
        values = {
            kind: [sample.text[span.start : span.end] for span in sample.entities if span.kind == kind]
            for kind in {span.kind for span in sample.entities}
        }
        name = values["PERSON"][0]
        identity = Identity(name=name, email=values["EMAIL"][0], phone=values["PHONE"][0])
        variants = [
            name,
            _fold(name)[0],
            " ".join(reversed(name.split())),
            name.replace(" ", "_"),
            _fold(name)[0].replace(" ", "_"),
        ]
        keep = {kind: sample.text[start:end] for start, end, kind in sample.keep}
        builders = []
        for variant in variants:
            b = Builder().add("Mở CV " if sample.language != "en" else "Open my CV ")
            b.add(variant, pii="PERSON")
            if "_" in variant:
                b.add(".pdf")
            b.add(" giúp mình?" if sample.language != "en" else " please?")
            builders.append(b)
        b = Builder().add("How do I upload a CV? Email ").add(identity.email, pii="EMAIL")
        b.add("; phone ").add(identity.phone, pii="PHONE").add("; thanks!")
        builders.append(b)
        b = Builder().add("Mình cần sửa hồ sơ. CCCD: ").add(values["ID"][0], pii="ID")
        b.add("; Ngày sinh: ").add(values["DOB"][0], pii="DOB").add(";")
        if len(values["ID"]) > 1:
            b.add(" Passport: ").add(values["ID"][1], pii="ID").add(";")
        builders.append(b)
        b = Builder().add("How do I edit my profile? Home address: ").add(values["ADDRESS"][0], pii="ADDRESS")
        b.add("; Profile: ").add(values["URL"][0], pii="URL")
        b.add("; handle ").add(values["HANDLE"][0], pii="HANDLE").add(";")
        builders.append(b)
        b = Builder().add("Find the uploaded CV. Name: ").add(values["PERSON"][-1], pii="PERSON").add(";")
        builders.append(b)
        b = Builder().add("Can I search skills like ").add("Python", keep="SKILL")
        b.add(" and ").add("Machine Learning", keep="SKILL")
        b.add("? I worked at ").add(keep["EMPLOYER"], keep="EMPLOYER")
        b.add("; studied at ").add(keep["SCHOOL"], keep="SCHOOL").add(".")
        b.add(" Based in ").add(keep["CITY"], keep="CITY").add(".")
        builders.append(b)
        for index, b in enumerate(builders):
            rows.append(
                {
                    "id": f"message-{sample.id}-{index}",
                    "category": "message",
                    "language": "vi"
                    if b.text.startswith(("Mở CV", "Mình cần"))
                    else "mixed"
                    if any(ord(char) > 127 for char in b.text)
                    else "en",
                    "format": "text",
                    "review_status": "needs_human_review",
                    "text": b.text,
                    "entities": b.entities,
                    "keep": b.keep,
                    "identities": [asdict(identity)],
                }
            )
    # Punctuation regressions are independent cases, including international
    # contact formats and preservation negatives beyond the CV-derived names.
    for index, text in enumerate(("first_last@example.test", "+1 (202) 555-0198", "@first_last", "@first-last")):
        b = (
            Builder()
            .add("How do I update my profile? Contact: ")
            .add(text, pii=("EMAIL", "PHONE", "HANDLE", "HANDLE")[index])
        )
        rows.append(
            {
                "id": f"message-punctuation-{index}",
                "category": "message",
                "language": "en",
                "format": "text",
                "review_status": "needs_human_review",
                "text": b.text,
                "entities": b.entities,
                "keep": [],
            }
        )
    (ROOT / "messages.jsonl").write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8"
    )
    print(f"Wrote {len(rows)} synthetic message fixtures; annotation review is still required.")


if __name__ == "__main__":
    main()
