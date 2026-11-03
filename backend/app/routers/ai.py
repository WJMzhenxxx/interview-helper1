"""AI 相关路由：DeepSeek 代理（流式）。

API key 由后端持有，前端通过此代理调用，避免密钥暴露。
"""
from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services import deepseek

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


@router.post("/chat/stream")
async def chat_stream(
    messages: List[ChatMessage],
    temperature: float = 0.7,
    max_tokens: int = 1024,
    timeout_seconds: float = 10.0,
):
    """通用流式聊天代理：将 messages 转发给 DeepSeek 并以 SSE 流式返回。"""
    if not deepseek.is_configured():
        raise HTTPException(status_code=500, detail="DeepSeek API key 未配置")

    msgs = [{"role": m.role, "content": m.content} for m in messages]

    async def event_stream():
        try:
            async for chunk in deepseek.chat_stream(
                msgs,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout_seconds=timeout_seconds,
            ):
                yield f"data: {chunk}\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"data: [ERROR] {e}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
