# Local privacy evaluation

The golden set contains **72 synthetic CVs**: 24 VI, 24 EN, 24 mixed;
36 text PDFs and 36 image-only scans. Eight draft layouts vary headers, prose,
labels and inline fields. Eighteen additional fixtures cover JDs/recruiters,
tool errors and advisor-style student records. Filenames and referee identifiers
are annotated. Every synthetic row and PDF is marked `needs_human_review`.

These are generated drafts, not a reviewed production acceptance set. The team
must review annotations and supply 10+ hand-anonymized held-out real-format CVs in
`real/`. That set is evaluated separately and must never be used for tuning or
model selection. See [the real-set schema](real/README.md).

## Reproduce

Run from the repository root, using Python 3.11+:

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-privacy-eval.txt
.venv/Scripts/python.exe -c "from huggingface_hub import snapshot_download; snapshot_download('Phuc2005/pii-phobert-base-ner', revision='fc4d654b9906dafb34ea670b9b14c2360e4d3be3', local_dir='data/privacy-models/phobert')"
$env:PII_PHOBERT_MODEL_DIR='data/privacy-models/phobert'
$env:HF_HUB_OFFLINE='1'
$env:PYTHON_DOTENV_DISABLED='1'
.venv/Scripts/python.exe -m eval.pii.run --documents
```

Provision Tesseract and its **vie+eng** trained data locally before the document
run. `PII_OCR_COMMAND` selects its executable; `TESSDATA_PREFIX` may select its
local trained-data directory. No cloud OCR or hosted model inference is used.
On the task host, a portable Tesseract 5.5.3 runtime is in
`.tools/privacy-ocr/Library/bin/tesseract.exe`, with trained data in
`.tools/privacy-ocr/share/tessdata`. These installed tools and downloaded model
weights are ignored by Git. Runtime PhoBERT loads only a local directory; it
cannot download missing weights. spaCy requires the installed trained
`xx_ent_wiki_sm` pipeline; a blank multilingual tokenizer is not a NER fallback.

`--documents` evaluates the actual PDFs, with local OCR for scans. Without that
flag, the runner evaluates original transcriptions and filenames only. Both modes
include auxiliary fixtures. Missing real annotations warn and skip; missing
models or failed document extraction are recorded as failures, not omitted.

The JSON report is written to `results/benchmark.json`. It records dataset/source
hashes, measurement time, model versions, CPU device, NER-only results, the full
pipeline, language subsets, preservation rates and every failed gate. Reports
contain metrics and non-identifying fixture IDs, never original CV text or paths.

## Metrics and gates

Strict entity recall/precision require the **entire annotated span and kind** to
match. Coverage recall measures whether all entity characters are masked, even
when detections merge; it is diagnostic and does not replace the strict targets.
Document annotations map from the original transcription to extracted/OCR text
using character alignment. Separate start/end boundary maps prevent inserted
CRLFs or blank lines from inflating entity spans. These results measure masking
of OCR output, not perfect OCR transcription or universal identifier protection.

The fixed targets are recall >= .99 for EMAIL/PHONE/ID, >= .92 for PERSON/ADDRESS,
precision >= .9, and strictly < .03 false positives on SKILL/EMPLOYER/SCHOOL.
The model choice uses NER-only PERSON+ADDRESS micro recall on **synthetic** data;
precision breaks ties. A model with inference failures is ineligible. Known-identity
dictionary inputs are empty for this benchmark; that layer has independent tests.

The runner exits **1** when the shipping gate fails, including when draft scores
pass but human review or ten real CVs are missing. No thresholds are lowered and
no missing subset is counted as a pass. `pytest` tests the metrics, loader,
failure accounting, actual scan/text-PDF formats and gate boundaries using local
fixtures; model quality is measured by this separate CPU benchmark.

To regenerate draft PDFs with a Unicode TrueType font:

```powershell
.venv/Scripts/python.exe -m eval.pii.generate --font C:/Windows/Fonts/arial.ttf
```

Generation never writes to `real/`. Review regenerated annotations and render
representative pages before replacing the golden set. Source PDFs were visually
checked with Poppler across VI/EN/mixed, text/scan and several layouts.

## Assistant message fixtures (rev 4.1)

`messages.jsonl` contains 724 synthetic message-style cases, reusing identities,
contacts and preservation annotations from the existing golden CV set. It adds
diacritic/reversed-order names, no-diacritic names, filenames with both spellings,
international phone formats and email/handle punctuation. Authenticated identities
are explicit fixture inputs; annotations are built independently of detectors.
These drafts still need annotation review. They are not held-out real messages.

```powershell
.venv/Scripts/python.exe -m eval.pii.generate_messages
.venv/Scripts/python.exe -m eval.pii.run --messages --backends underthesea
.venv/Scripts/python.exe -m pytest tests/test_assistant_privacy_leaks.py tests/test_assistant_provider_contracts.py tests/test_provider_static_guard.py
```

The message mode reuses the existing strict metrics/thresholds, the configured
local NER and known-identity detector. Its default backend is the configured one;
the original CV benchmark still defaults to all three adapters. Results go to
`results/messages.json`, including dataset/source hashes. It exits nonzero on
any numeric gate failure. Tests also exercise the actual one-way masker on every
message, and the assistant graph with a recording provider, embeddings, logs and
inherited tracing. Contracts (1), (4), (5) use `v41_*.json` HTTP fixtures; historical
thinking/checkpoint tests remain separate legacy coverage.

The assistant message gate does not run extraction, OCR, a vault or unmasking.
It does not replace the stricter reviewed-real-CV gate above for product features
that send CV text. Recorded fixtures verify our code, not current vendor/model
behavior. See [the implementation report](../../docs/dev/Assistant_v2/PRIVACY_GATEWAY_REPORT.md).
