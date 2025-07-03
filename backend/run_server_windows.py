#!/usr/bin/env python3
"""
Windows环境专用的FastAPI服务器启动脚本
解决编码和路径问题
"""

import os
import sys
import locale

def setup_windows_environment():
    """设置Windows环境变量"""
    # 设置编码环境变量
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    os.environ['PYTHONUTF8'] = '1'
    os.environ['LANG'] = 'en_US.UTF-8'
    os.environ['LC_ALL'] = 'en_US.UTF-8'
    
    # 设置Python路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

def check_environment():
    """检查环境配置"""
    print("🔍 检查环境配置...")
    print(f"Python版本: {sys.version}")
    print(f"系统平台: {sys.platform}")
    print(f"文件系统编码: {sys.getfilesystemencoding()}")
    print(f"默认编码: {locale.getpreferredencoding()}")
    print(f"当前目录: {os.getcwd()}")

def test_database_connection():
    """测试数据库连接"""
    try:
        print("🗄️ 测试数据库连接...")
        from dotenv import load_dotenv
        load_dotenv(encoding='utf-8')
        
        # 检查环境变量
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            print("❌ 未找到DATABASE_URL环境变量")
            return False
        
        print(f"数据库URL: {db_url}")
        
        # 测试连接
        from app.database import engine
        with engine.connect() as conn:
            result = conn.execute("SELECT 1").scalar()
            print("✅ 数据库连接成功")
            return True
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("\n💡 解决建议:")
        print("1. 确保PostgreSQL服务正在运行")
        print("2. 检查端口5432是否被占用")
        print("3. 验证数据库密码是否为'root'")
        print("4. 尝试手动创建数据库: CREATE DATABASE ai_interview_helper;")
        return False

def start_server():
    """启动FastAPI服务器"""
    try:
        import uvicorn
        print("🚀 启动FastAPI服务器...")
        
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=9000,
            reload=True,
            log_level="info",
            access_log=True
        )
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Windows环境AI面试助手后端启动器")
    print("=" * 50)
    
    # 设置环境
    setup_windows_environment()
    
    # 检查环境
    check_environment()
    
    # 测试数据库连接
    if not test_database_connection():
        print("\n❌ 数据库连接失败，无法启动服务器")
        print("请先解决数据库连接问题")
        sys.exit(1)
    
    # 启动服务器
    print("\n🎯 所有检查通过，正在启动服务器...")
    start_server()