# AI Interview Helper - Frontend

这是一个基于React + TypeScript + Vite的AI面试助手前端项目，支持实时语音转写、AI智能回答和完整的用户认证系统。

## ✨ 主要功能

- 🎤 **实时语音转写** - 集成科大讯飞RTasr API
- 🤖 **AI智能回答** - DeepSeek AI驱动的面试回答建议
- 👤 **用户认证** - 完整的登录/注册/JWT认证系统
- 💾 **会话管理** - 面试记录持久化和历史回顾
- 🔄 **状态同步** - 实时前后端数据同步

## 🚀 快速开始

### 环境要求
- Node.js 16+
- 后端API服务运行在 http://localhost:9000

### 安装和启动
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 默认测试账户
- 用户名：`test`
- 密码：`test1234`

## 🔧 API密钥配置

使用前需要在应用内配置以下API密钥：

1. **科大讯飞语音转写**
   - 申请地址：https://www.xfyun.cn/
   - 在API配置页面填入APPID和APIKEY

2. **DeepSeek AI**
   - 申请地址：https://platform.deepseek.com/
   - 在API配置页面填入APIKEY

## 🛠️ 技术栈

- **React 19** + TypeScript + Vite
- **Ant Design** - 企业级UI组件库
- **Zustand** - 轻量级状态管理 (interviewStore, authStore)
- **Axios** - HTTP客户端和JWT认证拦截
- **WebAudio API** - 实时音频处理
- **Styled Components** - CSS-in-JS样式

## 开发环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

## 安装依赖

```bash
npm install
```

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 运行类型检查
npm run type-check

# 运行代码检查
npm run lint
```

## 项目结构

```
src/
  ├── api/          # API请求和拦截器
  ├── components/   # 可复用组件
  ├── hooks/        # 自定义Hooks
  ├── layouts/      # 布局组件
  ├── pages/        # 页面组件
  ├── store/        # 状态管理
  ├── types/        # TypeScript类型定义
  ├── utils/        # 工具函数
  └── App.tsx       # 应用入口
```

## 🔧 环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:9000
```

### API集成说明

- **后端API**: `/api/auth/*`, `/api/sessions/*`
- **语音转写**: 科大讯飞RTasr WebSocket API
- **AI回答**: DeepSeek Coder API

## 开发规范

- 使用TypeScript进行开发
- 遵循ESLint规则
- 使用Prettier进行代码格式化
- 组件使用函数式组件和Hooks
- 状态管理使用Zustand
- UI组件使用Ant Design

## 贡献指南

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 🤝 贡献指南

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)  
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 更多信息

查看项目根目录的 [README.md](../README.md) 获取完整的项目说明和后端配置指南。