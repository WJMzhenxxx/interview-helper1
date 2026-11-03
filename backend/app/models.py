from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    sessions = relationship("InterviewSession", back_populates="user")

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="sessions")
    messages = relationship("SessionMessage", back_populates="session")

class SessionMessage(Base):
    __tablename__ = "session_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    message_type = Column(String, nullable=False)  # 'user', 'assistant', 'transcription'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    message_metadata = Column(Text, nullable=True)  # JSON string for additional data
    
    # Relationship
    session = relationship("InterviewSession", back_populates="messages")

class MockSession(Base):
    """模拟面试会话：面试官（使用者）与 AI 扮演的面试者之间的模拟面试。"""
    __tablename__ = "mock_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # 应聘岗位 JD 文本
    jd = Column(Text, nullable=True)
    # AI 面试者简历文本
    resume = Column(Text, nullable=True)
    # 面试者水平等级：unlimited/high/medium/low
    level = Column(String, nullable=False, default="unlimited")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="mock_sessions")
    messages = relationship(
        "MockMessage", back_populates="session",
        cascade="all, delete-orphan", order_by="MockMessage.created_at",
    )

class MockMessage(Base):
    """模拟面试中的一条对话消息。role: interviewer=面试官(使用者) / ai=AI面试者。"""
    __tablename__ = "mock_messages"

    id = Column(Integer, primary_key=True, index=True)
    mock_session_id = Column(Integer, ForeignKey("mock_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # 'interviewer' | 'ai'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("MockSession", back_populates="messages")