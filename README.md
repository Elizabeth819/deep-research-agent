# Deep Research Agent - 图灵博士

基于Azure AI的深度研究智能助手，现已打包为独立的macOS桌面应用。

## 🏗️ 项目结构

```
deep_research/
├── deep-research-ui/          # Next.js前端应用
│   ├── src/                   # 源代码
│   │   ├── app/              # Next.js App Router
│   │   ├── components/       # React组件
│   │   └── lib/              # 工具库
│   ├── out/                  # 静态导出文件（构建后生成）
│   ├── package.json          # 前端依赖配置
│   └── next.config.js        # Next.js配置
├── electron-app/             # Electron桌面应用
│   ├── main.js              # Electron主进程
│   ├── package.json         # Electron依赖配置
│   ├── turing-doctor-icon.png # 应用图标
│   └── dist/                # 打包输出目录
├── scripts/                 # Python脚本
│   └── first_deep_research_agent.py
├── Documentation/           # 项目文档
├── requirements.txt         # Python依赖
└── README.md               # 项目说明
```

## 🚀 快速开始

### 开发模式

1. **启动前端开发服务器**
   ```bash
   cd deep-research-ui
   npm install
   npm run dev
   ```

2. **启动Electron应用**
   ```bash
   cd electron-app
   npm install
   npm start
   ```

### 生产模式

1. **构建前端静态文件**
   ```bash
   cd deep-research-ui
   npm run build
   ```

2. **打包Electron应用**
   ```bash
   cd electron-app
   npm run dist
   ```

## ✨ 功能特性

- 🤖 **智能对话**: 基于Azure AI的深度研究助手
- 💬 **多轮对话**: 支持上下文记忆的连续对话
- 📚 **实时研究**: 集成Bing搜索的最新信息检索
- 🎨 **现代界面**: 基于React的响应式用户界面
- 💾 **本地存储**: 对话历史本地保存
- 📊 **系统监控**: 内置日志查看器
- 🖥️ **桌面应用**: 独立的macOS桌面版本

## ⚙️ 配置

在 `deep-research-ui/.env` 文件中配置Azure AI服务参数：

```env
AI_FOUNDRY_PROJECT_ENDPOINT=your_azure_ai_endpoint
AI_AGENT_MODEL=gpt-4o
AI_AGENT_NAME=deep-research-agent
```

## 🎯 使用说明

1. **启动应用**: 双击安装的"图灵博士"应用
2. **新建对话**: 点击"新建对话"开始
3. **切换模式**: 在设置中选择"真实Agent"或"演示模式"
4. **查看日志**: 点击"系统日志"查看详细运行信息
5. **导出数据**: 在设置中导出/导入对话历史

## 🔧 技术栈

- **前端**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **桌面**: Electron 37
- **AI服务**: Azure AI Foundry, GPT-4o
- **搜索**: Bing Grounding API
- **工具**: ESLint, PostCSS

## 📦 构建产物

- **DMG**: `图灵博士-1.0.0-arm64.dmg` - macOS安装包
- **ZIP**: `图灵博士-1.0.0-arm64-mac.zip` - 压缩包版本

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！

## �� 许可证

MIT License 