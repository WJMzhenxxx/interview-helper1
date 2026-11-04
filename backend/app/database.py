from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# 默认使用 SQLite（零外部依赖，无需安装数据库，文件位于 backend/ 下）
DEFAULT_SQLITE_URL = "sqlite:///./ai_interview_helper.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL) or DEFAULT_SQLITE_URL

# 仅 SQLite 需要关闭跨线程检查（FastAPI 多线程访问）
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
