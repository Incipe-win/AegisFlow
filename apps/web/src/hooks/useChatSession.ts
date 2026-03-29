import { useState, useCallback, useRef } from "react";
import {
  createSession,
  runChat,
  getRun,
  listRunEvents,
  uploadKnowledgeDocument,
  type Session,
  type Run,
  type RunEvent,
  type ChatRunRequest,
} from "../api/client";
import { streamChatRun, type StreamFrame } from "../api/stream";
import type { ChatMessage, MessageRole } from "../components/ChatMessage";

// 扩展的会话类型
export interface ChatSession extends Session {
  messages: ChatMessage[];
  lastMessage?: string;
  messageCount: number;
}

// 将API事件转换为聊天消息
function eventToMessage(event: RunEvent, sessionId: string): ChatMessage {
  const role = (event.role || "system") as MessageRole;

  let metadata;
  if (event.toolName) {
    metadata = {
      toolName: event.toolName,
      // payload可能包含更多信息，但这里简化处理
    };
  }

  return {
    id: `${event.runId}-${event.createdAt}`,
    role,
    content: event.content || "",
    timestamp: new Date(event.createdAt),
    metadata,
  };
}

// 将用户输入转换为消息
function createUserMessage(content: string, files?: File[]): ChatMessage {
  const metadata = files && files.length > 0 ? {
    files: files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  } : undefined;

  return {
    id: `user-${Date.now()}`,
    role: "user",
    content,
    timestamp: new Date(),
    metadata,
  };
}

export function useChatSession() {
  // 会话状态
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当前运行的引用
  const currentRunId = useRef<string | null>(null);

  // 获取当前会话
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // 创建新会话
  const startNewSession = useCallback(async (title?: string) => {
    try {
      setError(null);

      // 如果已经有空的对话，直接使用该对话
      const emptySession = sessions.find(s => s.messageCount === 0 || (s.messages && s.messages.length === 0));
      if (emptySession) {
        if (currentSessionId !== emptySession.id) {
          setCurrentSessionId(emptySession.id);
          setMessages([]);
          currentRunId.current = null;
        }
        return emptySession.id;
      }

      const response = await createSession({
        title: title || `对话 ${new Date().toLocaleString("zh-CN")}`,
        mode: "chat",
      });

      const newSession: ChatSession = {
        ...response.data,
        messages: [],
        messageCount: 0,
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      currentRunId.current = null;

      return newSession.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建会话失败");
      throw err;
    }
  }, [sessions, currentSessionId]);

  const ensureSessionId = useCallback(async () => {
    if (currentSessionId) {
      return currentSessionId;
    }
    return startNewSession();
  }, [currentSessionId, startNewSession]);

  // 切换会话
  const switchSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      currentRunId.current = null;
    }
  }, [sessions]);

  // 发送消息（普通模式）
  const sendMessage = useCallback(async (content: string) => {
    try {
      const sessionId = await ensureSessionId();
      setError(null);

      // 添加用户消息
      const userMessage = createUserMessage(content);
      setMessages(prev => [...prev, userMessage]);

      // 发送到API
      const response = await runChat({
        sessionId,
        query: content,
        topK: 4,
      });

      currentRunId.current = response.data.id;

      // 获取事件并转换为消息
      const eventsResponse = await listRunEvents(response.data.id);
      const assistantMessages = eventsResponse.data
        .filter(event => event.role === "assistant" && event.content)
        .map(event => eventToMessage(event, sessionId));

      // 更新消息列表
      setMessages(prev => [...prev, ...assistantMessages]);

      // 更新会话记录
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          const newMessages = [...session.messages, userMessage, ...assistantMessages];
          return {
            ...session,
            messages: newMessages,
            messageCount: newMessages.length,
            lastMessage: content,
          };
        }
        return session;
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : "发送消息失败");

      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `错误: ${err instanceof Error ? err.message : "发送消息失败"}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  }, [ensureSessionId]);

  // 发送消息（流式模式）
  const sendMessageStream = useCallback(async (content: string) => {
    try {
      const sessionId = await ensureSessionId();
      setError(null);
      setIsStreaming(true);

      // 添加用户消息
      const userMessage = createUserMessage(content);
      setMessages(prev => [...prev, userMessage]);

      // 流式处理
      let assistantMessage: ChatMessage | null = null;
      const streamMessages: ChatMessage[] = [];

      await streamChatRun(
        {
          sessionId,
          query: content,
          topK: 4,
        },
        (frame: StreamFrame) => {
          if (frame.event === "run_event") {
            try {
              const event = JSON.parse(frame.data) as RunEvent;

              if (event.role === "assistant" && event.content) {
                if (!assistantMessage) {
                  const newAssistantMessage = eventToMessage(event, sessionId);
                  assistantMessage = newAssistantMessage;
                  setMessages(prev => [...prev, newAssistantMessage]);
                } else {
                  // 更新现有消息内容
                  const updatedAssistantMessage = {
                    ...assistantMessage,
                    content: assistantMessage.content + event.content,
                    isStreaming: true,
                  };
                  assistantMessage = updatedAssistantMessage;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (lastIndex >= 0 && newMessages[lastIndex].id === updatedAssistantMessage.id) {
                      newMessages[lastIndex] = updatedAssistantMessage;
                    }
                    return newMessages;
                  });
                }
              } else if (event.role === "tool") {
                const toolMessage = eventToMessage(event, sessionId);
                streamMessages.push(toolMessage);
                setMessages(prev => [...prev, toolMessage]);
              }
            } catch (err) {
              console.error("解析流式事件失败:", err);
            }
          } else if (frame.event === "done") {
            try {
              const completedRun = JSON.parse(frame.data) as Run;
              currentRunId.current = completedRun.id;
            } catch (err) {
              console.error("解析完成事件失败:", err);
            }
          }
        }
      );

      // 流式结束
      setIsStreaming(false);

      if (assistantMessage) {
        // 移除流式标志
        const finalAssistantMessage = { ...assistantMessage as ChatMessage, isStreaming: false };

        // 更新会话记录
        setSessions(prev => prev.map(session => {
          if (session.id === sessionId) {
            const newMessages = [...session.messages, userMessage, finalAssistantMessage, ...streamMessages];
            return {
              ...session,
              messages: newMessages,
              messageCount: newMessages.length,
              lastMessage: content,
            };
          }
          return session;
        }));
      }

    } catch (err) {
      setIsStreaming(false);
      setError(err instanceof Error ? err.message : "流式消息失败");

      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `错误: ${err instanceof Error ? err.message : "流式消息失败"}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  }, [ensureSessionId]);

  // 上传文件
  const uploadFile = useCallback(async (file: File) => {
    try {
      setError(null);

      // 显示上传状态
      const uploadMessage: ChatMessage = {
        id: `upload-${Date.now()}`,
        role: "system",
        content: `正在上传文件: ${file.name}`,
        timestamp: new Date(),
        metadata: {
          files: [{
            name: file.name,
            size: file.size,
            type: file.type,
          }],
        },
      };

      setMessages(prev => [...prev, uploadMessage]);

      // 实际上传
      const response = await uploadKnowledgeDocument(file);

      // 更新消息
      const successMessage: ChatMessage = {
        id: `upload-success-${Date.now()}`,
        role: "system",
        content: `文件上传成功: ${response.data.fileName}`,
        timestamp: new Date(),
        metadata: {
          files: [{
            name: response.data.fileName,
            size: file.size, // KnowledgeDocument没有size字段，使用原始文件大小
            type: response.data.contentType || file.type,
          }],
        },
      };

      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0 && newMessages[lastIndex].id === uploadMessage.id) {
          newMessages[lastIndex] = successMessage;
        }
        return newMessages;
      });

      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "文件上传失败");

      // 错误消息
      const errorMessage: ChatMessage = {
        id: `upload-error-${Date.now()}`,
        role: "system",
        content: `文件上传失败: ${file.name}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      throw err;
    }
  }, []);

  // 添加消息到当前会话
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);

    // 也更新会话中的消息列表
    if (currentSessionId) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          const newMessages = [...session.messages, message];
          return {
            ...session,
            messages: newMessages,
            messageCount: newMessages.length,
            lastMessage: message.role === "user" ? message.content : session.lastMessage,
          };
        }
        return session;
      }));
    }
  }, [currentSessionId]);

  // 删除对话
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      return remaining;
    });

    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      currentRunId.current = null;
    }
  }, [currentSessionId]);

  // 加载现有会话（模拟初始数据）
  const loadInitialSessions = useCallback(async () => {
    // 这里可以添加从API加载现有会话的逻辑
    // 暂时创建一个示例会话
    const exampleSession: ChatSession = {
      id: "example-session",
      title: "示例对话",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: "chat",
      messages: [],
      messageCount: 0,
    } as ChatSession;

    setSessions([exampleSession]);
    setCurrentSessionId(exampleSession.id);
  }, []);

  return {
    // 状态
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isStreaming,
    error,

    // 操作
    sendMessage: sendMessageStream, // 默认使用流式
    sendMessageDirect: sendMessage, // 直接模式
    startNewSession,
    switchSession,
    deleteSession,
    uploadFile,
    loadInitialSessions,
    addMessage,

    // 工具函数
    createUserMessage,
    eventToMessage,
  };
}
