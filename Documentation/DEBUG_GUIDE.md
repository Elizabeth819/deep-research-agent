# Deep Research Agent 调试指南

## 📋 日志系统概览

我们设计了一个完整的三层日志系统，帮助您全面了解系统运行状态和调试问题：

### 🔍 三层日志架构

1. **前端UI日志** - 用户交互、页面操作、组件状态
2. **前端API日志** - HTTP请求/响应、网络错误、性能指标
3. **后端执行日志** - 服务器处理、Python脚本、Azure AI调用

---

## 🚀 快速开始

### 1. 打开日志查看器

- 启动应用：`npm run dev`
- 访问：http://localhost:3000
- 点击左侧 **"系统日志"** 按钮

### 2. 实时监控

日志查看器会实时显示：
- ✅ API调用状态
- ⚠️ 错误和警告
- 📊 性能指标
- 🔧 调试信息

---

## 📊 日志级别说明

| 级别 | 图标 | 用途 | 示例 |
|------|------|------|------|
| **INFO** | ℹ️ | 正常操作记录 | "API调用成功"、"用户创建新对话" |
| **WARN** | ⚠️ | 警告信息 | "响应超时"、"图片格式不支持" |
| **ERROR** | ❌ | 错误和异常 | "网络请求失败"、"Python进程错误" |
| **DEBUG** | 🐛 | 详细调试信息 | "状态轮询"、"参数解析" |

---

## 🎯 常见调试场景

### 场景1：API请求失败

**症状**：发送消息后显示错误
**调试步骤**：
1. 打开日志查看器
2. 过滤器选择"API"类别
3. 查找红色错误条目
4. 展开"查看详细数据"

**典型日志**：
```
[ERROR] API错误: POST /api/integration (15623ms)
Data: {
  "error": "HTTP 500: Internal Server Error",
  "stack": "..."
}
```

### 场景2：真实Agent响应慢

**症状**：等待时间很长
**调试步骤**：
1. 查看"Python输出更新"日志
2. 监控"状态轮询"频率
3. 检查"processing_duration_seconds"

**典型日志**：
```
[INFO] 消息处理完成
Data: {
  "final_status": "completed",
  "processing_duration_seconds": 45.2,
  "poll_count": 15
}
```

### 场景3：Azure认证问题

**症状**：真实Agent模式失败
**调试步骤**：
1. 查看Python错误输出
2. 搜索"Azure模块导入"
3. 检查认证相关错误

**典型日志**：
```
[PYTHON-ERROR] Azure模块导入失败
Data: "DefaultAzureCredential failed..."
```

---

## 🔧 高级调试功能

### 1. 日志过滤

- **按级别过滤**：只看错误 `level=error`
- **按类别过滤**：只看API `category=api`
- **文本搜索**：搜索关键词如"timeout"

### 2. 日志导出

点击下载按钮导出JSON格式日志：
```json
{
  "exportTime": "2025-01-24T02:15:30.000Z",
  "logs": [
    {
      "id": "1753323930123_a1b2c3d4",
      "timestamp": "2025-01-24T02:15:29.123Z",
      "level": "error",
      "category": "api",
      "message": "API错误: POST /api/integration",
      "data": {...}
    }
  ]
}
```

### 3. 实时监控

- **自动滚动**：新日志自动滚动到最新
- **实时更新**：无需刷新页面
- **性能友好**：限制日志数量，避免内存溢出

---

## 📈 性能分析

### API响应时间

查看日志中的duration字段：
```
API响应: POST /api/integration - 200 (16629ms)
```

### 后端处理分解

```
[BACKEND] 请求处理完成
Data: {
  "totalDuration": 16629,
  "responseLength": 2341,
  "citationsCount": 2
}
```

### Python脚本执行

```
[PYTHON-INFO] 消息处理完成
Data: {
  "processing_duration_seconds": 15.2,
  "poll_count": 5
}
```

---

## 🛠️ 故障排除

### 问题1：日志不显示

**解决方案**：
1. 检查浏览器控制台是否有JS错误
2. 确认localStorage权限
3. 重新加载页面

### 问题2：Python日志缺失

**解决方案**：
1. 检查Python脚本是否正确执行
2. 查看后端终端输出
3. 验证Azure SDK安装

### 问题3：日志过多影响性能

**解决方案**：
1. 使用过滤器减少显示量
2. 定期清空日志
3. 关闭DEBUG级别日志

---

## 🎨 自定义日志

### 添加自定义日志

在代码中使用logger：

```typescript
import { logger } from '@/lib/logger'

// 记录用户操作
logger.info('用户点击按钮', { buttonId: 'submit' }, 'ui')

// 记录API调用
logger.apiCall('POST', '/api/custom', { data })

// 记录错误
logger.error('自定义错误', { error: e.message }, 'system')
```

### 添加新的日志类别

修改`logger.ts`中的类型定义：

```typescript
type LogCategory = 'api' | 'ui' | 'system' | 'auth' | 'storage'
```

---

## 📝 最佳实践

### 1. 日志记录原则

- **有意义的消息**：描述具体操作和结果
- **包含上下文**：添加相关参数和状态
- **适当的级别**：选择合适的日志级别
- **性能考虑**：避免在高频操作中记录大量数据

### 2. 调试工作流

1. **重现问题** → 记录操作步骤
2. **查看日志** → 定位错误时间点
3. **分析数据** → 查看详细错误信息
4. **修复验证** → 再次测试并监控日志

### 3. 生产环境建议

- 关闭DEBUG级别日志
- 定期清理或轮转日志文件
- 设置日志监控和告警
- 保护敏感信息不被记录

---

## 🔗 相关文件

- `src/lib/logger.ts` - 日志工具类
- `src/components/LogViewer.tsx` - 日志查看器组件
- `src/app/page.tsx` - 前端日志集成
- `src/app/api/integration/route.ts` - 后端日志集成

---

**祝您调试愉快！** 🎉

如有问题或建议，请查看控制台输出或联系开发团队。 