"""Repository-source gate: hosted SDKs/HTTP belong only to the gateway.

The tiny non-model allowlist is reviewed in provider_import_allowlist.json.
Graph invocations and gateway facade calls are not themselves provider SDKs.
"""

import ast
import json
from pathlib import Path

GATEWAY = "src/services/providers/gateway.py"
ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = json.loads((Path(__file__).with_name("provider_import_allowlist.json")).read_text())
PROVIDERS = {
    "openai",
    "langchain_openai",
    "groq",
    "anthropic",
    "cohere",
    "mistralai",
    "litellm",
    "ollama",
    "langchain_anthropic",
    "langchain_groq",
    "langchain_google_genai",
    "langchain.chat_models",
    "langchain.embeddings",
    "langchain_community.chat_models",
    "langchain_community.embeddings",
    "langchain_ollama",
    "langchain_mistralai",
    "langchain_aws",
    "google.generativeai",
    "google.genai",
    "sentence_transformers",
    "fastembed",
    "transformers",
    "huggingface_hub",
    "torch",
    "spacy",
    "underthesea",
    "chromadb",
    "langchain_chroma",
    "httpx",
    "requests",
    "aiohttp",
    "urllib.request",
    "http.client",
    "boto3",
    "botocore",
    "sagemaker",
}


def violations(source: str, path: str) -> list[str]:
    if path == GATEWAY:
        return []
    found = []
    tree = ast.parse(source)
    for node in ast.walk(tree):
        modules = []
        if isinstance(node, ast.Import):
            modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules = [node.module, *(node.module + "." + alias.name for alias in node.names)]
        elif isinstance(node, ast.Call):
            name = ast.unparse(node.func)
            if isinstance(node.func, ast.Attribute) and node.func.attr in {"post", "request", "urlopen", "urlretrieve"}:
                route = name in {"router.post", "app.post"} and (path.startswith("src/api/") or path == "src/main.py")
                reviewed_http = any(name.startswith(prefix + ".") for prefix in ALLOWLIST.get(path, {}))
                if not route and not reviewed_http:
                    found.append(f"{path}:{node.lineno}: HTTP dispatch requires the gateway")
            if name in {"__import__", "importlib.import_module"}:
                if not node.args or not isinstance(node.args[0], ast.Constant):
                    found.append(f"{path}:{node.lineno}: dynamic import requires manual review")
                elif isinstance(node.args[0].value, str):
                    modules = [node.args[0].value]
            # Catch model REST surfaces even when an HTTP client is injected.
            if any(
                part in name for part in ("chat.completions", "embeddings.create", "responses.create", "invoke_model")
            ):
                found.append(f"{path}:{node.lineno}: outbound model call")
            for arg in node.args:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    if any(
                        endpoint in arg.value for endpoint in ("/chat/completions", "/v1/embeddings", "/v1/responses")
                    ):
                        found.append(f"{path}:{node.lineno}: model HTTP endpoint")
        for module in modules:
            if not any(module == prefix or module.startswith(prefix + ".") for prefix in PROVIDERS):
                continue
            exceptions = ALLOWLIST.get(path, {})
            if not any(module == prefix or module.startswith(prefix + ".") for prefix in exceptions):
                found.append(f"{path}:{node.lineno}: {module}")
    return found


def test_provider_boundary_has_no_unreviewed_imports_or_http():
    found = []
    for directory in ("src", "scripts", "eval"):
        for path in (ROOT / directory).rglob("*.py"):
            found.extend(violations(path.read_text(encoding="utf-8-sig"), path.relative_to(ROOT).as_posix()))
    assert found == [], "\n".join(found)
    for path, entries in ALLOWLIST.items():
        assert (ROOT / path).is_file()
        assert entries and all(len(reason) > 30 for reason in entries.values())


def test_static_guard_rejects_aliases_dynamic_imports_and_injected_http():
    for source in (
        "from openai import OpenAI as Hidden",
        "import httpx as transport",
        "__import__('langchain_openai')",
        "importlib.import_module(provider_name)",
        "client.chat.completions.create(messages=[])",
        "client.post('/v1/embeddings', json=payload)",
        "client.post(configured_url, json=payload)",
        "from urllib import request",
        "from langchain.chat_models import ChatOpenAI",
    ):
        assert violations(source, "src/services/bypass.py")
