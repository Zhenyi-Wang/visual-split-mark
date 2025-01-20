# Docker 部署指南

## 环境准备

### 系统要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM 及以上
- 20GB 可用磁盘空间

### 系统配置

#### SELinux 配置（CentOS/RHEL）
```bash
# 检查 SELinux 状态
getenforce

# 临时关闭 SELinux
sudo setenforce 0

# 永久关闭 SELinux（需要重启）
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
```

#### 防火墙配置
```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Docker 安装

#### Windows/macOS
1. 下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. 启动 Docker Desktop
3. 验证安装：
```bash
docker --version
docker-compose --version
```

#### Linux (Ubuntu)
```bash
# 安装依赖
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER
newgrp docker
```

## 容器配置

### 环境变量说明

```bash
# 应用配置
NODE_ENV=production      # 运行环境
HOST=0.0.0.0            # 监听地址
PORT=3000               # 应用端口

# 存储配置
STORAGE_PATH=/app/storage           # 存储根目录
UPLOAD_PATH=/app/storage/uploads    # 上传目录
CONVERT_PATH=/app/storage/converted # 转换目录
BACKUP_PATH=/app/storage/backups    # 备份目录

# 性能配置
MAX_MEMORY=2048         # 最大内存限制（MB）
MAX_CPU_USAGE=2        # 最大 CPU 核心数
```

### 多阶段构建优化

```dockerfile
# 构建阶段优化
FROM node:16-alpine AS builder
# 使用 build cache
COPY package*.json ./
RUN npm ci
# 仅复制必要文件
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

# 运行阶段优化
FROM node:16-alpine
# 使用非 root 用户
RUN adduser -D -u 1000 vsm
USER vsm
# 仅复制必要文件
COPY --from=builder --chown=vsm:vsm /app/.output /app/.output
```

### 1. Dockerfile

```dockerfile
# 构建阶段
FROM node:16-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制项目文件
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段
FROM node:16-alpine

WORKDIR /app

# 安装 FFmpeg
RUN apk add --no-cache ffmpeg

# 复制构建产物
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/package*.json ./

# 创建必要的目录
RUN mkdir -p storage/uploads storage/converted storage/backups

# 设置环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

### 2. Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    image: visual-split-mark
    container_name: vsm-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./storage:/app/storage
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  nginx:
    image: nginx:alpine
    container_name: vsm-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./storage:/app/storage
    depends_on:
      - app
```

### 3. Nginx 配置

```nginx
# nginx/conf.d/default.conf
upstream vsm_backend {
    server app:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost;

    client_max_body_size 100M;

    location / {
        proxy_pass http://vsm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 数据持久化

### 数据恢复
```bash
#!/bin/bash
# restore.sh

# 设置变量
BACKUP_FILE=$1
RESTORE_DIR="storage"

if [ -z "$BACKUP_FILE" ]; then
    echo "请指定备份文件路径"
    exit 1
fi

# 停止容器
docker-compose stop vsm-app

# 清空目标目录
rm -rf $RESTORE_DIR/*

# 解压备份文件
tar -xzf $BACKUP_FILE -C ./

# 修复权限
chown -R 1000:1000 $RESTORE_DIR/

# 启动容器
docker-compose start vsm-app
```

### 数据迁移最佳实践

1. 增量备份策略
```bash
# 使用 rsync 进行增量备份
rsync -avz --delete storage/ backup/storage/
```

2. 自动备份计划
```bash
# 添加到 crontab
0 2 * * * /path/to/backup.sh >> /var/log/vsm-backup.log 2>&1
```

3. 备份验证
```bash
# 验证备份完整性
tar -tzf vsm_data_backup.tar.gz
```

### 1. 卷配置

```yaml
# docker-compose.yml 中的卷配置
volumes:
  storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/storage
```

### 2. 数据备份

创建备份脚本 `backup.sh`：
```bash
#!/bin/bash

# 设置变量
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="vsm-app"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 停止容器
docker-compose stop $CONTAINER

# 备份数据
tar -czf $BACKUP_DIR/vsm_data_$DATE.tar.gz storage/

# 启动容器
docker-compose start $CONTAINER

# 清理旧备份（保留最近7天）
find $BACKUP_DIR -name "vsm_data_*.tar.gz" -mtime +7 -delete
```

### 3. 权限管理

```bash
# 设置目录权限
chmod -R 755 storage/
chown -R 1000:1000 storage/  # 1000 是容器内 node 用户的 UID
```

## 部署步骤

### 1. 准备部署

```bash
# 克隆项目
git clone https://github.com/yourusername/visual-split-mark.git
cd visual-split-mark

# 创建必要的目录
mkdir -p storage/{uploads,converted,backups}
mkdir -p nginx/{conf.d,ssl}
```

### 2. 构建和启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 3. 配置检查

```bash
# 检查容器状态
docker-compose ps

# 检查应用日志
docker-compose logs app

# 检查 Nginx 日志
docker-compose logs nginx
```

## 性能优化

### 1. 容器资源限制

```yaml
# docker-compose.yml 中的资源限制
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 2. 日志管理

```yaml
# docker-compose.yml 中的日志配置
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
```

### 3. 网络优化

```yaml
# docker-compose.yml 中的网络配置
networks:
  vsm-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
```

## 运维管理

### 1. 容器监控

使用 Prometheus 和 Grafana 进行监控：

```yaml
# docker-compose.yml 添加监控服务
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus:/etc/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    volumes:
      - ./grafana:/var/lib/grafana
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
```

### 2. 日志收集

使用 ELK Stack 收集日志：

```yaml
# docker-compose.yml 添加日志服务
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### 3. 自动化部署

创建 GitHub Actions 工作流：

```yaml
# .github/workflows/docker-deploy.yml
name: Docker Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push Docker image
      run: |
        docker-compose build
        docker-compose push
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /path/to/visual-split-mark
          git pull
          docker-compose pull
          docker-compose up -d
```

## 故障排除

### 常见问题排查

1. 容器无法启动
```bash
# 检查系统资源
df -h
free -m
top

# 检查 Docker 日志
journalctl -u docker

# 检查容器详细信息
docker inspect vsm-app
```

2. 网络连接问题
```bash
# 检查网络配置
docker network inspect vsm-network

# 检查端口占用
netstat -tulpn | grep LISTEN

# 测试容器间通信
docker exec vsm-app ping vsm-nginx
```

3. 存储问题
```bash
# 检查磁盘使用情况
du -sh storage/*

# 检查 inode 使用情况
df -i

# 检查文件权限
ls -la storage/
```

### 性能优化建议

1. 容器资源限制
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

2. 日志轮转
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "3"
    compress: "true"
```

3. 存储性能优化
```yaml
volumes:
  storage:
    driver: local
    driver_opts:
      type: none
      o: bind,noatime
      device: /path/to/storage
```

## 下一步

1. 配置[CI/CD](../ops/ci-cd.md)
   - 自动化测试
   - 自动化部署
   - 版本管理

2. 了解[监控方案](../ops/monitoring.md)
   - 性能监控
   - 日志分析
   - 告警配置 