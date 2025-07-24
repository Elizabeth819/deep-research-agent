'use client'

import { useState, useEffect } from 'react'
import { X, Download, Trash2, Filter, Search, Bug, Info, AlertTriangle, AlertCircle, Monitor } from 'lucide-react'
import { logger, LogEntry } from '@/lib/logger'

interface LogViewerProps {
  isOpen: boolean
  onClose: () => void
}

export function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState({
    level: '',
    category: '',
    search: ''
  })
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs)
    })

    return unsubscribe
  }, [isOpen])

  const filteredLogs = logger.getLogs(filter)

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="text-red-500" size={16} />
      case 'warn': return <AlertTriangle className="text-yellow-500" size={16} />
      case 'debug': return <Bug className="text-gray-500" size={16} />
      default: return <Info className="text-blue-500" size={16} />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api': return '🌐'
      case 'ui': return '🎨'
      default: return '⚙️'
    }
  }

  const getLevelBgColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-50 border-red-200'
      case 'warn': return 'bg-yellow-50 border-yellow-200'
      case 'debug': return 'bg-gray-50 border-gray-200'
      default: return 'bg-blue-50 border-blue-200'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString() + '.' + timestamp.getMilliseconds().toString().padStart(3, '0')
  }

  const formatData = (data: any) => {
    if (!data) return null
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Monitor size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">系统日志</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              {filteredLogs.length} 条记录
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => logger.exportLogs()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="导出日志"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => {
                if (confirm('确定要清空所有日志吗？')) {
                  logger.clear()
                }
              }}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg"
              title="清空日志"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 过滤器 */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <select
                value={filter.level}
                onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">所有级别</option>
                <option value="info">信息</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
                <option value="debug">调试</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={filter.category}
                onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">所有类别</option>
                <option value="api">API</option>
                <option value="ui">UI</option>
                <option value="system">系统</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search size={16} className="text-gray-500" />
              <input
                type="text"
                placeholder="搜索日志内容..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              自动滚动
            </label>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-auto p-4 space-y-2 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Monitor size={48} className="mx-auto mb-4 text-gray-300" />
              <p>暂无日志记录</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-lg p-3 ${getLevelBgColor(log.level)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getLevelIcon(log.level)}
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="text-xs">
                      {getCategoryIcon(log.category)} {log.category.toUpperCase()}
                    </span>
                    {log.source && (
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                        {log.source}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 text-gray-800">
                  {log.message}
                </div>

                {log.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                      查看详细数据
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {formatData(log.data)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between">
          <span>实时更新: {autoScroll ? '开启' : '关闭'}</span>
          <span>最后更新: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
} 