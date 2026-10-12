"""Dịch vụ chuyển giọng nói thành văn bản thời gian thực (Real-time Speech-to-Text) qua Soniox API."""

import asyncio
import json
import logging
from typing import Any

import websockets
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import InterviewSession, JobDescription

logger = logging.getLogger(__name__)


def build_soniox_config(session_id: str | None, db: Session | None) -> dict[str, Any]:
    """Tạo cấu hình khởi tạo cho Soniox WebSocket với ngữ cảnh từ vựng chuyên môn (Context-Awareness)."""
    settings = get_settings()
    config: dict[str, Any] = {
        "model": settings.soniox_model,
        "audio_format": "pcm_s16le",
        "sample_rate": 16000,
        "num_channels": 1,
        "language_hints": ["vi", "en"],
        "enable_language_identification": True,
    }

    # Bổ sung từ khoá ngữ cảnh kỹ thuật từ vị trí công việc (JD) nếu có session_id
    if session_id and db:
        try:
            session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
            if session and session.jd_id:
                jd = db.query(JobDescription).filter(JobDescription.id == session.jd_id).first()
                if jd:
                    title = jd.title
                    skills = []
                    if isinstance(jd.required_skills, list):
                        skills.extend(str(s) for s in jd.required_skills[:10])
                    if isinstance(jd.tools, list):
                        skills.extend(str(t) for t in jd.tools[:10])

                    context_items = [{"key": "domain", "value": f"Phỏng vấn vị trí {title}"}]
                    if skills:
                        context_items.append({"key": "terms", "value": ", ".join(skills)})

                    config["context"] = {"general": context_items}
        except Exception as e:
            logger.warning(f"Không thể đọc ngữ cảnh JD cho Soniox: {e}")

    return config


async def proxy_soniox_stream(
    client_ws: WebSocket,
    session_id: str | None = None,
    db: Session | None = None,
) -> None:
    """Proxy hai chiều giữa Web Browser và Soniox Real-time WebSocket:

    Client Mic (PCM 16kHz audio bytes) -> Backend -> Soniox STT
    Soniox STT (JSON Tokens is_final/provisional) -> Backend -> Client Browser
    """
    settings = get_settings()
    api_key = (settings.soniox_api_key or "").strip()

    if not api_key:
        await client_ws.send_json(
            {
                "type": "error",
                "message": (
                    "Chưa cấu hình SONIOX_API_KEY trong file .env. "
                    "Vui lòng thêm SONIOX_API_KEY (từ https://console.soniox.com) để sử dụng tính năng Voice to Text."
                ),
            }
        )
        await client_ws.close()
        return

    soniox_config = build_soniox_config(session_id, db)
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        async with websockets.connect(
            settings.soniox_ws_url,
            additional_headers=headers,
            ping_interval=20,
            ping_timeout=20,
        ) as soniox_ws:
            # 1. Gửi bản tin cấu hình đầu tiên cho Soniox
            await soniox_ws.send(json.dumps(soniox_config))

            # 2. Báo cho client biết kết nối Soniox đã sẵn sàng nhận audio
            await client_ws.send_json(
                {
                    "type": "ready",
                    "model": settings.soniox_model,
                }
            )

            async def client_to_soniox():
                try:
                    while True:
                        msg = await client_ws.receive()
                        if "bytes" in msg and msg["bytes"]:
                            # Gửi chunk binary PCM 16kHz sang Soniox
                            await soniox_ws.send(msg["bytes"])
                        elif "text" in msg and msg["text"]:
                            try:
                                payload = json.loads(msg["text"])
                                action = payload.get("action")
                                if action == "finalize":
                                    await soniox_ws.send(json.dumps({"type": "finalize"}))
                                elif action == "stop":
                                    await soniox_ws.send(json.dumps({"type": "finalize"}))
                                    break
                            except Exception:
                                pass
                except WebSocketDisconnect:
                    logger.debug("Client WebSocket ngắt kết nối.")
                except Exception as ex:
                    logger.debug(f"Lỗi client_to_soniox: {ex}")

            async def soniox_to_client():
                try:
                    async for raw in soniox_ws:
                        if isinstance(raw, str):
                            data = json.loads(raw)
                            # Kiểm tra lỗi trả về từ Soniox
                            if data.get("error_code") or data.get("error_message"):
                                await client_ws.send_json(
                                    {
                                        "type": "error",
                                        "message": data.get("error_message", "Soniox transcription error"),
                                    }
                                )
                                break

                            # Forward danh sách tokens cho client
                            tokens = data.get("tokens", [])
                            await client_ws.send_json(
                                {
                                    "type": "tokens",
                                    "tokens": tokens,
                                    "final_audio_proc_ms": data.get("final_audio_proc_ms"),
                                    "total_audio_proc_ms": data.get("total_audio_proc_ms"),
                                }
                            )
                except Exception as ex:
                    logger.debug(f"Lỗi soniox_to_client: {ex}")

            # Chạy đồng thời 2 luồng chuyển tiếp dữ liệu
            await asyncio.gather(client_to_soniox(), soniox_to_client(), return_exceptions=True)

    except websockets.exceptions.InvalidStatusCode as e:
        logger.error(f"Soniox HTTP Auth failed: {e}")
        await client_ws.send_json(
            {
                "type": "error",
                "message": f"Soniox xác thực thất bại (HTTP {e.status_code}). Kiểm tra lại SONIOX_API_KEY trong .env.",
            }
        )
    except Exception as e:
        logger.error(f"Soniox WebSocket kết nối lỗi: {e}")
        await client_ws.send_json(
            {
                "type": "error",
                "message": f"Không thể kết nối máy chủ Soniox: {str(e)}",
            }
        )
    finally:
        try:
            await client_ws.close()
        except Exception:
            pass
