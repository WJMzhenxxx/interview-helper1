import os
import sys
import locale

# 修复Windows环境编码问题
if sys.platform == "win32":
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    os.environ['PYTHONUTF8'] = '1'

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from app.database import engine, Base
from app.routers import auth, sessions

load_dotenv(encoding='utf-8')

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Create tables
        print("🗄️ 正在创建数据库表...")
        Base.metadata.create_all(bind=engine)
        print("✅ 数据库表创建成功")
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        print("请检查:")
        print("1. PostgreSQL服务是否正在运行")
        print("2. 数据库连接信息是否正确")
        print("3. 数据库密码是否为'root'")
        raise e
    
    yield

app = FastAPI(
    title="AI Interview Helper API",
    description="Backend API for AI Interview Helper application",
    version="0.3.0",
    lifespan=lifespan
)

# CORS middleware
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])

@app.get("/")
async def root():
    return {"message": "AI Interview Helper API v0.3.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}