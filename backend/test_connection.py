#!/usr/bin/env python3
"""
数据库连接测试脚本 - Windows兼容版本
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

# 设置编码
if sys.platform == "win32":
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    os.environ['PYTHONUTF8'] = '1'

def test_direct_connection():
    """直接测试PostgreSQL连接"""
    try:
        print("🔗 直接测试PostgreSQL连接...")
        
        # 使用基本连接参数
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="postgres",  # 先连接到默认数据库
            user="postgres",
            password="root"
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ PostgreSQL版本: {version[0]}")
        
        # 检查目标数据库是否存在
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'ai_interview_helper';")
        db_exists = cursor.fetchone()
        
        if not db_exists:
            print("🔧 创建目标数据库...")
            # 注意：CREATE DATABASE不能在事务中执行
            conn.autocommit = True
            cursor.execute("CREATE DATABASE ai_interview_helper;")
            print("✅ 数据库创建成功")
        else:
            print("✅ 目标数据库已存在")
        
        cursor.close()
        conn.close()
        
        # 测试连接到目标数据库
        print("🔗 测试连接到目标数据库...")
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="ai_interview_helper",
            user="postgres",
            password="root"
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        result = cursor.fetchone()
        print("✅ 目标数据库连接成功")
        
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as e:
        print(f"❌ PostgreSQL连接错误: {e}")
        return False
    except Exception as e:
        print(f"❌ 其他错误: {e}")
        return False

def test_sqlalchemy_connection():
    """测试SQLAlchemy连接"""
    try:
        print("🔗 测试SQLAlchemy连接...")
        
        from dotenv import load_dotenv
        load_dotenv(encoding='utf-8')
        
        from sqlalchemy import create_engine, text
        
        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/ai_interview_helper")
        print(f"数据库URL: {db_url}")
        
        engine = create_engine(db_url)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            print("✅ SQLAlchemy连接成功")
            return True
            
    except Exception as e:
        print(f"❌ SQLAlchemy连接失败: {e}")
        return False

def main():
    print("🧪 数据库连接测试工具")
    print("=" * 40)
    
    # 检查psycopg2是否可用
    try:
        import psycopg2
        print("✅ psycopg2模块可用")
    except ImportError:
        print("❌ psycopg2模块未安装")
        print("请运行: pip install psycopg2-binary")
        return False
    
    # 直接连接测试
    if not test_direct_connection():
        print("\n💡 直接连接失败，可能的原因:")
        print("1. PostgreSQL服务未启动")
        print("2. 密码不正确（应该是'root'）")
        print("3. 端口5432被占用或无法访问")
        print("4. 防火墙阻止连接")
        return False
    
    # SQLAlchemy连接测试
    if not test_sqlalchemy_connection():
        print("❌ SQLAlchemy连接失败")
        return False
    
    print("\n🎉 所有测试通过！数据库连接正常")
    return True

if __name__ == "__main__":
    if main():
        print("\n✅ 可以安全启动后端服务器")
    else:
        print("\n❌ 请先解决数据库连接问题")