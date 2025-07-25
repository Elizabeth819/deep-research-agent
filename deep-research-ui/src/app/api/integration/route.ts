import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import { spawn } from 'child_process'
import { writeFile, unlink, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

// 定义对话消息类型接口
interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
}

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
const AI_AGENT_MODEL = process.env.MODEL_DEPLOYMENT_NAME || "gpt-4o";
const AI_AGENT_NAME = process.env.AI_AGENT_NAME || "deep-research-agent";
const DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME = process.env.DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME || "o3-deep-research";
const BING_RESOURCE_NAME = process.env.BING_RESOURCE_NAME || "elizbinggroundingwestus";

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
    from azure.ai.agents.models import DeepResearchTool, MessageRole, ThreadMessage
    python_log('info', 'Azure模块导入成功 - 使用azure-ai-agents 1.1.0b4版本')
except ImportError as e:
    python_log('error', 'Azure模块导入失败', str(e))
    print("AGENT_RESPONSE_START")
    print(f"导入Azure模块失败: {str(e)}。请确保已安装相关依赖: pip install --pre azure-ai-agents==1.1.0b4")
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

        python_log('info', '获取Bing连接配置')
        conn_id = project_client.connections.get(name="${BING_RESOURCE_NAME}").id
        python_log('info', 'Bing连接配置获取成功', {'connection_id': conn_id[:10] + '...'})

        # 初始化Deep Research工具 - 使用正确的DeepResearchTool！
        python_log('info', '初始化Deep Research工具')
        deep_research_tool = DeepResearchTool(
            bing_grounding_connection_id=conn_id,
            deep_research_model="${DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME}",
        )
        python_log('info', 'Deep Research工具初始化成功', {'model': '${DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME}'})

        with project_client:
            with project_client.agents as agents_client:
                python_log('info', '开始创建Agent with Deep Research Tool')
                # 创建使用Deep Research工具的Agent
                agent = agents_client.create_agent(
                    model="${AI_AGENT_MODEL}",  # 使用常规模型进行对话管理
                    name="${AI_AGENT_NAME}",
                    instructions="""你是一个专业的AI深度研究助手，具有多轮对话能力，能够进行深度研究和分析。请遵循以下指导原则：
1. 使用中文回复
2. 记住之前的对话内容，保持对话连贯性
3. 使用Deep Research工具进行深入的研究分析
4. 提供最新、准确的研究信息和数据
5. 包含具体的技术细节和引用来源
6. 结构化组织回复内容，提供详细的研究报告
7. 针对前沿科技领域提供深入分析
8. 如果用户的问题是基于之前的对话，请在回答中体现对上下文的理解
9. 充分利用Deep Research工具的o3-deep-research模型能力提供高质量的研究内容""",
                    tools=deep_research_tool.definitions,
                )

                python_log('info', 'Deep Research Agent创建成功', {'agent_id': agent.id, 'tools_count': len(deep_research_tool.definitions)})

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

                # Process the message with Deep Research
                python_log('info', '开始Deep Research处理')
                run_start_time = time.time()
                run = agents_client.runs.create(thread_id=thread.id, agent_id=agent.id)
                python_log('info', 'Deep Research任务创建成功', {'run_id': run.id})
                
                # Poll the run with extended timeout for deep research
                timeout_seconds = 180  # 3分钟超时，Deep Research需要更长时间
                start_time = time.time()
                poll_count = 0
                
                while run.status in ("queued", "in_progress"):
                    poll_count += 1
                    current_time = time.time()
                    elapsed = current_time - start_time
                    
                    if elapsed > timeout_seconds:
                        python_log('warn', 'Deep Research处理超时', {'elapsed_seconds': elapsed, 'poll_count': poll_count})
                        print("AGENT_RESPONSE_START")
                        print("Deep Research处理超时，这可能是因为正在进行深度研究分析。请稍后重试。")
                        print("AGENT_RESPONSE_END")
                        break
                        
                    time.sleep(5)  # Deep Research需要更长轮询间隔
                    run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)
                    if poll_count % 6 == 0:  # 每30秒输出一次状态
                        python_log('info', f'Deep Research进行中 #{poll_count}', {'status': run.status, 'elapsed_seconds': elapsed})

                processing_duration = time.time() - run_start_time
                python_log('info', 'Deep Research处理完成', {
                    'final_status': run.status,
                    'processing_duration_seconds': processing_duration,
                    'poll_count': poll_count
                })

                if run.status == "completed":
                    python_log('info', '获取Deep Research响应')
                    # Get the final response
                    final_message = agents_client.messages.get_last_message_by_role(
                        thread_id=thread.id, role=MessageRole.AGENT
                    )
                    
                    if final_message:
                        response_text = "\\n\\n".join([t.text.value.strip() for t in final_message.text_messages])
                        python_log('info', 'Deep Research响应获取成功', {
                            'response_length': len(response_text),
                            'text_messages_count': len(final_message.text_messages)
                        })
                        
                        print("AGENT_RESPONSE_START")
                        print(response_text)
                        print("AGENT_RESPONSE_END")
                        
                        # Print citations if any
                        if final_message.url_citation_annotations:
                            citation_count = len(final_message.url_citation_annotations)
                            python_log('info', '处理Deep Research引用信息', {'citation_count': citation_count})
                            print("CITATIONS_START")
                            for ann in final_message.url_citation_annotations:
                                title = ann.url_citation.title or "未知标题"
                                url = ann.url_citation.url or ""
                                print(f"[{title}]({url})")
                            print("CITATIONS_END")
                        else:
                            python_log('info', '无引用信息')
                    else:
                        python_log('warn', 'Deep Research响应为空')
                        print("AGENT_RESPONSE_START")
                        print("抱歉，无法获取Deep Research响应。")
                        print("AGENT_RESPONSE_END")
                elif run.status == "failed":
                    python_log('error', 'Deep Research运行失败', {'status': run.status})
                    print("AGENT_RESPONSE_START")
                    print(f"Deep Research查询失败，状态: {run.status}")
                    if hasattr(run, 'last_error') and run.last_error:
                        error_info = str(run.last_error)
                        python_log('error', 'Deep Research错误详情', {'error': error_info})
                        print(f"错误信息: {error_info}")
                    print("AGENT_RESPONSE_END")
                else:
                    python_log('warn', 'Deep Research运行未完成', {'final_status': run.status})
                    print("AGENT_RESPONSE_START")
                    print(f"Deep Research处理未完成，最终状态: {run.status}")
                    print("AGENT_RESPONSE_END")

                # Clean up
                try:
                    python_log('info', '开始清理Deep Research Agent')
                    agents_client.delete_agent(agent.id)
                    python_log('info', 'Deep Research Agent清理成功', {'agent_id': agent.id})
                except Exception as cleanup_error:
                    python_log('error', 'Deep Research Agent清理失败', {'error': str(cleanup_error)})

    except Exception as e:
        python_log('error', 'Deep Research Python脚本执行异常', {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'traceback': traceback.format_exc()
        })
        print("AGENT_RESPONSE_START")
        print(f"运行Deep Research Agent时出错: {str(e)}")
        print(f"错误类型: {type(e).__name__}")
        print("请检查Azure AI Foundry项目配置和Deep Research模型部署。")
        print("AGENT_RESPONSE_END")

if __name__ == "__main__":
    python_log('info', 'Deep Research Python脚本主函数开始')
    main()
    python_log('info', 'Deep Research Python脚本执行完成')
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
    serverLog('info', '开始执行Deep Research Python脚本', { requestId })
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
      if (outputLineCount % 10 === 0 || chunk.includes('AGENT_RESPONSE_START') || chunk.includes('Deep Research')) {
        serverLog('debug', 'Deep Research Python输出更新', { 
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
      
      serverLog('warn', 'Deep Research Python错误输出', { 
        requestId, 
        errorLines: errorLineCount,
        chunk: chunk.slice(0, 200) 
      })
    })

    const result = await new Promise<{ success: boolean; response: string; citations?: string[] }>((resolve) => {
      const timeout = setTimeout(() => {
        serverLog('warn', 'Deep Research Python进程执行超时，开始终止', { requestId })
        pythonProcess.kill('SIGTERM')
        
        setTimeout(() => {
          if (!pythonProcess.killed) {
            serverLog('warn', '强制终止Deep Research Python进程', { requestId })
            pythonProcess.kill('SIGKILL')
          }
        }, 5000)
        
        resolve({
          success: false,
          response: `Deep Research查询超时（200秒），这通常是因为正在进行深度研究分析。请稍后重试，或检查Azure AI Foundry中的o3-deep-research模型部署状态。`
        })
      }, 200000) // 200秒超时，Deep Research需要更长时间

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeout)
        const pythonDuration = Date.now() - startTime
        
        serverLog('info', 'Deep Research Python进程结束', { 
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
          
          const response = responseMatch ? responseMatch[1].trim() : '获取Deep Research响应失败'
          const citations = citationsMatch ? citationsMatch[1].trim().split('\n').filter(c => c.trim()) : undefined

          serverLog('info', 'Deep Research响应解析成功', { 
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
          // 使用错误信息响应
          const errorInfo = errorOutput ? `\n错误信息: ${errorOutput.slice(0, 500)}` : ''
          
          serverLog('warn', 'Deep Research响应格式不正确', { 
            requestId, 
            reason: 'Python输出格式不正确',
            hasOutput: !!output,
            hasError: !!errorOutput
          })
          
          resolve({
            success: false,
            response: `Deep Research Agent调用失败${errorInfo}\n\n请检查：\n1. Azure AI Foundry中o3-deep-research模型是否正确部署\n2. 环境变量DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME是否正确设置\n3. Bing搜索资源是否正确配置`
          })
        }
      })

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout)
        serverLog('error', 'Deep Research Python进程启动失败', { requestId, error: error.message })
        resolve({
          success: false,
          response: `Deep Research Python进程启动失败: ${error.message}\n\n请检查Python环境和azure-ai-projects库安装。`
        })
      })
    })

    const totalDuration = Date.now() - startTime
    
    serverLog('info', 'Deep Research请求处理完成', { 
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
      isDeepResearch: true, // 标识使用了Deep Research
      meta: {
        requestId,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
        deepResearchModel: DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME
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
        error: 'Deep Research服务器内部错误，请稍后重试',
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

// 备用响应生成函数 - 已移除，因为我们要强制使用Deep Research 