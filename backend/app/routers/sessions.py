from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import uuid

from ..database import get_db
from ..models import User as UserModel, InterviewSession, SessionMessage
from ..schemas import (
    InterviewSessionCreate, 
    InterviewSession as InterviewSessionSchema,
    InterviewSessionList,
    SessionMessageCreate,
    SessionMessage as SessionMessageSchema
)
from ..auth import get_current_active_user

router = APIRouter()

@router.post("/", response_model=InterviewSessionSchema)
async def create_session(
    session: InterviewSessionCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Create new session
    db_session = InterviewSession(
        user_id=current_user.id,
        session_id=session_id,
        title=session.title or f"Interview Session - {session_id[:8]}"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return db_session

@router.get("/", response_model=List[InterviewSessionList])
async def get_user_sessions(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get sessions with message count
    sessions = db.query(
        InterviewSession,
        func.count(SessionMessage.id).label('message_count')
    ).outerjoin(SessionMessage).filter(
        InterviewSession.user_id == current_user.id
    ).group_by(InterviewSession.id).order_by(
        InterviewSession.updated_at.desc()
    ).all()
    
    result = []
    for session, message_count in sessions:
        result.append({
            "id": session.id,
            "session_id": session.session_id,
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "message_count": message_count or 0
        })
    
    return result

@router.get("/{session_id}", response_model=InterviewSessionSchema)
async def get_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(
        InterviewSession.session_id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    return session

@router.post("/{session_id}/messages", response_model=SessionMessageSchema)
async def add_message_to_session(
    session_id: str,
    message: SessionMessageCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get session
    session = db.query(InterviewSession).filter(
        InterviewSession.session_id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Create message
    db_message = SessionMessage(
        session_id=session.id,
        message_type=message.message_type,
        content=message.content,
        message_metadata=message.message_metadata
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    # Update session timestamp
    from datetime import datetime
    session.updated_at = datetime.utcnow()
    db.commit()
    
    return db_message

@router.get("/{session_id}/messages", response_model=List[SessionMessageSchema])
async def get_session_messages(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get session
    session = db.query(InterviewSession).filter(
        InterviewSession.session_id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    messages = db.query(SessionMessage).filter(
        SessionMessage.session_id == session.id
    ).order_by(SessionMessage.timestamp.asc()).all()
    
    return messages

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(
        InterviewSession.session_id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Delete all messages first
    db.query(SessionMessage).filter(SessionMessage.session_id == session.id).delete()
    
    # Delete session
    db.delete(session)
    db.commit()
    
    return {"detail": "Session deleted successfully"}