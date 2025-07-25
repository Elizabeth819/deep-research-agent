import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import { spawn } from 'child_process'
import { writeFile, unlink, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

// 服务端日志函数
function serverLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    source: 'backend',
    message,
    data
  }
  
  console.log(`[${timestamp}] [${level.toUpperCase()}] [BACKEND] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  
  // 可以扩展到文件日志或外部日志服务
  return logEntry
}

// 在文件顶部添加环境变量读取
const AI_FOUNDRY_PROJECT_ENDPOINT = process.env.AI_FOUNDRY_PROJECT_ENDPOINT || "https://wanme-mcyg2lf0-westus.services.ai.azure.com/api/projects/deep-research-agent";
const AI_AGENT_MODEL = process.env.AI_AGENT_MODEL || "gpt-4o";
const AI_AGENT_NAME = process.env.AI_AGENT_NAME || "deep-research-agent";

// 集成真实的Deep Research Agent
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  let tempFilePath: string | null = null
  
  serverLog('info', '收到Deep Research Agent请求', { requestId })
  
  try {
    const { message, conversationId, conversationHistory } = await request.json()
    
    serverLog('info', '请求参数解析完成', { 
      requestId, 
      messageLength: message?.length || 0, 
      conversationId,
      hasMessage: !!message,
      historyLength: conversationHistory?.length || 0
    })

    if (!message) {
      serverLog('warn', '请求参数验证失败：消息内容为空', { requestId })
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    serverLog('info', '开始创建Python脚本', { requestId })

    // 构建对话历史的Python代码
    const buildConversationHistoryPython = (history: ConversationMessage[]) => {
      if (!history || history.length === 0) {
        return '                # 无历史对话'
      }
      
      let historyCode = `
                # 添加对话历史
                python_log('info', '开始添加对话历史', {'history_count': ${history.length - 1}})`
      
      // 只添加除了最后一条（当前用户消息）之外的历史消息
      for (let i = 0; i < history.length - 1; i++) {
        const msg = history[i]
        const escapedContent = msg.content.replace(/"/g, '\\"').replace(/\n/g, '\\n')
        
        historyCode += `
                
                # 添加历史消息 ${i + 1}
                historical_message_${i} = agents_client.messages.create(
                    thread_id=thread.id,
                    role="${msg.role}",
                    content="${escapedContent}",
                )
                python_log('info', '历史消息添加成功', {'index': ${i + 1}, 'role': '${msg.role}', 'message_id': historical_message_${i}.id})`
      }
      
      return historyCode
    }

    // 创建临时的Python脚本来运行Deep Research Agent
    const tempScript = `
import os, time, sys, traceback
from typing import Optional

# 设置日志输出
def python_log(level, message, data=None):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] [PYTHON-{level.upper()}] {message}"
    if data:
        log_msg += f" | Data: {data}"
    print(log_msg, flush=True)

python_log('info', 'Python脚本开始执行', {'request_id': '${requestId}'})

try:
    python_log('info', '尝试导入Azure模块')
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential
    from azure.ai.agents import AgentsClient
    from azure.ai.agents.models import BingGroundingToolDefinition, BingGroundingSearchToolParameters, BingGroundingSearchConfiguration, MessageRole, ThreadMessage
    python_log('info', 'Azure模块导入成功')
except ImportError as e:
    python_log('error', 'Azure模块导入失败', str(e))
    print("AGENT_RESPONSE_START")
    print(f"导入Azure模块失败: {str(e)}。请确保已安装相关依赖: pip install azure-ai-agents azure-ai-projects azure-identity")
    print("AGENT_RESPONSE_END")
    sys.exit(1)

def main():
    try:
        python_log('info', '开始初始化Azure客户端')
        
        # 设置超时环境变量
        os.environ.setdefault('AZURE_CLIENT_TIMEOUT', '30')
        
        project_client = AIProjectClient(
            endpoint="${AI_FOUNDRY_PROJECT_ENDPOINT}",
            credential=DefaultAzureCredential(),
        )
        python_log('info', 'Azure项目客户端初始化成功')

        python_log('info', '获取连接配置')
        conn_id = project_client.connections.get(name="elizbinggroundingwestus").id
        python_log('info', '连接配置获取成功', {'connection_id': conn_id[:10] + '...'})

        # Initialize a Bing Grounding tool with Bing Connection ID
        python_log('info', '初始化Bing Grounding工具')
        bing_grounding_tool_def = BingGroundingToolDefinition(
            bing_grounding=BingGroundingSearchToolParameters(
                search_configurations=[
                    BingGroundingSearchConfiguration(
                        connection_id=conn_id,
                        market="zh-CN",  # 改为中文市场
                        set_lang="zh-CN",  # 改为中文语言
                        count=15,  # 增加搜索结果数量
                        freshness="Month"
                    )
                ]
            )
        )
        python_log('info', 'Bing Grounding工具初始化成功')

        with project_client:
            with project_client.agents as agents_client:
                python_log('info', '开始创建Agent')
                # Create a new agent
                agent = agents_client.create_agent(
                    model="${AI_AGENT_MODEL}",
                    name="${AI_AGENT_NAME}",
                    instructions="""你是一个专业的AI研究助手，具有多轮对话能力，能够进行深度研究和分析。请遵循以下指导原则：
1. 使用中文回复
2. 记住之前的对话内容，保持对话连贯性
3. 提供最新、准确的研究信息
4. 包含具体的技术细节和数据
5. 引用权威来源和最新论文
6. 结构化组织回复内容
7. 针对前沿科技领域提供深入分析
8. 如果用户的问题是基于之前的对话，请在回答中体现对上下文的理解""",
                    tools=[bing_grounding_tool_def],
                )

                python_log('info', 'Agent创建成功', {'agent_id': agent.id})

                # Create thread for communication
                python_log('info', '创建会话线程')
                thread = agents_client.threads.create()
                python_log('info', '会话线程创建成功', {'thread_id': thread.id})

${buildConversationHistoryPython(conversationHistory || [])}

                # Create current user message to thread
                python_log('info', '添加当前用户消息到线程')
                user_message = agents_client.messages.create(
                    thread_id=thread.id,
                    role="user",
                    content="${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
                )
                python_log('info', '当前用户消息添加成功', {'message_id': user_message.id})

                # Process the message
                python_log('info', '开始处理消息')
                run_start_time = time.time()
                run = agents_client.runs.create(thread_id=thread.id, agent_id=agent.id)
                python_log('info', '消息处理任务创建成功', {'run_id': run.id})
                
                # Poll the run with timeout
                timeout_seconds = 60  # 1分钟超时
                start_time = time.time()
                poll_count = 0
                
                while run.status in ("queued", "in_progress"):
                    poll_count += 1
                    current_time = time.time()
                    elapsed = current_time - start_time
                    
                    if elapsed > timeout_seconds:
                        python_log('warn', '处理超时', {'elapsed_seconds': elapsed, 'poll_count': poll_count})
                        print("AGENT_RESPONSE_START")
                        print("处理超时，请稍后重试")
                        print("AGENT_RESPONSE_END")
                        break
                        
                    time.sleep(3)  # 增加轮询间隔
                    run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)
                    python_log('debug', f'状态轮询 #{poll_count}', {'status': run.status, 'elapsed_seconds': elapsed})

                processing_duration = time.time() - run_start_time
                python_log('info', '消息处理完成', {
                    'final_status': run.status,
                    'processing_duration_seconds': processing_duration,
                    'poll_count': poll_count
                })

                if run.status == "completed":
                    python_log('info', '获取Agent响应')
                    # Get the final response
                    final_message = agents_client.messages.get_last_message_by_role(
                        thread_id=thread.id, role=MessageRole.AGENT
                    )
                    
                    if final_message:
                        response_text = "\\n\\n".join([t.text.value.strip() for t in final_message.text_messages])
                        python_log('info', 'Agent响应获取成功', {
                            'response_length': len(response_text),
                            'text_messages_count': len(final_message.text_messages)
                        })
                        
                        print("AGENT_RESPONSE_START")
                        print(response_text)
                        print("AGENT_RESPONSE_END")
                        
                        # Print citations if any
                        if final_message.url_citation_annotations:
                            citation_count = len(final_message.url_citation_annotations)
                            python_log('info', '处理引用信息', {'citation_count': citation_count})
                            print("CITATIONS_START")
                            for ann in final_message.url_citation_annotations:
                                title = ann.url_citation.title or "未知标题"
                                url = ann.url_citation.url or ""
                                print(f"[{title}]({url})")
                            print("CITATIONS_END")
                        else:
                            python_log('info', '无引用信息')
                    else:
                        python_log('warn', 'Agent响应为空')
                        print("AGENT_RESPONSE_START")
                        print("抱歉，无法获取响应。")
                        print("AGENT_RESPONSE_END")
                elif run.status == "failed":
                    python_log('error', 'Agent运行失败', {'status': run.status})
                    print("AGENT_RESPONSE_START")
                    print(f"查询失败，状态: {run.status}")
                    if hasattr(run, 'last_error') and run.last_error:
                        error_info = str(run.last_error)
                        python_log('error', 'Agent错误详情', {'error': error_info})
                        print(f"错误信息: {error_info}")
                    print("AGENT_RESPONSE_END")
                else:
                    python_log('warn', 'Agent运行未完成', {'final_status': run.status})
                    print("AGENT_RESPONSE_START")
                    print(f"处理未完成，最终状态: {run.status}")
                    print("AGENT_RESPONSE_END")

                # Clean up
                try:
                    python_log('info', '开始清理Agent')
                    agents_client.delete_agent(agent.id)
                    python_log('info', 'Agent清理成功', {'agent_id': agent.id})
                except Exception as cleanup_error:
                    python_log('error', 'Agent清理失败', {'error': str(cleanup_error)})

    except Exception as e:
        python_log('error', 'Python脚本执行异常', {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'traceback': traceback.format_exc()
        })
        print("AGENT_RESPONSE_START")
        print(f"运行Deep Research Agent时出错: {str(e)}")
        print(f"错误类型: {type(e).__name__}")
        print("AGENT_RESPONSE_END")

if __name__ == "__main__":
    python_log('info', 'Python脚本主函数开始')
    main()
    python_log('info', 'Python脚本执行完成')
`

    // 创建临时文件，使用更安全的路径
    const timestamp = Date.now()
    tempFilePath = join(os.tmpdir(), `deep_research_${timestamp}_${Math.random().toString(36).substr(2, 9)}.py`)
    
    serverLog('info', '创建临时Python文件', { requestId, tempFilePath })
    await writeFile(tempFilePath, tempScript, 'utf8')

    // 验证文件是否创建成功
    try {
      await access(tempFilePath, constants.F_OK)
      serverLog('info', '临时文件创建验证成功', { requestId })
    } catch (error) {
      serverLog('error', '临时文件创建验证失败', { requestId, error: String(error) })
      throw new Error(`临时文件创建失败: ${error}`)
    }

    // 执行Python脚本
    serverLog('info', '开始执行Python脚本', { requestId })
    const pythonProcess = spawn('python3', [tempFilePath], {
      cwd: '/Users/wanmeng/repository/deep_research',
      env: { 
        ...process.env,
        PYTHONPATH: '/Users/wanmeng/repository/deep_research',
        AZURE_CLI_DISABLE_CONNECTION_VERIFICATION: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let errorOutput = ''
    let outputLineCount = 0
    let errorLineCount = 0

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      outputLineCount += (chunk.match(/\n/g) || []).length
      
      // 实时日志输出（限制频率）
      if (outputLineCount % 10 === 0 || chunk.includes('AGENT_RESPONSE_START')) {
        serverLog('debug', 'Python输出更新', { 
          requestId, 
          outputLines: outputLineCount,
          lastChunk: chunk.slice(-100) 
        })
      }
    })

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString()
      errorOutput += chunk
      errorLineCount += (chunk.match(/\n/g) || []).length
      
      serverLog('warn', 'Python错误输出', { 
        requestId, 
        errorLines: errorLineCount,
        chunk: chunk.slice(0, 200) 
      })
    })

    const result = await new Promise<{ success: boolean; response: string; citations?: string[] }>((resolve) => {
      const timeout = setTimeout(() => {
        serverLog('warn', 'Python进程执行超时，开始终止', { requestId })
        pythonProcess.kill('SIGTERM')
        
        setTimeout(() => {
          if (!pythonProcess.killed) {
            serverLog('warn', '强制终止Python进程', { requestId })
            pythonProcess.kill('SIGKILL')
          }
        }, 5000)
        
        resolve({
          success: false,
          response: `查询超时（60秒），这里是基于您的问题的快速回复：\n\n${generateFallbackResponse(message)}`
        })
      }, 65000) // 65秒超时

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeout)
        const pythonDuration = Date.now() - startTime
        
        serverLog('info', 'Python进程结束', { 
          requestId, 
          exitCode: code, 
          signal, 
          duration: pythonDuration,
          outputLines: outputLineCount,
          errorLines: errorLineCount
        })

        if (output.includes('AGENT_RESPONSE_START') && output.includes('AGENT_RESPONSE_END')) {
          // 提取响应内容
          const responseMatch = output.match(/AGENT_RESPONSE_START\n([\s\S]*?)\nAGENT_RESPONSE_END/)
          const citationsMatch = output.match(/CITATIONS_START\n([\s\S]*?)\nCITATIONS_END/)
          
          const response = responseMatch ? responseMatch[1].trim() : '获取响应失败'
          const citations = citationsMatch ? citationsMatch[1].trim().split('\n').filter(c => c.trim()) : undefined

          serverLog('info', 'Agent响应解析成功', { 
            requestId, 
            responseLength: response.length,
            citationsCount: citations?.length || 0
          })

          resolve({ 
            success: true, 
            response,
            citations 
          })
        } else {
          // 使用备用响应机制
          const errorInfo = errorOutput ? `\n错误信息: ${errorOutput.slice(0, 200)}` : ''
          
          serverLog('warn', '使用备用响应机制', { 
            requestId, 
            reason: 'Python输出格式不正确',
            hasOutput: !!output,
            hasError: !!errorOutput
          })
          
          resolve({
            success: false,
            response: `Deep Research Agent暂时不可用${errorInfo}\n\n这里是基于您的问题的模拟回复：\n\n${generateFallbackResponse(message)}`
          })
        }
      })

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout)
        serverLog('error', 'Python进程启动失败', { requestId, error: error.message })
        resolve({
          success: false,
          response: `Python进程启动失败: ${error.message}\n\n这里是基于您的问题的模拟回复：\n\n${generateFallbackResponse(message)}`
        })
      })
    })

    const totalDuration = Date.now() - startTime
    
    serverLog('info', '请求处理完成', { 
      requestId, 
      success: result.success,
      totalDuration,
      responseLength: result.response?.length || 0,
      citationsCount: result.citations?.length || 0
    })

    return NextResponse.json({
      response: result.response,
      citations: result.citations,
      conversationId,
      isRealAgent: result.success,
      meta: {
        requestId,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    serverLog('error', 'Deep Research Agent集成错误', { 
      requestId, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalDuration
    })
    
    return NextResponse.json(
      { 
        error: '服务器内部错误，请稍后重试',
        details: error instanceof Error ? error.message : String(error),
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  } finally {
    // 安全清理临时文件
    if (tempFilePath) {
      try {
        await access(tempFilePath, constants.F_OK)
        await unlink(tempFilePath)
        serverLog('info', '临时文件清理成功', { requestId, tempFilePath })
      } catch (error) {
        // 文件可能已经不存在，忽略此错误
        serverLog('debug', '临时文件清理完成或已不存在', { requestId, tempFilePath })
      }
    }
  }
}

// 备用响应生成函数
function generateFallbackResponse(message: string): string {
  if (message.toLowerCase().includes('自动驾驶') || message.toLowerCase().includes('视觉模型') || message.toLowerCase().includes('行为打标')) {
    return `关于自动驾驶视觉模型中行为打标的最新进展：

🚗 **技术发展概况**
- **多模态融合标注**: 结合激光雷达、摄像头、IMU数据进行综合标注
- **自监督学习**: 利用时间序列一致性减少人工标注需求
- **实时标注系统**: 支持在线学习和增量标注

🏷️ **行为标注技术**
- **语义分割标注**: 像素级别的道路、车辆、行人标注
- **3D边界框标注**: 立体空间中的对象检测和追踪
- **行为意图标注**: 车辆转向、行人过街等行为预测

🔬 **最新研究方向**
- **端到端标注流水线**: Tesla FSD、Waymo等公司的自动化标注系统
- **主动学习标注**: 基于不确定性的样本选择策略
- **跨域标注**: 仿真数据到真实场景的标注迁移

💡 **技术挑战**
- **标注一致性**: 多标注员之间的标准统一
- **边缘案例**: 恶劣天气、特殊场景的标注质量
- **标注效率**: 大规模数据的快速高质量标注

📊 **产业化进展**
- 国内外主要自动驾驶公司都在建设专业标注团队
- 涌现专业的数据标注公司如Scale AI、京东数科等
- 标注工具和平台日趋成熟和标准化

注：这是备用回复，完整的Deep Research Agent将提供更详细和最新的研究内容及引用来源。`
  }

  if (message.toLowerCase().includes('量子计算') || message.toLowerCase().includes('quantum')) {
    return `关于量子计算的研究进展：

🔬 **技术突破**
- 量子纠错码的实用化进展
- 量子比特数量和质量的持续改进
- 量子算法在特定问题上的优势验证

🏢 **产业发展**  
- 科技巨头加大量子计算投资
- 量子云服务平台的普及
- 量子软件生态的建设

⚡ **应用前景**
- 密码学和网络安全
- 化学分子模拟
- 金融风险建模
- 机器学习优化

注：这是备用回复，完整的Deep Research Agent将提供更详细和最新的研究内容。`
  }

  return `感谢您的问题："${message}"

作为Deep Research Agent，我会为您提供深入的研究分析。基于最新的学术资源和权威信息源，我将从多个维度来回答您的问题。

🔍 **研究方法**
- 文献检索和分析
- 数据挖掘和趋势分析  
- 专家观点整合
- 实时信息更新

📊 **分析框架**
- 技术发展现状
- 市场应用前景
- 潜在风险和挑战
- 未来发展趋势

如需获得基于实时数据的完整研究报告，请稍后重试或联系系统管理员。

您希望我从哪个角度来深入分析这个话题？`
} 

// 定义对话消息类型接口
interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
} 