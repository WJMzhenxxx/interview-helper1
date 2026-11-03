"""模拟面试路由。

流程（一次问答触发）：
1. 前端检测到面试官问完（停顿）→ 调用 respond 端点
2. 后端保存面试官消息，组装上下文（JD/简历/水平 + 历史）
3. 流式调用 DeepSeek，边生成边以 SSE 返回
4. 生成结束（或超时）后，把 AI 回答保存入库，供后续上下文使用
"""
import uuid
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User as UserModel, MockSession, MockMessage
from ..schemas import (
    MockSessionCreate,
    MockSessionOut,
    MockRespondRequest,
)
from ..auth import get_current_active_user
from ..services import mock_interview

router = APIRouter()


@router.post("/sessions", response_model=MockSessionOut)
async def create_mock_session(
    payload: MockSessionCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """创建模拟面试会话，保存 JD / 简历 / 水平等级。"""
    record = MockSession(
        session_id=str(uuid.uuid4()),
        user_id=current_user.id,
        jd=payload.jd,
        resume=payload.resume,
        level=payload.level or "unlimited",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/sessions/{session_id}", response_model=MockSessionOut)
async def get_mock_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """读取模拟面试会话及其全部消息。"""
    try:
        record = mock_interview.get_or_404(db, session_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return record


@router.get("/sessions/", response_model=List[MockSessionOut])
async def list_mock_sessions(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """列出当前用户的全部模拟面试会话。"""
    records = (
        db.query(MockSession)
        .filter(MockSession.user_id == current_user.id)
        .order_by(MockSession.updated_at.desc())
        .all()
    )
    return records


@router.post("/sessions/{session_id}/respond")
async def respond_mock(
    session_id: str,
    payload: MockRespondRequest,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """核心：AI 面试者针对面试官当前提问（含追问）流式作答。"""
    # 校验会话归属
    try:
        record = mock_interview.get_or_404(db, session_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    msg = payload.interviewer_message or ""
    if not msg.strip():
        raise HTTPException(status_code=400, detail="面试官消息不能为空")

    # 持久化面试官消息
    interviewer_row = MockMessage(
        mock_session_id=record.id,
        role="interviewer",
        content=msg.strip(),
    )
    db.add(interviewer_row)
    db.commit()
    db.refresh(interviewer_row)

    # record.messages 首次访问会懒加载当前全部消息（含刚提交的面试官消息）
    full_ai_text: List[str] = []

    async def event_stream():
        nonlocal full_ai_text
        try:
            async for chunk in mock_interview.respond_to_interviewer(
                record,
                msg.strip(),
                timeout_seconds=payload.timeout_seconds or 10.0,
            ):
                full_ai_text.append(chunk)
                yield f"data: {chunk}\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"data: [ERROR] {e}\n\n"
        finally:
            # 把 AI 回答持久化，供后续上下文使用
            text = "".join(full_ai_text)
            if text:
                db.add(
                    MockMessage(
                        mock_session_id=record.id,
                        role="ai",
                        content=text,
                    )
                )
                db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
