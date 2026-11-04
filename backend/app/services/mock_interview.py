"""模拟面试服务：生成 AI 面试者角色、管理上下文、流式响应。

核心思想：
- AI 扮演"面试者"，根据【应聘岗位 JD】+【自身简历】+【水平等级】回答
  面试官（使用者）的提问与追问。
- 水平等级仅通过 System Prompt 引导：不限=全力回答，低=答非所问/钻牛角尖。
- 上下文管理：完整对话持久化在库中；发往 DeepSeek 时使用"最近 N 条 +
  早期压缩摘要"的滑动窗口，支持 1-2 小时长会话。
"""
import asyncio
from typing import AsyncGenerator, List, Dict, Optional

from sqlalchemy.orm import Session

from . import deepseek
from ..models import MockSession, MockMessage

# ---- 水平等级行为（仅通过 prompt 引导）----
LEVEL_PROMPTS: Dict[str, str] = {
    "unlimited": (
        "你的水平不受限制，请以饱满、专业、完整的方式进行回答。"
        "条理清晰、论据充分、深入展开，展现求职者的最佳状态。"
    ),
    "high": (
        "你是高水平面试者，回答熟练、深入、能举一反三。"
        "85% 的问题都能给出准确、有深度的回答，偶尔也会稍作思考但整体流畅。"
    ),
    "medium": (
        "你是中等水平的面试者。多数基础问题能正常回答，但遇到深入追问时"
        "思路可能不够完整、偶尔抓不住重点，回答长度偏短、细节不够。"
    ),
    "low": (
        "你是低水平求职者，对技术和面试很不熟练。回答往往答非所问、"
        "钻牛角尖、抓不住重点、容易跑题或东拉西扯，甚至重复啰嗦。"
        "对很多概念只有模糊或错误的印象，回答质量明显偏低。"
    ),
}

# 上下文窗口：发往 DeepSeek 时使用的最大历史消息条数
MAX_CONTEXT_MESSAGES = 20


def build_system_prompt(
    jd: Optional[str],
    resume: Optional[str],
    level: str,
) -> str:
    """构建 AI 面试者的系统提示词。"""
    parts: List[str] = [
        "你是【模拟面试】中的【面试者（求职者）】角色。"
        "你正在参加一场面试，面试官会向你提问和追问，你需要结合自己的简历"
        "与应聘岗位，以求职者的第一人称口吻自然作答。"
    ]

    if jd and jd.strip():
        parts.append(f"\n【应聘岗位 JD】\n{jd.strip()}")
    else:
        parts.append("\n【应聘岗位 JD】（未提供）")

    if resume and resume.strip():
        parts.append(f"\n【你的简历（个人经历）】\n{resume.strip()}")
    else:
        parts.append("\n【你的简历（个人经历）】（未提供）")

    level_prompt = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["unlimited"])
    parts.append(f"\n【面试者水平设定】\n{level_prompt}")

    parts.append(
        "\n【回答要求 - 非常重要】\n"
        "- 回答要口语化、自然、有真人感，绝不能有AI味：不要用首先/其次/总之/综上所述/需要注意的是这类书面连接词，不要分点罗列，不要总结陈词，不要喊口号\n"
        "- 像真人面试现场说话一样，可以用嗯、其实、就是说等自然停顿，可以有轻微的口语重复或临时改口\n"
        "- 不要太多、不要过于复杂，直接、朴实地回答即可\n"
        "- 字数控制：每个回答约 300 字左右（对应常人朗读约 2 分钟的量），最多不超过 380 字\n"
        "- 结合岗位 JD 和自身简历作答，内容要贴合实际经历\n"
        "- 被追问时基于上一轮进行补充或修正，保持上下文连贯"
    )

    return "\n".join(parts)


def build_history(
    messages: List[MockMessage],
    max_messages: int = MAX_CONTEXT_MESSAGES,
) -> List[Dict[str, str]]:
    """将已持久化的对话转成 DeepSeek 消息，并做滑动窗口压缩。

    简单起见，这里直接取最近 N 条作为上下文（JD/简历已在 system prompt 中，
    是永久上下文）。完整历史仍在数据库中，未来可用 DeepSeek 做早期摘要压缩。
    """
    recent = messages[-max_messages:]
    return [
        {"role": "assistant" if m.role == "ai" else "user", "content": m.content}
        for m in recent
    ]


def _assemble_respond_context(
    session: MockSession,
    interviewer_message: str,
) -> List[Dict[str, str]]:
    """组装完整上下文消息给 DeepSeek。"""
    system_prompt = build_system_prompt(session.jd, session.resume, session.level)
    history = build_history(session.messages)
    return deepseek.build_messages(system_prompt, history, interviewer_message)


async def respond_to_interviewer(
    session: MockSession,
    interviewer_message: str,
    *,
    timeout_seconds: float = 10.0,
) -> AsyncGenerator[str, None]:
    """流式生成 AI 面试者的回答。

    调用前调用方应已把面试官消息持久化；此处只负责生成流式回答。
    """
    messages = _assemble_respond_context(session, interviewer_message)
    async for chunk in deepseek.chat_stream(
        messages,
        temperature=0.7,
        max_tokens=600,
        timeout_seconds=timeout_seconds,
    ):
        yield chunk


def get_or_404(session: Session, session_id: str, user_id: int) -> MockSession:
    """按 session_id + user_id 查找模拟面试会话，找不到抛 ValueError。"""
    record = (
        session.query(MockSession)
        .filter(MockSession.session_id == session_id, MockSession.user_id == user_id)
        .first()
    )
    if not record:
        raise ValueError("模拟面试会话不存在")
    return record
