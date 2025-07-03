#!/bin/bash

# Docker权限修复脚本 (WSL环境)

echo "🔧 检查并修复Docker权限问题..."

# 检查当前用户
echo "当前用户: $(whoami)"

# 检查docker组是否存在
if getent group docker > /dev/null 2>&1; then
    echo "✅ docker组存在"
else
    echo "❌ docker组不存在，正在创建..."
    sudo groupadd docker
fi

# 检查用户是否在docker组中
if groups $USER | grep -q '\bdocker\b'; then
    echo "✅ 用户已在docker组中"
else
    echo "⚠️  用户不在docker组中，正在添加..."
    sudo usermod -aG docker $USER
    echo "✅ 已将用户添加到docker组"
    echo "⚠️  请注销并重新登录，或运行: newgrp docker"
fi

# 检查Docker socket权限
if [ -S /var/run/docker.sock ]; then
    echo "✅ Docker socket存在"
    ls -la /var/run/docker.sock
    
    # 尝试修复权限
    if [ ! -w /var/run/docker.sock ]; then
        echo "⚠️  Docker socket权限不足，尝试修复..."
        sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    fi
else
    echo "❌ Docker socket不存在"
    echo "请确保Docker Desktop在Windows中运行，并启用WSL集成"
fi

# 测试Docker命令
echo ""
echo "🧪 测试Docker命令..."
if docker ps > /dev/null 2>&1; then
    echo "✅ Docker命令可以正常执行"
    docker --version
else
    echo "❌ Docker命令执行失败"
    echo ""
    echo "💡 解决方案："
    echo "1. 确保Docker Desktop在Windows中运行"
    echo "2. 在Docker Desktop设置中启用WSL集成"
    echo "3. 重启WSL终端"
    echo "4. 如果问题持续，运行: newgrp docker"
    
    # 提供替代方案
    echo ""
    echo "🔄 尝试使用newgrp临时解决..."
    exec newgrp docker
fi

echo ""
echo "🎉 Docker权限检查完成！"