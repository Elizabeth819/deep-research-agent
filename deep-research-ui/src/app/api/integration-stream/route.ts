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
  return logEntry
}

// 环境变量读取
const AI_FOUNDRY_PROJECT_ENDPOINT = process.env.AI_FOUNDRY_PROJECT_ENDPOINT || "https://wanme-mcyg2lf0-westus.services.ai.azure.com/api/projects/deep-research-agent";
const AI_AGENT_MODEL = process.env.MODEL_DEPLOYMENT_NAME || "gpt-4o";
const AI_AGENT_NAME = process.env.AI_AGENT_NAME || "deep-research-agent";
const DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME = process.env.DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME || "o3-deep-research";
const BING_RESOURCE_NAME = process.env.BING_RESOURCE_NAME || "elizbinggroundingwestus";

// 流式Deep Research Agent
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  let tempFilePath: string | null = null
  
  serverLog('info', '收到流式Deep Research Agent请求', { requestId })
  
  try {
    const { message, conversationId, conversationHistory } = await request.json()
    
    if (!message) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // 发送进度更新
        const sendProgress = (stage: string, progress: number, details?: string) => {
          const progressData = {
            type: 'progress',
            stage,
            progress,
            details,
            timestamp: new Date().toISOString(),
            requestId
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))
        }

        // 发送最终结果
        const sendResult = (response: string, citations?: string[], duration?: number) => {
          const resultData = {
            type: 'result',
            response,
            citations,
            conversationId,
            isRealAgent: true,
            isDeepResearch: true,
            duration,
            timestamp: new Date().toISOString(),
            requestId
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultData)}\n\n`))
        }

        // 发送错误
        const sendError = (error: string, duration?: number) => {
          const errorData = {
            type: 'error',
            error,
            duration,
            timestamp: new Date().toISOString(),
            requestId
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
        }

        try {
          sendProgress('初始化', 5, '准备Deep Research环境...')

          // 构建对话历史的Python代码
          const buildConversationHistoryPython = (history: ConversationMessage[]) => {
            if (!history || history.length === 0) {
              return '                # 无历史对话'
            }
            
            let historyCode = `
                    # 添加对话历史
                    python_log('info', '开始添加对话历史', {'history_count': ${history.length - 1}})`
            
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

          sendProgress('脚本准备', 10, '生成Deep Research Python脚本...')

          // 创建增强的Python脚本，包含进度报告
          const tempScript = `
import os, time, sys, traceback, json
from typing import Optional

# 设置日志输出和进度报告
def python_log(level, message, data=None):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] [PYTHON-{level.upper()}] {message}"
    if data:
        log_msg += f" | Data: {data}"
    print(log_msg, flush=True)

def report_progress(stage, progress, details=""):
    progress_data = {
        "type": "progress_update",
        "stage": stage,
        "progress": progress,
        "details": details,
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
    }
    print(f"PROGRESS_UPDATE:{json.dumps(progress_data)}", flush=True)

python_log('info', 'Python脚本开始执行', {'request_id': '${requestId}'})
report_progress("初始化", 15, "导入Azure模块...")

try:
    python_log('info', '尝试导入Azure模块')
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential
    from azure.ai.agents import AgentsClient
    from azure.ai.agents.models import DeepResearchTool, MessageRole, ThreadMessage
    python_log('info', 'Azure模块导入成功 - 使用azure-ai-agents 1.1.0b4版本')
    report_progress("模块导入", 25, "Azure模块导入完成")
except ImportError as e:
    python_log('error', 'Azure模块导入失败', str(e))
    print("AGENT_RESPONSE_START")
    print(f"导入Azure模块失败: {str(e)}。请确保已安装相关依赖: pip install --pre azure-ai-agents==1.1.0b4")
    print("AGENT_RESPONSE_END")
    sys.exit(1)

def main():
    try:
        python_log('info', '开始初始化Azure客户端')
        report_progress("连接初始化", 30, "连接Azure AI Foundry...")
        
        # 设置超时环境变量
        os.environ.setdefault('AZURE_CLIENT_TIMEOUT', '30')
        
        project_client = AIProjectClient(
            endpoint="${AI_FOUNDRY_PROJECT_ENDPOINT}",
            credential=DefaultAzureCredential(),
        )
        python_log('info', 'Azure项目客户端初始化成功')
        report_progress("项目连接", 40, "Azure项目连接成功")

        python_log('info', '获取Bing连接配置')
        conn_id = project_client.connections.get(name="${BING_RESOURCE_NAME}").id
        python_log('info', 'Bing连接配置获取成功', {'connection_id': conn_id[:10] + '...'})
        report_progress("Bing连接", 50, "搜索服务连接成功")

        # 初始化Deep Research工具
        python_log('info', '初始化Deep Research工具')
        deep_research_tool = DeepResearchTool(
            bing_grounding_connection_id=conn_id,
            deep_research_model="${DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME}",
        )
        python_log('info', 'Deep Research工具初始化成功', {'model': '${DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME}'})
        report_progress("工具初始化", 60, "Deep Research工具准备完成")

        with project_client:
            with project_client.agents as agents_client:
                python_log('info', '开始创建Agent with Deep Research Tool')
                report_progress("Agent创建", 65, "创建Deep Research Agent...")
                
                # 创建使用Deep Research工具的Agent
                agent = agents_client.create_agent(
                    model="${AI_AGENT_MODEL}",
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
                report_progress("Agent就绪", 70, "Deep Research Agent创建完成")

                # Create thread for communication
                python_log('info', '创建会话线程')
                thread = agents_client.threads.create()
                python_log('info', '会话线程创建成功', {'thread_id': thread.id})
                report_progress("线程创建", 75, "对话线程准备完成")

${buildConversationHistoryPython(conversationHistory || [])}

                # Create current user message to thread
                python_log('info', '添加当前用户消息到线程')
                user_message = agents_client.messages.create(
                    thread_id=thread.id,
                    role="user",
                    content="${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
                )
                python_log('info', '当前用户消息添加成功', {'message_id': user_message.id})
                report_progress("消息处理", 80, "用户消息已添加")

                # Process the message with Deep Research
                python_log('info', '开始Deep Research处理')
                report_progress("深度分析", 85, "启动o3-deep-research模型分析...")
                run_start_time = time.time()
                run = agents_client.runs.create(thread_id=thread.id, agent_id=agent.id)
                python_log('info', 'Deep Research任务创建成功', {'run_id': run.id})
                
                # Poll the run with extended timeout for deep research
                timeout_seconds = 300  # 5分钟超时，给Deep Research充足时间
                start_time = time.time()
                poll_count = 0
                last_progress = 85
                
                while run.status in ("queued", "in_progress"):
                    poll_count += 1
                    current_time = time.time()
                    elapsed = current_time - start_time
                    
                    if elapsed > timeout_seconds:
                        python_log('warn', 'Deep Research处理超时', {'elapsed_seconds': elapsed, 'poll_count': poll_count})
                        report_progress("超时处理", 95, f"Deep Research分析超时（{elapsed:.0f}秒），但模型可能仍在处理中...")
                        print("AGENT_RESPONSE_START")
                        print("Deep Research分析时间较长，模型正在进行深度研究。这表明您的问题很有挑战性，请稍等片刻...")
                        print("AGENT_RESPONSE_END")
                        break
                        
                    # 动态更新进度
                    progress_increment = min(10, elapsed / timeout_seconds * 10)
                    current_progress = min(95, last_progress + progress_increment)
                    
                    time.sleep(8)  # Deep Research需要较长轮询间隔
                    run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)
                    
                    if poll_count % 3 == 0:  # 每24秒更新一次进度
                        details = f"深度分析进行中...（{elapsed:.0f}秒）"
                        if poll_count > 6:
                            details += " - 正在进行复杂的研究分析"
                        report_progress("深度分析", int(current_progress), details)
                        python_log('info', f'Deep Research进行中 #{poll_count}', {'status': run.status, 'elapsed_seconds': elapsed})

                processing_duration = time.time() - run_start_time
                python_log('info', 'Deep Research处理完成', {
                    'final_status': run.status,
                    'processing_duration_seconds': processing_duration,
                    'poll_count': poll_count
                })

                if run.status == "completed":
                    python_log('info', '获取Deep Research响应')
                    report_progress("结果处理", 97, "解析Deep Research结果...")
                    
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
                        
                        report_progress("完成", 100, f"Deep Research分析完成！用时 {processing_duration:.1f} 秒")
                        
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
                            
                        print(f"PROCESSING_TIME:{processing_duration:.2f}")
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

          // 创建临时文件
          const timestamp = Date.now()
          tempFilePath = join(os.tmpdir(), `deep_research_stream_${timestamp}_${Math.random().toString(36).substr(2, 9)}.py`)
          
          sendProgress('文件准备', 15, '创建临时执行文件...')
          await writeFile(tempFilePath, tempScript, 'utf8')
          
          // 添加短暂延迟确保文件系统同步
          await new Promise(resolve => setTimeout(resolve, 100))

          // 验证文件创建
          try {
            await access(tempFilePath, constants.F_OK)
            sendProgress('文件就绪', 20, '执行文件准备完成')
          } catch (error) {
            sendError(`临时文件创建失败: ${error}`)
            return
          }

          // 执行Python脚本
          sendProgress('启动执行', 25, 'Deep Research模型启动中...')
          
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
          let processingTime = 0

          pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString()
            output += chunk
            
            // 解析进度更新
            const progressMatches = chunk.match(/PROGRESS_UPDATE:(.+)/g)
            if (progressMatches) {
              progressMatches.forEach((match: string) => {
                try {
                  const progressData = JSON.parse(match.replace('PROGRESS_UPDATE:', ''))
                  sendProgress(progressData.stage, progressData.progress, progressData.details)
                } catch (e) {
                  // 忽略解析错误
                }
              })
            }
          })

          pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString()
            errorOutput += chunk
          })

          pythonProcess.on('close', (code, signal) => {
            const totalDuration = (Date.now() - startTime) / 1000
            
            if (output.includes('AGENT_RESPONSE_START') && output.includes('AGENT_RESPONSE_END')) {
              // 提取响应内容
              const responseMatch = output.match(/AGENT_RESPONSE_START\n([\s\S]*?)\nAGENT_RESPONSE_END/)
              const citationsMatch = output.match(/CITATIONS_START\n([\s\S]*?)\nCITATIONS_END/)
              const timeMatch = output.match(/PROCESSING_TIME:([0-9.]+)/)
              
              const response = responseMatch ? responseMatch[1].trim() : '获取Deep Research响应失败'
              const citations = citationsMatch ? citationsMatch[1].trim().split('\n').filter(c => c.trim()) : undefined
              processingTime = timeMatch ? parseFloat(timeMatch[1]) : totalDuration

              sendResult(response, citations, processingTime)
            } else {
              const errorInfo = errorOutput ? `错误信息: ${errorOutput.slice(0, 500)}` : ''
              sendError(`Deep Research Agent调用失败。${errorInfo}`, totalDuration)
            }
            
            controller.close()
          })

          pythonProcess.on('error', (error) => {
            const totalDuration = (Date.now() - startTime) / 1000
            sendError(`Deep Research Python进程启动失败: ${error.message}`, totalDuration)
            controller.close()
          })

        } catch (error) {
          const totalDuration = (Date.now() - startTime) / 1000
          sendError(`Deep Research服务器内部错误: ${error instanceof Error ? error.message : String(error)}`, totalDuration)
          controller.close()
        } finally {
          // 清理临时文件
          if (tempFilePath) {
            try {
              await access(tempFilePath, constants.F_OK)
              await unlink(tempFilePath)
            } catch (error) {
              // 文件可能已经不存在，忽略此错误
            }
          }
        }
      },

      cancel() {
        // 处理客户端取消请求
        serverLog('info', '客户端取消了流式请求', { requestId })
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    serverLog('error', '流式Deep Research Agent集成错误', { 
      requestId, 
      error: error instanceof Error ? error.message : String(error)
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
  }
} 