"""Server-owned destinations and guide targets; shared with the browser dispatcher."""

import json
import re
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
from typing import Literal

from pydantic import BaseModel, ConfigDict

Role = Literal["student", "advisor"]
_RESOURCES = Path(__file__).parent / "resources"
_IDENTIFIER = re.compile(r"^[\w-]{1,64}$")


class RegistryEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)
    roles: list[Role]
    labels_vi: list[str]
    labels_en: list[str]
    aliases: list[str]


class RouteEntry(RegistryEntry):
    path_template: str
    params: list[str]


class UIEntry(RegistryEntry):
    element_id: str
    route_id: str


@lru_cache(maxsize=1)
def load_routes() -> Mapping[str, RouteEntry]:
    data = json.loads((_RESOURCES / "routes.json").read_text(encoding="utf-8"))
    routes = {key: RouteEntry.model_validate(value) for key, value in data.items()}
    for entry in routes.values():
        if set(re.findall(r"{(\w+)}", entry.path_template)) != set(entry.params):
            raise ValueError("Route parameters do not match template")
    return MappingProxyType(routes)


@lru_cache(maxsize=1)
def load_ui_registry() -> Mapping[str, UIEntry]:
    data = json.loads((_RESOURCES / "ui_registry.json").read_text(encoding="utf-8"))
    entries = {key: UIEntry.model_validate(value) for key, value in data.items()}
    for key, entry in entries.items():
        route = load_routes().get(entry.route_id)
        if key != entry.element_id or not _IDENTIFIER.fullmatch(key):
            raise ValueError("Invalid UI element ID")
        if route is None or route.params or not entry.roles or not set(entry.roles) <= set(route.roles):
            raise ValueError("UI element requires a static route with compatible roles")
    return MappingProxyType(entries)


def resolve_route(route_id: str, params: dict[str, str], role: str) -> str:
    entry = load_routes().get(route_id)
    if entry is None or role not in entry.roles:
        raise ValueError("Route is not in the role registry")
    if set(params) != set(entry.params) or any(not _IDENTIFIER.fullmatch(value) for value in params.values()):
        raise ValueError("Invalid route parameters")
    # Reserved static segments cannot be supplied as record IDs.
    if any(value in {"new", "start", "compare"} for value in params.values()):
        raise ValueError("Reserved record identifier")
    return entry.path_template.format(**params)


def require_element(element_id: str, role: str) -> UIEntry:
    entry = load_ui_registry().get(element_id)
    if entry is None or role not in entry.roles:
        raise ValueError("Element is not in the role registry")
    resolve_route(entry.route_id, {}, role)
    return entry


def route_allowed(route: str, role: str) -> bool:
    for key, entry in load_routes().items():
        if role not in entry.roles:
            continue
        if route in entry.aliases:
            return True
        pattern = re.escape(entry.path_template)
        for param in entry.params:
            pattern = pattern.replace(re.escape("{" + param + "}"), r"([\w-]{1,64})")
        match = re.fullmatch(pattern, route)
        if match:
            try:
                resolve_route(key, dict(zip(entry.params, match.groups(), strict=True)), role)
                return True
            except ValueError:
                continue
    return False


def route_whitelists() -> dict[str, set[str]]:
    return {
        role: {
            path
            for entry in load_routes().values()
            if role in entry.roles and not entry.params
            for path in [entry.path_template, *entry.aliases]
        }
        for role in ("student", "advisor")
    }
