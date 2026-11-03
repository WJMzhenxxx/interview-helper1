from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

# User schemas
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Session schemas
class SessionMessageBase(BaseModel):
    message_type: str
    content: str
    message_metadata: Optional[str] = None

class SessionMessageCreate(SessionMessageBase):
    pass

class SessionMessage(SessionMessageBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

class InterviewSessionBase(BaseModel):
    title: Optional[str] = None

class InterviewSessionCreate(InterviewSessionBase):
    pass

class InterviewSession(InterviewSessionBase):
    id: int
    session_id: str
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: List[SessionMessage] = []
    
    class Config:
        from_attributes = True

class InterviewSessionList(BaseModel):
    id: int
    session_id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    
    class Config:
        from_attributes = True

# 模拟面试 schemas
class MockSessionCreate(BaseModel):
    jd: Optional[str] = None
    resume: Optional[str] = None
    level: str = "unlimited"

class MockMessageCreate(BaseModel):
    role: str  # 'interviewer' | 'ai'
    content: str

class MockMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class MockSessionOut(BaseModel):
    id: int
    session_id: str
    jd: Optional[str] = None
    resume: Optional[str] = None
    level: str
    created_at: datetime
    updated_at: datetime
    messages: List[MockMessageOut] = []

    class Config:
        from_attributes = True

class MockRespondRequest(BaseModel):
    """触发 AI 面试者回应的请求体。"""
    session_id: str
    # 面试官当前说的话（新问题）
    interviewer_message: str
    # 限时（秒），默认 10
    timeout_seconds: float = 10.0