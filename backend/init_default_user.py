#!/usr/bin/env python3
"""
Initialize default user for AI Interview Helper
Creates a default user with username 'test' and password 'test1234'
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the current directory to path to import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models import Base, User
from app.auth import get_password_hash

def init_default_user():
    load_dotenv()
    
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:yourpassword@localhost:5432/ai_interview_helper")
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if default user already exists
        existing_user = db.query(User).filter(User.username == "test").first()
        if existing_user:
            print("Default user 'test' already exists")
            return
        
        # Create default user
        hashed_password = get_password_hash("test1234")
        default_user = User(
            username="test",
            email="test@example.com",
            hashed_password=hashed_password,
            is_active=True
        )
        
        db.add(default_user)
        db.commit()
        db.refresh(default_user)
        
        print(f"Default user created successfully:")
        print(f"  Username: test")
        print(f"  Password: test1234")
        print(f"  Email: test@example.com")
        print(f"  User ID: {default_user.id}")
        
    except Exception as e:
        print(f"Error creating default user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_default_user()