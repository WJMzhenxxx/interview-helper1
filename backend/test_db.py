#!/usr/bin/env python3
"""
Test database connection and create database if needed
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def test_and_create_db():
    load_dotenv()
    
    # First try to connect to postgres to create the database
    postgres_url = "postgresql://postgres:root@localhost:5432/postgres"
    target_db = "ai_interview_helper"
    
    try:
        # Connect to postgres database
        engine = create_engine(postgres_url)
        with engine.connect() as conn:
            # Check if database exists
            result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname = '{target_db}'"))
            if not result.fetchone():
                # Database doesn't exist, create it
                conn.execute(text("COMMIT"))  # End any existing transaction
                conn.execute(text(f"CREATE DATABASE {target_db}"))
                print(f"Database '{target_db}' created successfully")
            else:
                print(f"Database '{target_db}' already exists")
    except Exception as e:
        print(f"Error with database operations: {e}")
        return False
    
    # Test connection to the target database
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/ai_interview_helper")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print(f"Successfully connected to database at {DATABASE_URL}")
            return True
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return False

if __name__ == "__main__":
    test_and_create_db()