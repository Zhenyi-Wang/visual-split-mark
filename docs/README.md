# Visual Split Mark 文档

Visual Split Mark 是一个基于 Web 的音频标注工具，支持音频可视化、区域标注、语音识别等功能。本文档提供了详细的开发和使用指南。

## 目录

### 核心模块

1. [音频处理模块](core/audio.md)
   - 音频播放和控制
   - 波形可视化
   - 音频格式转换
   - 性能优化和调试

2. [标注系统模块](core/annotation.md)
   - 区域管理
   - 交互处理
   - 语音识别集成
   - 数据导出功能

3. [项目管理模块](core/project.md)
   - 项目配置
   - 文件管理
   - 数据持久化
   - 高级功能

### 快速入门

1. [环境准备](guide/setup.md)
   - 系统要求
   - 依赖安装
   - 开发环境配置

2. [基本使用](guide/basic.md)
   - 创建项目
   - 上传音频
   - 标注操作
   - 导出数据

3. [高级特性](guide/advanced.md)
   - 语音识别
   - 批量处理
   - 数据迁移
   - 性能调优

### 部署指南

1. [本地部署](deploy/local.md)
   - 环境准备
   - 构建步骤
   - 配置说明

2. [服务器部署](deploy/server.md)
   - 系统要求
   - 安装步骤
   - 性能优化
   - 安全配置

3. [Docker 部署](deploy/docker.md)
   - 镜像构建
   - 容器配置
   - 数据持久化
   - 更新升级

### 开发指南

1. [架构设计](dev/architecture.md)
   - 技术栈
   - 模块设计
   - 数据流
   - 扩展点

2. [开发规范](dev/standard.md)
   - 代码风格
   - 提交规范
   - 测试要求
   - 文档规范

3. [贡献指南](dev/contributing.md)
   - 开发流程
   - 提交 PR
   - 问题反馈
   - 文档贡献

### API 参考

1. [核心 API](api/core.md)
   - 音频处理
   - 标注管理
   - 项目管理
   - 数据存储

2. [工具函数](api/utils.md)
   - 文件处理
   - 数据转换
   - 格式化
   - 验证函数

3. [类型定义](api/types.md)
   - 项目类型
   - 音频类型
   - 标注类型
   - 配置类型

### 常见问题

1. [安装问题](faq/installation.md)
   - 环境配置
   - 依赖安装
   - 版本兼容

2. [使用问题](faq/usage.md)
   - 音频处理
   - 标注操作
   - 数据管理
   - 性能问题

3. [错误处理](faq/errors.md)
   - 常见错误
   - 解决方案
   - 调试技巧

## 更新日志

查看 [CHANGELOG.md](../CHANGELOG.md) 了解版本更新历史。

## 许可证

本项目基于 [MIT 许可证](../LICENSE) 开源。 