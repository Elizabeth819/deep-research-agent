# Deep Research Agent 深度研究代理

## 项目简介

基于Azure AI Agent SDK构建的深度研究助手，提供ChatGPT风格的Web界面，支持多轮对话、图片输入和持久化对话历史。

## 功能特性

- 🤖 **智能研究**: 基于Azure AI Agent进行深度研究和分析
- 💬 **多轮对话**: 支持上下文理解的连续对话
- 🖼️ **图片支持**: 上传图片进行视觉分析
- 💾 **持久化存储**: 对话历史本地保存，刷新后依然可用
- 📝 **Markdown渲染**: 格式化输出，支持代码高亮
- 🔧 **调试系统**: 完整的前后端日志系统

## 技术栈

### 前端
- Next.js 14 (React + TypeScript)
- Tailwind CSS
- Lucide React Icons
- React Markdown

### 后端
- Next.js API Routes
- Node.js Child Process
- Python Azure AI SDK

### AI服务
- Azure AI Agents SDK
- Azure Identity
- Bing Grounding Tool

## 项目结构

```
deep_research/
├── deep-research-ui/          # Next.js前端应用
│   ├── src/
│   │   ├── app/              # App Router页面
│   │   ├── components/       # React组件
│   │   └── lib/             # 工具库
│   ├── public/              # 静态资源
│   └── package.json         # 前端依赖
├── Documentation/            # 项目文档
├── first_deep_research_agent.py  # 独立Python脚本
└── requirements.txt         # Python依赖

```

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+
- Azure AI服务访问权限

### 安装依赖

```bash
# 安装Python依赖
pip install -r requirements.txt

# 安装前端依赖
cd deep-research-ui
npm install
```

### 启动应用

```bash
cd deep-research-ui
npm run dev
```

访问 http://localhost:3000 开始使用。

## 配置说明

确保已正确配置Azure AI服务的认证信息和相关环境变量。

## 许可证

MIT License 