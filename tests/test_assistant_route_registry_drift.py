"""Keep assistant destinations aligned with routable student/advisor pages."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "frontend" / "app"
ROUTES = ROOT / "src" / "services" / "assistant" / "resources" / "routes.json"


def _frontend_route(page: Path) -> str:
    relative = page.relative_to(APP).parent
    parts = [part for part in relative.parts if not (part.startswith("(") and part.endswith(")"))]
    return "/" + "/".join(re.sub(r"\[[^/]+\]", "{param}", part) for part in parts)


def _registry_route(template: str) -> str:
    return re.sub(r"\{[^/]+\}", "{param}", template)


def test_student_and_advisor_page_routes_match_registry() -> None:
    pages = {
        _frontend_route(page)
        for role in ("student", "advisor")
        for page in (APP / role).rglob("page.tsx")
    }
    registry = json.loads(ROUTES.read_text(encoding="utf-8"))
    registered = {
        _registry_route(entry["path_template"])
        for entry in registry.values()
        if "student" in entry["roles"] or "advisor" in entry["roles"]
    }

    assert pages == registered, (
        f"Next.js routes missing from registry: {sorted(pages - registered)}; "
        f"registry paths without route files: {sorted(registered - pages)}"
    )
