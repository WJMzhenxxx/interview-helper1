# AI Interview Helper

AI面试助手是一个基于React的智能面试准备工具，提供实时语音转文字、AI智能回答建议和完整的面试会话管理功能。

## ✨ 主要功能

- 🎤 **实时语音转写** - 基于科大讯飞RTasr API的高精度语音识别
- 🤖 **AI智能回答** - 集成DeepSeek AI提供面试问题的智能回答建议  
- 💾 **会话持久化** - 完整的面试记录保存和历史回顾
- 👤 **用户认证** - 基于JWT的安全用户登录系统
- 🔄 **实时同步** - 前后端实时数据同步和状态管理

## 🏗️ 技术架构

### 前端技术栈
- **React 19** + TypeScript + Vite
- **Ant Design** - 企业级UI组件库
- **Zustand** - 轻量级状态管理
- **Axios** - HTTP客户端和请求拦截
- **WebAudio API** - 实时音频处理

### 后端技术栈
- **FastAPI** - 高性能Python Web框架
- **PostgreSQL** - 关系型数据库
- **Redis** - 缓存和会话存储
- **JWT** - 用户认证和授权
- **SQLAlchemy** - ORM数据库操作

## 🚀 快速开始

### 环境要求

- Node.js 16+
- Python 3.9+
- PostgreSQL 17+ (推荐Docker)
- Redis 7+ (推荐Docker)

### 1. 使用Docker启动（推荐）

#### 方法一：一键启动所有服务（推荐）
```bash
# 启动生产环境
chmod +x scripts/docker-start.sh
./scripts/docker-start.sh

# 或启动开发环境（支持代码热重载）
chmod +x scripts/dev-start.sh
./scripts/dev-start.sh
```

#### 方法二：使用docker-compose
```bash
# 生产环境
docker-compose up --build -d

# 开发环境
docker-compose -f docker-compose.dev.yml up --build -d
```

#### 方法三：单独启动数据库服务
```bash
# PostgreSQL
docker run --name postgres-ai-interview \
  -e POSTGRES_PASSWORD=root \
  -p 5432:5432 \
  -d postgres:17.5

# Redis  
docker run --name redis-ai-interview \
  -p 6379:6379 \
  -d redis:7.4-alpine
```

### 2. 传统方式启动后端（可选）

> 💡 **推荐使用上面的Docker方式启动，可避免环境配置问题**

#### Linux/macOS/WSL环境:
```bash
cd backend
chmod +x setup.sh
./setup.sh  # 自动创建.env配置文件
python run_server.py
```

#### Windows环境:
```bash
cd backend
python test_connection.py  # 测试数据库连接
python run_server_windows.py  # Windows专用启动脚本
```

### 3. 前端启动

#### 方法一：使用自动化脚本 (推荐)
```bash
cd frontend
chmod +x setup.sh
./setup.sh  # 自动创建.env配置文件
npm run dev
```

#### 方法二：手动安装
```bash
# 进入前端目录
cd frontend

# 复制环境变量模板
cp .env.example .env

# 安装依赖
npm install

# 启动开发服务器 (运行在 http://localhost:5173)
npm run dev
```

### 4. 默认测试账户

- **用户名**: `test`
- **密码**: `test1234`
- **邮箱**: `test@example.com`

### 5. API密钥配置

使用前需要配置API密钥（在应用内设置）：

1. **DeepSeek AI API**: 在应用的API配置页面填入密钥
2. **科大讯飞语音API**: 在应用的语音设置页面配置APPID和APIKEY

> 💡 **安全提示**: 所有API密钥都通过应用内界面配置，不会硬编码在代码中

## 📁 项目结构

```
ai-interview-helper-react/
├── frontend/                 # React前端应用
│   ├── src/
│   │   ├── api/             # API接口封装
│   │   ├── components/      # 可复用组件
│   │   ├── pages/           # 页面组件
│   │   ├── store/           # Zustand状态管理
│   │   └── utils/           # 工具函数
│   └── public/
├── backend/                  # FastAPI后端应用
│   ├── app/
│   │   ├── models.py        # 数据库模型
│   │   ├── schemas.py       # Pydantic模型
│   │   ├── auth.py          # 认证逻辑
│   │   └── routers/         # API路由
│   ├── main.py              # 应用入口
│   └── requirements.txt     # Python依赖
└── memory-bank/             # 项目文档和上下文
```

## 🔧 配置说明

### 环境变量配置

**后端配置** (backend/.env):
```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/ai_interview_helper
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**前端配置** (frontend/.env):
```env
VITE_API_BASE_URL=http://localhost:9000
```

### API密钥申请

1. **科大讯飞语音转写API** - 申请地址：https://www.xfyun.cn/
2. **DeepSeek AI API** - 申请地址：https://platform.deepseek.com/

申请后在应用内设置页面配置，不需要修改代码文件。

## 📊 API文档

后端启动后可访问自动生成的API文档：
- **Swagger UI**: http://localhost:9000/docs
- **ReDoc**: http://localhost:9000/redoc

### 主要API端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/sessions/` | GET/POST | 会话管理 |
| `/api/sessions/{id}/messages` | GET/POST | 消息管理 |

## 🛠️ 开发命令

### Docker开发（推荐）

```bash
# 启动开发环境
./scripts/dev-start.sh

# 查看日志
./scripts/docker-logs.sh

# 查看特定服务日志
./scripts/docker-logs.sh backend
./scripts/docker-logs.sh postgres

# 重启服务
./scripts/docker-restart.sh

# 停止服务
./scripts/docker-stop.sh

# 进入后端容器调试
docker-compose -f docker-compose.dev.yml exec backend bash
```

### 前端开发
```bash
cd frontend
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run lint     # 代码检查
npm run preview  # 预览构建结果
```

### 传统后端开发

**Linux/macOS/WSL**:
```bash
cd backend
source venv/bin/activate
python run_server.py          # 启动开发服务器
python init_default_user.py   # 重置默认用户
python test_db.py             # 测试数据库连接
```

**Windows**:
```bash
cd backend
venv\Scripts\activate
python run_server_windows.py  # Windows专用启动脚本
python test_connection.py     # 测试数据库连接
python init_default_user.py   # 重置默认用户
```

### Docker管理命令

```bash
# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 重新构建并启动
docker-compose up --build -d

# 停止并删除容器
docker-compose down

# 清理所有数据（谨慎使用）
docker-compose down -v
```

## 📈 版本路线图

- ✅ **v0.1** - 基础前端UI和语音转写功能
- ✅ **v0.2** - AI回答功能和实时对话体验
- ✅ **v0.3** - 后端架构和数据持久化
- 🔄 **v0.4** - 多模型支持和API配置管理
- 📋 **v0.5** - 完善用户系统和登录页面

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request
6. 加我WeChat: JarvanJason 一起贡献

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 科大讯飞提供优秀的语音识别API
- DeepSeek提供强大的AI模型支持
- Ant Design提供优雅的UI组件库
- 面试狗提供UI灵感

## 正在解决的问题
触发AI提问的时机难以控制, 准确率低, 需要帮忙改进

## 使用截图
![](./public/tutorial1.png)
![](./public/turorial2.png)