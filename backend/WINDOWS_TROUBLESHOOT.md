# Windows环境故障排除指南

## 常见问题解决方案

### 1. UTF-8编码错误

**错误信息**: `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xd6`

**解决方案**:
```bash
# 方案1: 使用Windows专用启动脚本
python run_server_windows.py

# 方案2: 设置环境变量后启动
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
python run_server.py

# 方案3: 在PowerShell中设置
$env:PYTHONIOENCODING="utf-8"
$env:PYTHONUTF8="1"
python run_server.py
```

### 2. 数据库连接问题

**测试连接**:
```bash
python test_connection.py
```

**常见问题**:
- PostgreSQL服务未启动
- 密码错误（应该是'root'）
- 端口5432被占用
- 数据库不存在

**解决步骤**:
1. 确认PostgreSQL容器正在运行
2. 检查端口占用: `netstat -an | findstr 5432`
3. 验证密码是否为'root'
4. 手动创建数据库（如果需要）

### 3. 依赖安装问题

**Windows下推荐使用**:
```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (CMD)
venv\Scripts\activate

# 激活虚拟环境 (PowerShell)
venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt
```

### 4. 路径问题

**避免使用包含中文的路径**:
- 项目路径不要包含中文字符
- 用户名不要包含中文字符
- 使用英文路径如: `C:\projects\ai-interview-helper`

### 5. 终端选择

**推荐使用**:
1. Windows Terminal (首选)
2. PowerShell
3. CMD

**避免使用**:
- Git Bash (可能有编码问题)
- WSL内的终端 (路径映射问题)

### 6. Docker数据库配置

**确保PostgreSQL容器配置正确**:
```bash
docker run --name postgres-ai-interview ^
  -e POSTGRES_PASSWORD=root ^
  -p 5432:5432 ^
  -d postgres:17.5
```

**检查容器状态**:
```bash
docker ps
docker logs postgres-ai-interview
```

### 7. 防火墙和网络

**Windows防火墙**:
- 确保允许Python访问网络
- 检查5432端口是否被阻止

**网络测试**:
```bash
# 测试端口连通性
telnet localhost 5432
```

## 快速诊断脚本

运行诊断脚本检查环境:
```bash
python fix_windows_encoding.py
```

## 完整启动流程 (Windows)

1. **启动PostgreSQL容器**
```bash
docker run --name postgres-ai-interview -e POSTGRES_PASSWORD=root -p 5432:5432 -d postgres:17.5
```

2. **测试数据库连接**
```bash
python test_connection.py
```

3. **启动后端服务**
```bash
python run_server_windows.py
```

4. **验证服务**
访问: http://localhost:9000/docs

## 联系支持

如果问题仍然存在，请提供以下信息:
- Windows版本
- Python版本
- 错误完整堆栈信息
- 数据库连接测试结果