# 环境准备

## 系统要求

### 操作系统
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu 20.04+, CentOS 8+)

### 硬件要求
- CPU: 双核及以上
- 内存: 4GB 及以上
- 硬盘: 10GB 可用空间

### 软件要求
- Node.js 16.x 或更高版本
- FFmpeg 4.x 或更高版本
- Git（用于版本控制）

## 依赖安装

### 1. Node.js 安装

#### Windows
1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载并安装 LTS 版本
3. 验证安装：
```bash
node --version
npm --version
```

#### macOS
使用 Homebrew 安装：
```bash
brew install node
```

#### Linux (Ubuntu)
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. FFmpeg 安装

#### Windows
1. 访问 [FFmpeg 官网](https://ffmpeg.org/download.html)
2. 下载 Windows 版本
3. 解压到指定目录
4. 添加到系统环境变量

#### macOS
```bash
brew install ffmpeg
```

#### Linux (Ubuntu)
```bash
sudo apt update
sudo apt install ffmpeg
```

### 3. Git 安装

#### Windows
1. 访问 [Git 官网](https://git-scm.com/)
2. 下载并安装 Windows 版本

#### macOS
```bash
brew install git
```

#### Linux (Ubuntu)
```bash
sudo apt update
sudo apt install git
```

## 开发环境配置

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/visual-split-mark.git
cd visual-split-mark
```

### 2. 安装项目依赖
```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

### 3. 环境变量配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置必要的环境变量：
```ini
# 应用配置
APP_NAME=Visual Split Mark
APP_PORT=3000

# 存储路径
STORAGE_PATH=./storage
UPLOAD_PATH=./storage/uploads
CONVERTED_PATH=./storage/converted

# Whisper API 配置（可选）
WHISPER_API_URL=
WHISPER_API_KEY=
```

### 4. 创建必要的目录
```bash
mkdir -p storage/uploads
mkdir -p storage/converted
mkdir -p storage/backups
```

### 5. 启动开发服务器
```bash
# 使用 npm
npm run dev

# 或使用 yarn
yarn dev

# 或使用 pnpm
pnpm dev
```

访问 `http://localhost:3000` 开始开发。

## 常见问题

### 1. Node.js 版本问题
如果遇到 Node.js 版本不兼容的问题，建议使用 nvm（Node Version Manager）来管理 Node.js 版本：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装指定版本的 Node.js
nvm install 16
nvm use 16
```

### 2. FFmpeg 路径问题
确保 FFmpeg 已正确添加到系统环境变量。可以通过以下命令验证：

```bash
ffmpeg -version
```

如果命令未找到，需要检查环境变量配置。

### 3. 权限问题
在 Linux 或 macOS 系统中，如果遇到权限问题，请确保：

1. 存储目录具有正确的权限：
```bash
chmod -R 755 storage
```

2. 当前用户具有写入权限：
```bash
sudo chown -R $USER:$USER storage
```

### 4. 依赖安装失败
如果依赖安装失败，可以尝试：

1. 清除缓存：
```bash
npm cache clean --force
```

2. 使用镜像源：
```bash
# npm
npm config set registry https://registry.npmmirror.com

# yarn
yarn config set registry https://registry.npmmirror.com
```

3. 删除 node_modules 并重新安装：
```bash
rm -rf node_modules
rm -f package-lock.json
npm install
```

## 下一步

完成环境配置后，您可以：

1. 查看[基本使用](basic.md)指南，了解如何使用 Visual Split Mark
2. 阅读[架构设计](../dev/architecture.md)，了解项目的技术细节
3. 参考[开发规范](../dev/standard.md)，确保代码质量 