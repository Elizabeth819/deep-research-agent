'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Plus, MessageSquare, Upload, X, Bot, User, Settings, ExternalLink, Monitor, Trash2, Download, FileUp } from 'lucide-react'
import { logger } from '@/lib/logger'
import { LogViewer } from '@/components/LogViewer'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { conversationStorage, type Conversation, type Message } from '@/lib/conversationStorage'

// 定义对话消息类型接口
interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [useRealAgent, setUseRealAgent] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showLogViewer, setShowLogViewer] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentConversation = conversations.find(c => c.id === currentConversationId)

  // 页面加载时加载历史对话
  useEffect(() => {
    logger.info('Deep Research Agent UI 初始化完成', { 
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent 
    }, 'ui', 'frontend')
    
    // 加载历史对话
    const savedConversations = conversationStorage.loadConversations()
    setConversations(savedConversations)
    
    logger.info('加载历史对话', { 
      count: savedConversations.length 
    }, 'ui', 'frontend')
  }, [])

  // 保存对话到本地存储
  useEffect(() => {
    if (conversations.length > 0) {
      conversationStorage.saveConversations(conversations)
    }
  }, [conversations])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages])

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    
    logger.info('创建新对话', { conversationId: newConversation.id }, 'ui', 'frontend')
  }

  const updateConversationTitle = (conversationId: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, title: newTitle.slice(0, 30) + (newTitle.length > 30 ? '...' : ''), updatedAt: new Date() }
          : conv
      )
    )
  }

  const deleteConversation = (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId))
    conversationStorage.deleteConversation(conversationId)
    
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null)
    }
    
    logger.info('删除对话', { conversationId }, 'ui', 'frontend')
  }

  const exportConversations = () => {
    const data = conversationStorage.exportConversations()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `对话历史_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    logger.info('导出对话历史', { count: conversations.length }, 'ui', 'frontend')
  }

  const importConversations = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result as string
        if (conversationStorage.importConversations(data)) {
          const imported = conversationStorage.loadConversations()
          setConversations(imported)
          logger.info('导入对话历史成功', { count: imported.length }, 'ui', 'frontend')
          alert('导入成功！')
        } else {
          throw new Error('导入失败')
        }
      } catch (error) {
        logger.error('导入对话历史失败', error, 'ui', 'frontend')
        alert('导入失败，请检查文件格式！')
      }
    }
    reader.readAsText(file)
    
    // 重置文件输入
    if (importInputRef.current) {
      importInputRef.current.value = ''
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      
      logger.info('图片选择成功', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type 
      }, 'ui', 'frontend')
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    logger.info('移除选中图片', {}, 'ui', 'frontend')
  }

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return
    if (!currentConversationId) {
      createNewConversation()
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
      image: imagePreview || undefined
    }

    // 更新对话标题（使用第一条消息的前30个字符）
    if (currentConversation?.messages.length === 0 && input.trim()) {
      updateConversationTitle(currentConversationId, input.trim())
    }

    // 添加用户消息
    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, userMessage], updatedAt: new Date() }
          : conv
      )
    )

    const currentInput = input
    const apiEndpoint = useRealAgent ? '/api/integration' : '/api/chat'
    const method = 'POST'
    
    setInput('')
    removeImage()
    setIsLoading(true)

    // 记录API调用开始
    const startTime = Date.now()
    logger.apiCall(method, apiEndpoint, {
      message: currentInput,
      conversationId: currentConversationId,
      hasImage: !!selectedImage,
      useRealAgent
    })

    try {
      let requestBody: {
        message: string;
        conversationId: string;
        conversationHistory: ConversationMessage[];
      } | undefined;
      let response: Response

      if (useRealAgent) {
        // 使用真实Agent - JSON请求，包含完整对话历史
        const conversationHistory = currentConversation ? [...currentConversation.messages, userMessage] : [userMessage]
        
        requestBody = {
          message: currentInput,
          conversationId: currentConversationId,
          conversationHistory: conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          }))
        }
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
      } else {
        // 使用模拟模式 - FormData请求（支持图片）
        const formData = new FormData()
        formData.append('message', currentInput)
        formData.append('conversationId', currentConversationId)
        if (selectedImage) {
          formData.append('image', selectedImage)
        }
        response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData
        })
      }

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 记录API响应成功
      logger.apiResponse(method, apiEndpoint, response.status, {
        responseLength: data.response?.length || 0,
        citationsCount: data.citations?.length || 0,
        isRealAgent: data.isRealAgent
      }, duration)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        citations: data.citations,
        isRealAgent: data.isRealAgent
      }

      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentConversationId
            ? { ...conv, messages: [...conv.messages, assistantMessage], updatedAt: new Date() }
            : conv
        )
      )
    } catch (error) {
      const duration = Date.now() - startTime
      
      // 记录API错误
      logger.apiError(
        method,
        apiEndpoint,
        error instanceof Error ? error : new Error(String(error)),
        duration
      )
      
      console.error('发送消息失败:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `抱歉，发送消息时出现错误：${error instanceof Error ? error.message : '未知错误'}，请稍后重试。`,
        role: 'assistant',
        timestamp: new Date()
      }

      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentConversationId
            ? { ...conv, messages: [...conv.messages, errorMessage], updatedAt: new Date() }
            : conv
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧对话列表 */}
      <div className="w-80 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mb-3"
          >
            <Plus size={20} />
            新建对话
          </button>
          
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mb-3"
          >
            <Settings size={20} />
            设置
          </button>

          {/* 日志查看器按钮 */}
          <button
            onClick={() => setShowLogViewer(true)}
            className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Monitor size={20} />
            系统日志
          </button>
          
          {/* 设置面板 */}
          {showSettings && (
            <div className="mb-3 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm">使用真实Agent</span>
                <button
                  onClick={() => {
                    const newValue = !useRealAgent
                    setUseRealAgent(newValue)
                    logger.info(`切换Agent模式`, { 
                      useRealAgent: newValue, 
                      mode: newValue ? '真实Agent' : '演示模式' 
                    }, 'ui', 'frontend')
                  }}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    useRealAgent ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      useRealAgent ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {useRealAgent 
                  ? '连接Azure AI进行深度研究' 
                  : '使用模拟模式（支持图片上传）'
                }
              </p>
              
              {/* 导出/导入按钮 */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={exportConversations}
                  className="flex-1 flex items-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                  title="导出对话历史"
                >
                  <Download size={16} />
                  导出
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="flex-1 flex items-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                  title="导入对话历史"
                >
                  <FileUp size={16} />
                  导入
                </button>
              </div>
              
              <button
                onClick={() => {
                  conversationStorage.clearAllConversations()
                  setConversations([])
                  setCurrentConversationId(null)
                  logger.info('清空所有对话历史', {}, 'ui', 'frontend')
                }}
                className="w-full flex items-center gap-2 p-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
              >
                <Trash2 size={16} />
                清空所有对话
              </button>
            </div>
          )}
          
          <input
            type="file"
            ref={importInputRef}
            onChange={importConversations}
            accept=".json"
            className="hidden"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="group relative">
              <button
                onClick={() => {
                  setCurrentConversationId(conversation.id)
                  logger.info('切换对话', { 
                    conversationId: conversation.id, 
                    title: conversation.title 
                  }, 'ui', 'frontend')
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentConversationId === conversation.id
                    ? 'bg-gray-700'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3 pr-8">
                  <MessageSquare size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {conversation.messages.length} 条消息 • {new Date(conversation.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('确定要删除这个对话吗？')) {
                    deleteConversation(conversation.id)
                  }
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-all"
                title="删除对话"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              暂无对话历史
            </div>
          )}
        </div>
      </div>

      {/* 右侧聊天区域 */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* 聊天头部 */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <Bot className="text-blue-600" size={24} />
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">Deep Research Agent</h2>
                  <p className="text-sm text-gray-500">
                    AI研究助手 • {useRealAgent ? '真实Agent模式' : '模拟模式'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  useRealAgent 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {useRealAgent ? '实时研究' : '演示模式'}
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-3xl p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    {message.image && (
                      <img
                        src={message.image}
                        alt="用户上传的图片"
                        className="max-w-xs rounded-lg mb-3"
                      />
                    )}
                    
                    {/* 使用Markdown渲染内容 */}
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer content={message.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    
                    {/* 显示引用来源 */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">参考来源:</h4>
                        <div className="space-y-1">
                          {message.citations.map((citation, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-blue-600">
                              <ExternalLink size={12} />
                              <span>{citation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div
                      className={`text-xs mt-2 flex items-center gap-2 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      {message.role === 'assistant' && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          message.isRealAgent 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {message.isRealAgent ? '真实Agent' : '模拟'}
                        </span>
                      )}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 p-4 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {useRealAgent ? '正在进行深度研究...' : '正在处理...'}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="bg-white border-t border-gray-200 p-4">
              {imagePreview && (
                <div className="mb-4 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="预览"
                    className="max-h-32 rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              
              <div className="flex gap-3 items-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                
                {/* 只在模拟模式下显示图片上传按钮 */}
                {!useRealAgent && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="上传图片（仅模拟模式）"
                  >
                    <Upload size={20} />
                  </button>
                )}

                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={useRealAgent ? "输入您的研究问题..." : "输入您的问题..."}
                    className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>

                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          // 欢迎页面
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Bot size={64} className="mx-auto text-blue-600 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">欢迎使用 Deep Research Agent</h1>
              <p className="text-gray-600 mb-4">基于Azure AI的深度研究助手，帮助您探索前沿科技和学术领域</p>
              <div className={`inline-block px-4 py-2 rounded-lg mb-6 ${
                useRealAgent 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                当前模式: {useRealAgent ? '真实Agent研究' : '演示模拟模式'}
              </div>
              <div>
                <button
                  onClick={createNewConversation}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  开始新对话
                </button>
              </div>
              {conversations.length > 0 && (
                <div className="mt-4 text-sm text-gray-500">
                  或从左侧选择一个历史对话继续
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 日志查看器 */}
      <LogViewer isOpen={showLogViewer} onClose={() => setShowLogViewer(false)} />
    </div>
  )
}
