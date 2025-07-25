import React from 'react'

interface CircularProgressProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  className?: string
  showPercentage?: boolean
  stage?: string
  details?: string
}

export default function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 6,
  className = '',
  showPercentage = false,
  stage,
  details
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* 背景圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* 进度圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
          {/* 渐变定义 */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* 中心内容 */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-700">
              {Math.round(progress)}%
            </span>
          </div>
        )}
        
        {/* 旋转动画点 */}
        {progress < 100 && (
          <div 
            className="absolute w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{
              top: size / 2 - strokeWidth / 2,
              left: size / 2 + radius * Math.cos((progress / 100) * 2 * Math.PI - Math.PI / 2) - 4,
              transform: `translate(${radius * Math.sin((progress / 100) * 2 * Math.PI - Math.PI / 2)}px, ${-radius * Math.cos((progress / 100) * 2 * Math.PI - Math.PI / 2)}px)`
            }}
          />
        )}
      </div>
      
      {/* 状态文本 */}
      {stage && (
        <div className="text-center space-y-1">
          <div className="text-sm font-medium text-gray-700">
            {stage}
          </div>
          {details && (
            <div className="text-xs text-gray-500 max-w-xs">
              {details}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 专门用于Deep Research的进度组件
export function DeepResearchProgress({
  progress,
  stage,
  details,
  className = ''
}: {
  progress: number
  stage?: string
  details?: string
  className?: string
}) {
  return (
    <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100 ${className}`}>
      <div className="flex items-center space-x-4">
        <CircularProgress
          progress={progress}
          size={60}
          strokeWidth={4}
          stage={stage}
          details={details}
        />
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-800">
              🔬 Deep Research 分析中
            </span>
          </div>
          {stage && (
            <div className="text-xs text-gray-600">
              当前阶段: {stage}
            </div>
          )}
          {details && (
            <div className="text-xs text-gray-500">
              {details}
            </div>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 