"""DeepSeek API 代理服务。

API key 从后端环境变量 DEEPSEEK_API_KEY 读取，避免暴露在前端浏览器。
通过 OpenAI 兼容接口调用 DeepSeek，提供流式能力。
"""
import os
import asyncio
from typing import AsyncGenerator, List, Dict, Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv(encoding="utf-8")

DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    """惰性初始化 OpenAI 客户端（兼容 DeepSeek）。"""
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    return _client


def is_configured() -> bool:
    """DeepSeek 是否已配置 API key。"""
    return bool(DEEPSEEK_API_KEY)


def build_messages(
    system_prompt: str,
    history: List[Dict[str, str]],
    user_content: str,
) -> List[Dict[str, str]]:
    """组装完整消息：system + 历史 + 当前输入。"""
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_content})
    return messages


async def chat_stream(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    timeout_seconds: float = 10.0,
) -> AsyncGenerator[str, None]:
    """流式调用 DeepSeek，按块产出文本增量。

    每个块产出一段纯文本增量；通过 asyncio.timeout 实现限时，
    超时即中断（返回已生成的部分，由调用方决定是否可用）。
    """
    client = get_client()
    try:
        async with asyncio.timeout(timeout_seconds):
            stream = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
    except asyncio.TimeoutError:
        yield "\n\n[已超出回应时限]"
