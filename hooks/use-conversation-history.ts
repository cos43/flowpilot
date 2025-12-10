import { useState, useCallback, useEffect } from "react";
import type { DiagramRenderingMode } from "@/features/chat-panel/types";

export interface ConversationHistoryItem {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  renderMode?: DiagramRenderingMode;
  // 保存完整的消息数据（简化版本）
  messagesData?: any[];
  // 保存最后一次的图表状态
  finalDiagramXml?: string;
  // 保存所有图表结果
  diagramResults?: Array<{
    id: string;
    xml?: string;
    svg?: string;
    mode: DiagramRenderingMode;
  }>;
}

const MAX_CONVERSATIONS = 15;
const STORAGE_KEY = "flowpilot_conversation_history";

export function useConversationHistory() {
  const [conversations, setConversations] = useState<ConversationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 从本地存储加载对话历史
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConversationHistoryItem[];
        // 按时间倒序排序
        const sorted = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setConversations(sorted);
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存到本地存储
  const saveToStorage = useCallback((conversations: ConversationHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error("Failed to save conversation history:", error);
    }
  }, []);

  // 生成对话标题（基于实际消息内容）
  const generateTitle = useCallback((messagesData: any[]): string => {
    // 找到第一条用户消息
    const firstUserMessage = messagesData.find(msg => msg.role === "user");
    if (!firstUserMessage) return "新对话";

    // 尝试提取文本内容
    let text = "";
    if (typeof firstUserMessage.content === "string") {
      text = firstUserMessage.content;
    } else if (Array.isArray(firstUserMessage.content)) {
      const textPart = firstUserMessage.content.find((part: any) => part.type === "text");
      if (textPart && textPart.text) {
        text = textPart.text;
      }
    } else if (firstUserMessage.parts) {
      const textPart = firstUserMessage.parts.find((part: any) => part.type === "text");
      if (textPart && textPart.text) {
        text = textPart.displayText || textPart.text;
      }
    }

    if (text) {
      // 取前20个字符作为标题
      return text.slice(0, 20) + (text.length > 20 ? "..." : "");
    }

    return "新对话";
  }, []);

  // 保存当前对话
  const saveCurrentConversation = useCallback((
    messagesData: any[],
    renderMode?: DiagramRenderingMode,
    finalDiagramXml?: string,
    diagramResults?: Map<string, any>
  ) => {
    if (messagesData.length === 0) return;

    const now = Date.now();
    const title = generateTitle(messagesData);

    // 转换 diagramResults Map 为数组
    const diagramResultsArray: Array<{
      id: string;
      xml?: string;
      svg?: string;
      mode: DiagramRenderingMode;
    }> = [];

    if (diagramResults) {
      diagramResults.forEach((data, id) => {
        diagramResultsArray.push({
          id,
          xml: data.xml,
          svg: data.svg,
          mode: data.mode || "drawio",
        });
      });
    }

    const conversationItem: ConversationHistoryItem = {
      id: `conv_${now}`,
      title,
      messageCount: messagesData.length,
      createdAt: now,
      updatedAt: now,
      renderMode,
      messagesData: messagesData, // 保存完整消息
      finalDiagramXml,
      diagramResults: diagramResultsArray,
    };

    setConversations(prev => {
      // 添加新对话到开头
      const updated = [conversationItem, ...prev];
      // 只保留最新的 MAX_CONVERSATIONS 条
      const trimmed = updated.slice(0, MAX_CONVERSATIONS);

      saveToStorage(trimmed);
      return trimmed;
    });
  }, [generateTitle, saveToStorage]);

  // 删除对话
  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => {
      const filtered = prev.filter(conv => conv.id !== conversationId);
      saveToStorage(filtered);
      return filtered;
    });
  }, [saveToStorage]);

  // 清空所有对话历史
  const clearAllConversations = useCallback(() => {
    setConversations([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear conversation history:", error);
    }
  }, []);

  return {
    conversations,
    isLoading,
    saveCurrentConversation,
    deleteConversation,
    clearAllConversations,
  };
}
