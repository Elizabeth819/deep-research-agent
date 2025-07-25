import os, time
from typing import Optional

# 设置环境变量
os.environ.setdefault('AI_FOUNDRY_PROJECT_ENDPOINT', 'https://wanme-mcyg2lf0-westus.services.ai.azure.com/api/projects/deep-research-agent')
os.environ.setdefault('DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME', 'o3-deep-research')
os.environ.setdefault('MODEL_DEPLOYMENT_NAME', 'gpt-4o')
os.environ.setdefault('BING_RESOURCE_NAME', 'elizbinggroundingwestus')

try:
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential
    from azure.ai.agents import AgentsClient
    from azure.ai.agents.models import DeepResearchTool, MessageRole, ThreadMessage
    print("✅ Azure AI模块导入成功 - 使用azure-ai-agents 1.1.0b4版本")
except ImportError as e:
    print(f"❌ 导入Azure模块失败: {e}")
    print("请安装依赖: pip install --pre azure-ai-agents==1.1.0b4")
    exit(1)

def fetch_and_print_new_agent_response(
    thread_id: str,
    agents_client: AgentsClient,
    last_message_id: Optional[str] = None,
) -> Optional[str]:
    response = agents_client.messages.get_last_message_by_role(
        thread_id=thread_id,
        role=MessageRole.AGENT,
    )
    if not response or response.id == last_message_id:
        return last_message_id  # No new content

    print("\n🤖 Deep Research Agent响应:")
    print("\n".join(t.text.value for t in response.text_messages))

    if response.url_citation_annotations:
        print("\n📚 参考文献:")
        for ann in response.url_citation_annotations:
            print(f"  [{ann.url_citation.title}]({ann.url_citation.url})")

    return response.id

def create_research_summary(
        message: ThreadMessage,
        filepath: str = "research_summary.md"
) -> None:
    if not message:
        print("❌ 无法创建研究摘要：没有消息内容")
        return

    with open(filepath, "w", encoding="utf-8") as fp:
        # Write text summary
        text_summary = "\n\n".join([t.text.value.strip() for t in message.text_messages])
        fp.write(text_summary)

        # Write unique URL citations, if present
        if message.url_citation_annotations:
            fp.write("\n\n## 参考文献\n")
            seen_urls = set()
            for ann in message.url_citation_annotations:
                url = ann.url_citation.url
                title = ann.url_citation.title or url
                if url not in seen_urls:
                    fp.write(f"- [{title}]({url})\n")
                    seen_urls.add(url)

    print(f"✅ 研究摘要已保存到 '{filepath}'")

def main():
    print("🚀 启动Deep Research Agent独立脚本")
    print(f"📍 项目端点: {os.environ['AI_FOUNDRY_PROJECT_ENDPOINT']}")
    print(f"🧠 Deep Research模型: {os.environ['DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME']}")
    print(f"💬 对话模型: {os.environ['MODEL_DEPLOYMENT_NAME']}")
    
    try:
        # 初始化Azure客户端
        project_client = AIProjectClient(
            endpoint=os.environ["AI_FOUNDRY_PROJECT_ENDPOINT"],
            credential=DefaultAzureCredential(),
        )
        print("✅ Azure项目客户端初始化成功")

        # 获取Bing连接
        conn_id = project_client.connections.get(name=os.environ["BING_RESOURCE_NAME"]).id
        print(f"✅ Bing连接获取成功: {conn_id[:10]}...")

        # 初始化Deep Research工具 - 关键步骤！
        print("🔬 初始化Deep Research工具...")
        deep_research_tool = DeepResearchTool(
            bing_grounding_connection_id=conn_id,
            deep_research_model=os.environ["DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME"],
        )
        print(f"✅ Deep Research工具初始化成功，模型: {os.environ['DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME']}")

        with project_client:
            with project_client.agents as agents_client:
                print("🤖 创建Deep Research Agent...")
                
                # 创建使用Deep Research工具的Agent
                agent = agents_client.create_agent(
                    model=os.environ["MODEL_DEPLOYMENT_NAME"],
                    name="deep-research-agent",
                    instructions="""你是一个专业的AI深度研究助手，具有多轮对话能力，能够进行深度研究和分析。请遵循以下指导原则：
1. 使用中文回复
2. 使用Deep Research工具进行深入的研究分析
3. 提供最新、准确的研究信息和数据
4. 包含具体的技术细节和引用来源
5. 结构化组织回复内容，提供详细的研究报告
6. 针对前沿科技领域提供深入分析
7. 充分利用Deep Research模型的o3-deep-research能力提供高质量的研究内容""",
                    tools=deep_research_tool.definitions,
                )
                print(f"✅ Deep Research Agent创建成功，ID: {agent.id}")
                print(f"🔧 已配置 {len(deep_research_tool.definitions)} 个Deep Research工具")

                # 创建对话线程
                thread = agents_client.threads.create()
                print(f"💬 对话线程创建成功，ID: {thread.id}")

                # 获取用户问题
                user_question = input("\n❓ 请输入您的研究问题: ").strip()
                if not user_question:
                    user_question = "请介绍量子计算在2024年的最新研究进展和突破"

                print(f"\n🔍 开始Deep Research分析: {user_question}")
                
                # 创建用户消息
                message = agents_client.messages.create(
                    thread_id=thread.id,
                    role="user",
                    content=user_question,
                )
                print(f"📝 用户消息创建成功，ID: {message.id}")

                print("⏳ Deep Research正在进行深度分析，这可能需要几分钟时间...")
                
                # 开始处理 - Deep Research可能需要较长时间
                run = agents_client.runs.create(thread_id=thread.id, agent_id=agent.id)
                last_message_id = None
                start_time = time.time()
                
                while run.status in ("queued", "in_progress"):
                    elapsed = time.time() - start_time
                    print(f"⏱️  Deep Research进行中... ({elapsed:.0f}秒)")
                    
                    time.sleep(10)  # Deep Research需要较长轮询间隔
                    run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)

                    # 获取中间响应
                    last_message_id = fetch_and_print_new_agent_response(
                        thread_id=thread.id,
                        agents_client=agents_client,
                        last_message_id=last_message_id,
                    )
                
                processing_time = time.time() - start_time
                print(f"\n⚡ Deep Research处理完成，状态: {run.status}，用时: {processing_time:.1f}秒")

                if run.status == "failed":
                    print(f"❌ Deep Research运行失败: {run.last_error}")
                    return

                # 获取最终的Deep Research响应
                final_message = agents_client.messages.get_last_message_by_role(
                    thread_id=thread.id, role=MessageRole.AGENT
                )
                
                if final_message:
                    print("\n📄 生成研究摘要文件...")
                    create_research_summary(final_message)
                    print("\n✅ Deep Research分析完成！")
                else:
                    print("❌ 未能获取Deep Research响应")

                # 清理Agent
                print("🧹 清理资源...")
                agents_client.delete_agent(agent.id)
                print("✅ Deep Research Agent已删除")

    except Exception as e:
        print(f"❌ Deep Research执行失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()