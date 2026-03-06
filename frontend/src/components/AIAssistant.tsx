import React, { useState, useEffect, useRef } from 'react';
import {
  sendMessage,
  getConversationHistory,
  clearConversationHistory,
  getSuggestions,
  AIMessage,
  AIResponse,
} from '../services/aiAssistantApi';
import { useAuthStore } from '../stores/authStore';
import './AIAssistant.css';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载对话历史和建议
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadHistory();
      loadSuggestions();
    }
  }, [isOpen, isAuthenticated]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    try {
      const history = await getConversationHistory();
      setMessages(history);
    } catch (error) {
      console.error('加载对话历史失败:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const data = await getSuggestions();
      setSuggestions(data);
    } catch (error) {
      console.error('加载建议失败:', error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendMessage(inputValue);
      
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        metadata: {
          intent: response.intent,
          actionTaken: response.actionTaken,
          actionResult: response.actionResult,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 更新建议
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: '抱歉，发生了错误，请稍后重试。',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleClearHistory = async () => {
    if (!window.confirm('确定要清除所有对话历史吗？')) return;

    try {
      await clearConversationHistory();
      setMessages([]);
    } catch (error) {
      console.error('清除历史失败:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 渲染消息内容（支持简单的 Markdown）
  const renderMessageContent = (content: string) => {
    // 处理粗体
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      // 处理换行
      return part.split('\n').map((line, lineIndex) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    });
  };

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="ai-assistant">
        <div className="ai-assistant-header">
          <h3>AI 智能助手</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="ai-assistant-body">
          <div className="login-prompt">
            <p>请先登录以使用 AI 助手</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-header">
        <h3>AI 智能助手</h3>
        <div className="header-actions">
          <button className="clear-btn" onClick={handleClearHistory} title="清除历史">
            🗑️
          </button>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="ai-assistant-body">
        {/* 消息列表 */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <p>👋 你好！我是你的 AI 投资助手。</p>
              <p>我可以帮你：</p>
              <ul>
                <li>管理自选股</li>
                <li>分析股票信息</li>
                <li>对比不同股票</li>
                <li>总结新闻动态</li>
                <li>分析板块走势</li>
              </ul>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                {renderMessageContent(msg.content)}
              </div>
              <div className="message-time">{formatTime(msg.timestamp)}</div>
              {msg.metadata?.actionTaken && (
                <div className="action-badge">
                  ✓ {msg.metadata.actionTaken === 'add_watchlist' ? '已添加' :
                     msg.metadata.actionTaken === 'remove_watchlist' ? '已移除' :
                     msg.metadata.actionTaken}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 建议 */}
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-btn"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="ai-assistant-footer">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          rows={1}
          disabled={isLoading}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;
