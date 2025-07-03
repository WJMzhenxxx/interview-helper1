#!/usr/bin/env python3
"""
Run the FastAPI server
"""

import uvicorn
import os

if __name__ == "__main__":
    # 检查是否在Docker容器中运行
    is_docker = os.path.exists('/.dockerenv')
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=not is_docker,  # Docker中禁用自动重载以提高性能
        log_level="info",
        access_log=True
    )