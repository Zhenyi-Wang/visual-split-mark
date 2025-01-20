# 本地部署指南

## 环境准备

### 1. 系统要求

- 操作系统：Windows 10/11、macOS 10.15+、Linux (Ubuntu 20.04+)
- CPU：双核及以上
- 内存：4GB 及以上
- 硬盘：10GB 可用空间

### 2. 软件依赖

- Node.js 16.x 或更高版本
- FFmpeg 4.x 或更高版本
- Git（用于版本控制）
- PM2（用于进程管理，可选）

## 部署步骤

### 1. 获取代码

```bash
# 克隆仓库
git clone https://github.com/yourusername/visual-split-mark.git
cd visual-split-mark

# 切换到稳定版本
git checkout v1.0.0  # 替换为最新的稳定版本
```

### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

### 3. 配置环境变量

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件：
```ini
# 应用配置
APP_NAME=Visual Split Mark
APP_PORT=3000
NODE_ENV=production

# 存储路径
STORAGE_PATH=./storage
UPLOAD_PATH=./storage/uploads
CONVERTED_PATH=./storage/converted

# Whisper API 配置（可选）
WHISPER_API_URL=
WHISPER_API_KEY=
```

### 4. 创建存储目录

```bash
# 创建必要的目录
mkdir -p storage/uploads
mkdir -p storage/converted
mkdir -p storage/backups

# 设置目录权限（Linux/macOS）
chmod -R 755 storage
```

### 5. 构建应用

```bash
# 构建生产版本
npm run build

# 或使用 yarn
yarn build

# 或使用 pnpm
pnpm build
```

### 6. 启动应用

#### 方式一：直接启动

```bash
# 启动生产服务器
npm run start

# 或使用 yarn
yarn start

# 或使用 pnpm
pnpm start
```

#### 方式二：使用 PM2（推荐）

1. 安装 PM2：
```bash
npm install -g pm2
```

2. 创建 PM2 配置文件 `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [{
    name: 'visual-split-mark',
    script: '.output/server/index.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

3. 启动应用：
```bash
pm2 start ecosystem.config.js
```

4. 查看状态：
```bash
pm2 status
pm2 logs visual-split-mark
```

## 配置说明

### 1. 应用配置

```yaml
# config/app.yaml
app:
  name: Visual Split Mark
  port: 3000
  host: localhost
  baseUrl: http://localhost:3000

cors:
  enabled: true
  origin: '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE']

security:
  rateLimit:
    windowMs: 60000  # 1分钟
    max: 100        # 最大请求数
```

### 2. 存储配置

```yaml
# config/storage.yaml
paths:
  uploads: storage/uploads
  converted: storage/converted
  backups: storage/backups

limits:
  maxFileSize: 100MB
  allowedTypes: ['.mp3', '.wav', '.m4a']
  maxConcurrent: 5

cleanup:
  enabled: true
  interval: 86400    # 24小时
  maxAge: 604800     # 7天
```

### 3. 音频处理配置

```yaml
# config/audio.yaml
ffmpeg:
  path: ffmpeg      # FFmpeg 可执行文件路径
  threads: 2        # 处理线程数
  timeout: 300      # 超时时间（秒）

conversion:
  sampleRate: 16000
  channels: 1
  codec: pcm_s16le

processing:
  chunkSize: 4096
  overlap: 0.1
```

## 性能优化

### 1. Node.js 优化

1. 设置环境变量：
```bash
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"
```

2. 启用压缩：
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    compressor: {
      gzip: true,
      brotli: true
    }
  }
})
```

### 2. 文件系统优化

1. 使用 SSD 存储：
```bash
# 将存储目录移动到 SSD
mv storage /ssd/visual-split-mark/
ln -s /ssd/visual-split-mark/storage ./storage
```

2. 定期清理：
```bash
# 创建清理脚本
cat > cleanup.sh << 'EOF'
#!/bin/bash
find storage/uploads -type f -mtime +7 -delete
find storage/converted -type f -mtime +7 -delete
find storage/backups -type f -mtime +30 -delete
EOF

chmod +x cleanup.sh
```

### 3. 内存管理

1. 配置 PM2 内存限制：
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'visual-split-mark',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096'
  }]
}
```

2. 启用垃圾回收日志：
```bash
NODE_OPTIONS="--trace-gc" pm2 start ecosystem.config.js
```

## 监控和日志

### 1. 应用监控

1. 安装监控模块：
```bash
npm install @nuxtjs/monitor
```

2. 配置监控：
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/monitor'],
  monitor: {
    enabled: true,
    path: '/monitor',
    auth: {
      username: 'admin',
      password: 'your-password'
    }
  }
})
```

### 2. 日志配置

1. 配置日志输出：
```javascript
// server/utils/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
})
```

2. 日志轮转：
```bash
# 安装 logrotate
sudo apt install logrotate

# 创建配置
sudo cat > /etc/logrotate.d/visual-split-mark << 'EOF'
/path/to/visual-split-mark/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 node node
}
EOF
```

## 故障排除

### 1. 启动失败

**问题**: 应用无法启动
**解决方案**:
1. 检查端口占用：
```bash
lsof -i :3000
```

2. 检查权限：
```bash
ls -la storage/
chmod -R 755 storage/
chown -R node:node storage/
```

3. 检查日志：
```bash
pm2 logs visual-split-mark
```

### 2. 文件处理错误

**问题**: 音频文件处理失败
**解决方案**:
1. 检查 FFmpeg：
```bash
ffmpeg -version
which ffmpeg
```

2. 检查存储空间：
```bash
df -h
```

3. 检查文件权限：
```bash
ls -la storage/uploads/
ls -la storage/converted/
```

### 3. 性能问题

**问题**: 应用响应缓慢
**解决方案**:
1. 检查系统资源：
```bash
top
free -h
df -h
```

2. 检查 Node.js 内存：
```bash
pm2 monit
```

3. 检查网络连接：
```bash
netstat -an | grep 3000
```

## 更新升级

### 1. 更新代码

```bash
# 备份当前版本
cp -r .env storage/ backup/

# 拉取更新
git fetch origin
git checkout v1.1.0  # 替换为目标版本

# 更新依赖
npm install
```

### 2. 数据迁移

```bash
# 运行迁移脚本
npm run migrate

# 验证数据
npm run validate
```

### 3. 重启服务

```bash
# 使用 PM2
pm2 reload visual-split-mark

# 或直接重启
npm run build
npm run start
```

## 下一步

1. 配置[服务器部署](server.md)
   - Nginx 配置
   - HTTPS 设置
   - 负载均衡

2. 了解[Docker部署](docker.md)
   - 容器化部署
   - 数据持久化
   - 自动化构建 