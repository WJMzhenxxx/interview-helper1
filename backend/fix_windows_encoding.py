#!/usr/bin/env python3
"""
Windows环境编码问题修复脚本
"""

import os
import sys
import locale

def fix_windows_encoding():
    """修复Windows环境下的编码问题"""
    
    print("🔧 检查和修复Windows环境编码问题...")
    
    # 设置环境变量
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    os.environ['PYTHONUTF8'] = '1'
    
    # 检查系统编码
    print(f"系统默认编码: {locale.getpreferredencoding()}")
    print(f"文件系统编码: {sys.getfilesystemencoding()}")
    print(f"stdout编码: {sys.stdout.encoding}")
    
    # 检查数据库URL
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    print(f"数据库URL: {db_url}")
    
    # 验证URL编码
    try:
        db_url_bytes = db_url.encode('utf-8')
        db_url_decoded = db_url_bytes.decode('utf-8')
        print("✅ 数据库URL编码正常")
    except Exception as e:
        print(f"❌ 数据库URL编码异常: {e}")
        return False
    
    return True

def test_database_connection():
    """测试数据库连接"""
    try:
        from app.database import engine
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            print("✅ 数据库连接成功")
            return True
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

if __name__ == "__main__":
    print("🚀 开始Windows环境编码修复...")
    
    if fix_windows_encoding():
        print("✅ 编码环境检查完成")
        
        if test_database_connection():
            print("✅ 数据库连接测试成功")
        else:
            print("❌ 数据库连接测试失败")
            print("请检查PostgreSQL是否正在运行，密码是否正确")
    else:
        print("❌ 编码环境修复失败")
    
    print("\n📝 解决方案建议:")
    print("1. 确保PostgreSQL服务正在运行")
    print("2. 检查数据库密码是否为'root'")
    print("3. 如果问题持续，请尝试修改DATABASE_URL中的密码")
    print("4. 建议在Windows Terminal或PowerShell中运行，避免使用Git Bash")