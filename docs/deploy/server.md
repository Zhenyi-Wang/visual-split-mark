# 服务器部署指南

## 系统要求

### 1. 硬件配置

- CPU: 4核及以上
- 内存: 8GB及以上
- 硬盘: 50GB及以上（SSD推荐）
- 网络: 100Mbps及以上

### 2. 软件环境

- 操作系统: Ubuntu 20.04 LTS
- Node.js 16.x
- Nginx 1.18+
- FFmpeg 4.x
- PM2
- Git

## 服务器准备

### 1. 系统更新

```bash
# 更新系统包
sudo apt update
sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git build-essential
```

### 2. 安装 Node.js

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -

# 安装 Node.js
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 安装 FFmpeg

```bash
# 安装 FFmpeg
sudo apt install -y ffmpeg

# 验证安装
ffmpeg -version
```

### 4. 安装 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证安装
nginx -v
```

## 应用部署

### 1. 创建部署用户

```bash
# 创建用户
sudo useradd -m -s /bin/bash vsm

# 添加到 sudo 组
sudo usermod -aG sudo vsm

# 设置密码
sudo passwd vsm

# 切换到部署用户
su - vsm
```

### 2. 配置应用目录

```bash
# 创建应用目录
mkdir -p ~/apps/visual-split-mark
cd ~/apps/visual-split-mark

# 创建必要的子目录
mkdir -p {logs,storage/{uploads,converted,backups}}

# 设置目录权限
chmod -R 755 storage/
```

### 3. 部署应用代码

```bash
# 克隆代码
git clone https://github.com/yourusername/visual-split-mark.git .

# 安装依赖
npm install

# 创建环境配置
cp .env.example .env

# 编辑配置文件
nano .env
```

### 4. 配置 PM2

```bash
# 安装 PM2
sudo npm install -g pm2

# 创建 PM2 配置
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'visual-split-mark',
    script: '.output/server/index.mjs',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# 构建应用
npm run build

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 配置开机自启
pm2 startup
```

## Nginx 配置

### 1. 创建 Nginx 配置

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/visual-split-mark.conf
```

配置内容：
```nginx
upstream vsm_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name vsm.yourdomain.com;

    # 日志配置
    access_log /var/log/nginx/vsm-access.log;
    error_log /var/log/nginx/vsm-error.log;

    # 客户端上传限制
    client_max_body_size 100M;
    
    # 超时设置
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;
    send_timeout 300;

    # 静态文件缓存
    location /assets/ {
        alias /home/vsm/apps/visual-split-mark/.output/public/assets/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # API 请求
    location /api/ {
        proxy_pass http://vsm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 其他请求
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

### 2. 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/visual-split-mark.conf /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

## HTTPS 配置

### 1. 安装 Certbot

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d vsm.yourdomain.com

# 测试自动续期
sudo certbot renew --dry-run
```

### 2. 更新 Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name vsm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vsm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vsm.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # 现代兼容性
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (uncomment if you're sure)
    # add_header Strict-Transport-Security "max-age=63072000" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # ... 其他配置保持不变
}
```

## 负载均衡

### 1. 配置多个后端实例

```bash
# 修改 PM2 配置
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'visual-split-mark',
    script: '.output/server/index.mjs',
    instances: 'max',  // 根据 CPU 核心数自动分配
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '3000'
    }
  }]
}
```

### 2. 更新 Nginx 负载均衡配置

```nginx
upstream vsm_backend {
    least_conn;  # 最少连接数负载均衡
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    keepalive 64;
}
```

## 监控和日志

### 1. 配置日志收集

```bash
# 安装 Filebeat
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-7.15.0-amd64.deb
sudo dpkg -i filebeat-7.15.0-amd64.deb

# 配置 Filebeat
sudo nano /etc/filebeat/filebeat.yml
```

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /home/vsm/apps/visual-split-mark/logs/*.log
    - /var/log/nginx/vsm-*.log

output.elasticsearch:
  hosts: ["localhost:9200"]
```

### 2. 配置监控告警

```bash
# 安装 Prometheus Node Exporter
sudo apt install -y prometheus-node-exporter

# 配置 Prometheus
sudo nano /etc/prometheus/prometheus.yml
```

```yaml
scrape_configs:
  - job_name: 'visual-split-mark'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## 性能优化

### 1. 系统优化

```bash
# 调整系统限制
sudo nano /etc/security/limits.conf
```

```
vsm soft nofile 65535
vsm hard nofile 65535
```

### 2. Nginx 优化

```nginx
# 工作进程数
worker_processes auto;

# 每个工作进程的连接数
events {
    worker_connections 1024;
    multi_accept on;
    use epoll;
}

# HTTP 优化
http {
    # 开启 gzip 压缩
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_types
        application/javascript
        application/json
        text/css
        text/plain;

    # 缓冲区设置
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 100m;
    large_client_header_buffers 2 1k;

    # 超时设置
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
}
```

### 3. Node.js 优化

```bash
# 设置环境变量
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"
```

## 安全配置

### 1. 防火墙配置

```bash
# 安装 UFW
sudo apt install -y ufw

# 配置规则
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# 启用防火墙
sudo ufw enable
```

### 2. 安全头部配置

```nginx
# 添加安全头部
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 备份策略

### 1. 数据备份

```bash
# 创建备份脚本
nano backup.sh
```

```bash
#!/bin/bash

# 设置变量
BACKUP_DIR="/backup/visual-split-mark"
APP_DIR="/home/vsm/apps/visual-split-mark"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz $APP_DIR/storage/
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz $APP_DIR/logs/

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 2. 数据恢复

```bash
# 创建恢复脚本
nano restore.sh
```

```bash
#!/bin/bash

# 设置变量
BACKUP_FILE=$1
APP_DIR="/home/vsm/apps/visual-split-mark"

# 停止应用
pm2 stop visual-split-mark

# 恢复数据
tar -xzf $BACKUP_FILE -C $APP_DIR

# 修复权限
chown -R vsm:vsm $APP_DIR
chmod -R 755 $APP_DIR/storage

# 启动应用
pm2 start visual-split-mark
```

## 故障排除

### 1. 应用无法启动

**问题**: PM2 启动失败
**解决方案**:
1. 检查日志：
```bash
pm2 logs visual-split-mark
```

2. 检查权限：
```bash
ls -la /home/vsm/apps/visual-split-mark
sudo chown -R vsm:vsm /home/vsm/apps/visual-split-mark
```

### 2. Nginx 配置错误

**问题**: 502 Bad Gateway
**解决方案**:
1. 检查应用状态：
```bash
pm2 status
```

2. 检查 Nginx 日志：
```bash
sudo tail -f /var/log/nginx/error.log
```

### 3. 性能问题

**问题**: 响应缓慢
**解决方案**:
1. 检查系统负载：
```bash
top
vmstat 1
```

2. 检查 Node.js 内存：
```bash
pm2 monit
```

## 下一步

1. 配置[Docker部署](docker.md)
   - 容器化部署
   - Docker Compose
   - 自动化构建

2. 了解[监控方案](../ops/monitoring.md)
   - 性能监控
   - 日志分析
   - 告警配置 