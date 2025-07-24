# Deep Research Agent UI

基于Azure AI的深度研究助手Web界面，提供ChatGPT风格的用户体验，支持多轮对话和图片输入。

## 功能特性

✅ **ChatGPT风格界面** - 现代化的聊天UI设计  
✅ **左侧对话历史** - 管理和切换多个对话  
✅ **多轮对话支持** - 连续的问答交互  
✅ **图片上传** - 支持多模态输入（演示模式）  
✅ **真实Agent集成** - 连接Azure AI进行深度研究  
✅ **模拟模式** - 离线演示和开发测试  
✅ **引用来源显示** - 展示研究参考资料  
✅ **响应式设计** - 适配不同设备屏幕  

## 技术架构

### 前端
- **Next.js 14** - React全栈框架
- **TypeScript** - 类型安全的JavaScript
- **Tailwind CSS** - 原子化CSS框架
- **Lucide React** - 现代图标库

### 后端
- **Next.js API Routes** - 服务端API
- **Azure AI Agents** - 深度研究能力
- **文件上传处理** - 多媒体支持

## 快速开始

### 1. 环境准备

确保您已安装：
- Node.js 18+
- npm 或 yarn
- Python 3.8+ (用于Azure AI集成)

### 2. 安装依赖

```bash
cd deep-research-ui
npm install
```

### 3. 配置Azure AI (可选)

如需使用真实的Deep Research Agent，请确保：

1. 已配置Azure AI项目和连接
2. 设置好Azure认证凭据
3. 确保Python环境已安装必要的Azure包：

```bash
cd .. # 回到父目录
pip install -r requirements.txt
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 开始使用。

## 使用说明

### 切换模式

应用支持两种工作模式：

#### 🟢 真实Agent模式
- 连接Azure AI进行实时深度研究
- 基于最新网络信息和学术资源
- 提供权威引用来源
- 处理时间较长但内容更准确

#### 🟡 演示模式  
- 本地模拟响应，无需网络连接
- 支持图片上传和预览
- 响应速度快，适合演示和开发
- 提供预设的智能回复

### 对话管理

- **新建对话**: 点击左侧"新建对话"按钮
- **切换对话**: 点击对话历史列表中的任意对话
- **自动命名**: 对话标题自动使用首条消息内容

### 多媒体支持

在演示模式下：
- 点击上传按钮选择图片
- 支持常见图片格式(JPEG, PNG, GIF等)
- 图片会显示在聊天记录中
- 可以结合文字和图片一起发送

## API端点

### `/api/chat` - 演示模式API
- 支持FormData格式请求
- 处理文本和图片输入
- 返回模拟的智能回复

### `/api/integration` - 真实Agent API  
- 支持JSON格式请求
- 集成Azure AI Agents
- 返回深度研究结果和引用

## 项目结构

```
deep-research-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts         # 演示模式API
│   │   │   └── integration/route.ts  # 真实Agent API
│   │   ├── layout.tsx                # 页面布局
│   │   └── page.tsx                  # 主界面组件
│   └── ...
├── public/
│   └── uploads/                      # 图片上传目录
├── package.json
└── README.md
```

## 部署说明

### 开发环境

```bash
npm run dev
```

### 生产构建

```bash
npm run build
npm start
```

### Docker部署 (可选)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 自定义配置

### 修改AI回复逻辑

编辑 `src/app/api/chat/route.ts` 中的 `callDeepResearchAgent` 函数。

### 调整UI样式

所有样式使用Tailwind CSS，直接在组件中修改className。

### 扩展功能

- 添加对话导出功能
- 集成更多文件类型支持
- 添加用户认证系统
- 实现对话持久化存储

## 故障排除

### 真实Agent模式无法工作

1. 检查Azure AI凭据配置
2. 确认网络连接正常
3. 查看浏览器控制台错误信息
4. 检查Python环境和依赖

### 图片上传失败

1. 确认uploads目录存在并有写权限
2. 检查图片文件大小和格式
3. 查看服务器日志获取详细错误

### 页面样式问题

1. 确认Tailwind CSS正确加载
2. 检查浏览器兼容性
3. 清除浏览器缓存

## 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

## 许可证

MIT License - 详见LICENSE文件。
