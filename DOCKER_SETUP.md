# Docker环境设置指南

## WSL环境下的Docker配置

### 1. 确保Docker Desktop运行

在Windows上启动Docker Desktop，确保Docker服务正在运行。

### 2. WSL中的Docker配置

确保在WSL中可以访问Docker：

```bash
# 检查Docker是否可用
docker --version
docker ps

# 如果遇到权限问题，可能需要重启Docker Desktop
# 或者在Windows中重新启动Docker Desktop的WSL集成
```

### 3. 启动AI面试助手

#### 方法一：一键启动开发环境
```bash
# 给脚本执行权限
chmod +x scripts/dev-start.sh

# 启动开发环境
./scripts/dev-start.sh
```

#### 方法二：手动启动
```bash
# 停止可能存在的旧容器
docker-compose -f docker-compose.dev.yml down

# 构建并启动
docker-compose -f docker-compose.dev.yml up --build -d

# 等待数据库启动
sleep 15

# 初始化默认用户
docker-compose -f docker-compose.dev.yml exec backend python init_default_user.py
```

### 4. 验证服务

```bash
# 查看容器状态
docker-compose -f docker-compose.dev.yml ps

# 查看日志
docker-compose -f docker-compose.dev.yml logs

# 测试API
curl http://localhost:9000/health
```

### 5. 常见问题解决

#### Docker权限问题
```bash
# 确保Docker Desktop在Windows中运行
# 重启Docker Desktop的WSL集成：
# Docker Desktop -> Settings -> Resources -> WSL Integration
```

#### 端口占用问题
```bash
# 检查端口占用
netstat -tulpn | grep :9000
netstat -tulpn | grep :5432

# 如果端口被占用，停止占用进程或修改docker-compose.dev.yml中的端口映射
```

#### 数据库连接问题
```bash
# 查看PostgreSQL容器日志
docker-compose -f docker-compose.dev.yml logs postgres

# 进入PostgreSQL容器检查
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d ai_interview_helper
```

## 开发工作流

### 日常开发

1. **启动环境**：
   ```bash
   ./scripts/dev-start.sh
   ```

2. **查看日志**：
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f backend
   ```

3. **进入容器调试**：
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend bash
   ```

4. **重启服务**：
   ```bash
   docker-compose -f docker-compose.dev.yml restart backend
   ```

5. **停止环境**：
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

### 数据管理

1. **重置数据库**：
   ```bash
   docker-compose -f docker-compose.dev.yml down -v
   ./scripts/dev-start.sh
   ```

2. **备份数据**：
   ```bash
   docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U postgres ai_interview_helper > backup.sql
   ```

3. **恢复数据**：
   ```bash
   docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres ai_interview_helper < backup.sql
   ```

## 生产环境部署

```bash
# 启动生产环境
./scripts/docker-start.sh

# 或手动启动
docker-compose up --build -d
```

## 故障排除

### 检查Docker状态
```bash
# 检查Docker服务
docker info

# 检查容器状态
docker ps -a

# 检查网络
docker network ls
```

### 清理Docker环境
```bash
# 停止所有容器
docker-compose -f docker-compose.dev.yml down

# 清理未使用的镜像
docker image prune

# 清理未使用的卷（谨慎使用）
docker volume prune
```

### 重新构建镜像
```bash
# 强制重新构建
docker-compose -f docker-compose.dev.yml build --no-cache

# 重新启动
docker-compose -f docker-compose.dev.yml up -d
```