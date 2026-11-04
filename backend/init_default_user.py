#!/usr/bin/env python3
"""
Initialize default user for AI Interview Helper
Creates a default user with username 'test' and password 'test1234'
依赖 app.database（默认 SQLite，零外部依赖）。
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app.models import User
from app.auth import get_password_hash

def init_default_user():
    Base.metadata.create_all(bind=engine)

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

        print("Default user created successfully:")
        print("  Username: test")
        print("  Password: test1234")
        print("  Email: test@example.com")
        print(f"  User ID: {default_user.id}")

    except Exception as e:
        print(f"Error creating default user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_default_user()
