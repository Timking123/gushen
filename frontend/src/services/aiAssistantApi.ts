import api from './api';

export interface ParsedIntent {
  type: string;
  confidence: number;
  entities: {
    symbols?: string[];
    sectorName?: string;
    timeRange?: string;
    query?: string;
  };
}

export interface AIResponse {
  message: string;
  intent: ParsedIntent;
  actionTaken?: string;
  actionResult?: unknown;
  suggestions?: string[];
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: ParsedIntent;
    actionTaken?: string;
    actionResult?: unknown;
  };
}

/**
 * 发送消息给AI助手
 */
export async function sendMessage(message: string): Promise<AIResponse> {
  const response = await api.post<{ response: AIResponse }>('/ai/chat', { message });
  return response.data.response;
}

/**
 * 获取对话历史
 */
export async function getConversationHistory(): Promise<AIMessage[]> {
  const response = await api.get<{ history: AIMessage[] }>('/ai/history');
  return response.data.history;
}

/**
 * 清除对话历史
 */
export async function clearConversationHistory(): Promise<void> {
  await api.delete('/ai/history');
}

/**
 * 获取个性化建议
 */
export async function getSuggestions(): Promise<string[]> {
  const response = await api.get<{ suggestions: string[] }>('/ai/suggestions');
  return response.data.suggestions;
}

/**
 * 解析用户意图（调试用）
 */
export async function parseIntent(message: string): Promise<ParsedIntent> {
  const response = await api.post<{ intent: ParsedIntent }>('/ai/parse-intent', { message });
  return response.data.intent;
}
