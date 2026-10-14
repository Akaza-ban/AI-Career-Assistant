"""Heading-aware Markdown chunks retaining FAQ and UI target boundaries."""

import hashlib
import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field

SELECTOR_PATTERN = re.compile(r"\[data-agent-target\s*=\s*([\"'])[^\"'\]\n]+\1\]")
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
BLOCK_PATTERN = re.compile(r"^\s*(?:[-*+]\s+|\d+[.)]\s+|\*\*Q:|Q:)")


class DocChunk(BaseModel):
    chunk_id: str
    content: str
    route: str
    role: Literal["student", "advisor", "all"]
    title: str
    section: str
    selector: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: str = ""


class DocMetadata(BaseModel):
    route: str = Field(min_length=1, pattern=r"^/")
    role: Literal["student", "advisor", "all"]
    title: str = Field(min_length=1)
    tags: list[str]


class MarkdownDocChunker:
    """Target 200–500 characters; short FAQ/UI items stay separate for grounding."""

    def __init__(self, min_chars: int = 200, max_chars: int = 500) -> None:
        if not 0 < min_chars <= max_chars:
            raise ValueError("Require 0 < min_chars <= max_chars")
        self.min_chars = min_chars
        self.max_chars = max_chars

    def parse_frontmatter(self, markdown: str) -> tuple[dict[str, Any], str]:
        text = markdown.lstrip("\ufeff").replace("\r\n", "\n")
        match = re.match(r"\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)", text, re.DOTALL)
        if match is None:
            raise ValueError("Markdown must start with YAML frontmatter")
        raw = yaml.safe_load(match.group(1))
        if not isinstance(raw, dict):
            raise ValueError("Frontmatter must be a YAML mapping")
        metadata = DocMetadata.model_validate(raw)
        return metadata.model_dump(), text[match.end() :].strip()

    def _split(self, text: str) -> list[str]:
        parts: list[str] = []
        while len(text) > self.max_chars:
            # Prefer paragraph/sentence/word boundaries without dropping content.
            window = text[: self.max_chars + 1]
            boundaries = [m.end() for m in re.finditer(r"\n|[.!?] \s*", window)]
            cut = next((i for i in reversed(boundaries) if self.min_chars <= i <= self.max_chars), 0)
            if not cut:
                cut = window.rfind(" ", self.min_chars, self.max_chars + 1)
            if cut <= 0:
                cut = self.max_chars
            # Keep an entire CSS selector together when possible.
            for match in SELECTOR_PATTERN.finditer(text):
                if match.start() < cut < match.end():
                    if match.start() > 0:
                        cut = match.start()
                    elif match.end() <= self.max_chars:
                        cut = match.end()
                    break
            parts.append(text[:cut].strip())
            text = text[cut:].strip()
        if text:
            parts.append(text)
        return parts

    def chunk(self, markdown: str, source: str = "") -> list[DocChunk]:
        metadata, body = self.parse_frontmatter(markdown)
        headings: list[tuple[int, str]] = []
        blocks: list[tuple[str, str]] = []
        pending: list[str] = []
        fence: str | None = None

        def flush() -> None:
            content = "\n".join(pending).strip()
            if content:
                section = " > ".join(title for _, title in headings) or metadata["title"]
                blocks.append((section, content))
            pending.clear()

        for line in body.splitlines():
            marker = re.match(r"^\s*(`{3,}|~{3,})", line)
            if marker:
                if fence is None:
                    flush()
                    fence = marker.group(1)
                elif marker.group(1)[0] == fence[0] and len(marker.group(1)) >= len(fence):
                    pending.append(line)
                    flush()
                    fence = None
                    continue
            if fence is not None:
                pending.append(line)
                continue
            heading = HEADING_PATTERN.match(line)
            if heading:
                flush()
                level = len(heading.group(1))
                while headings and headings[-1][0] >= level:
                    headings.pop()
                headings.append((level, heading.group(2)))
            elif BLOCK_PATTERN.match(line):
                flush()
                pending.append(line)
            elif not line.strip():
                # Q and A often have a blank line between them in the guides.
                if pending and re.match(r"^(?:\*\*Q:|Q:)", pending[0]):
                    pending.append(line)
                else:
                    flush()
            else:
                pending.append(line)
        flush()

        units: list[tuple[str, str, str | None]] = []
        for section, content in blocks:
            selectors = list(SELECTOR_PATTERN.finditer(content))
            selector = selectors[0].group(0) if selectors else None
            for part in self._split(content):
                structured = bool(BLOCK_PATTERN.match(content)) or selector is not None
                if units and not structured:
                    previous_section, previous, previous_selector = units[-1]
                    if (
                        previous_section == section
                        and previous_selector is None
                        and not BLOCK_PATTERN.match(previous)
                        and len(previous) < self.min_chars
                        and len(previous) + len(part) + 2 <= self.max_chars
                    ):
                        units[-1] = (section, previous + "\n\n" + part, None)
                        continue
                units.append((section, part, selector))

        chunks: list[DocChunk] = []
        for index, (section, content, selector) in enumerate(units):
            identity = f"{source}\0{metadata['route']}\0{section}\0{index}\0{content}"
            chunks.append(
                DocChunk(
                    chunk_id=hashlib.sha256(identity.encode("utf-8")).hexdigest(),
                    content=content,
                    section=section,
                    selector=selector,
                    source=source,
                    **metadata,
                )
            )
        return chunks

    def chunk_file(self, path: str | Path, source: str | None = None) -> list[DocChunk]:
        document = Path(path)
        return self.chunk(document.read_text(encoding="utf-8-sig"), source or document.as_posix())
