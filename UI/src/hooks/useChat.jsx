import { useState, useCallback, useRef } from 'react';
import { sendChatMessage } from '@/services/chatService';
import { MESSAGE_TYPES } from '@/config/constants';
import { generateId } from '@/utils/helpers';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'cae_chat_messages';

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Restore Date objects
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(msgs) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch { /* quota errors are non-fatal */ }
}

export function useChat() {
  const [messages, setMessages] = useState(() => loadMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Stable conversation ID for the lifetime of this hook instance (one per chat session)
  const conversationIdRef = useRef(generateId());

  // Always-current ref for messages — avoids stale closure in useCallback
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return;

    const userMessage = {
      id: generateId(),
      type: MESSAGE_TYPES.USER,
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Build lightweight user context to personalise responses
    const userContext = user
      ? { name: user.name, role: user.role, email: user.email }
      : null;

    // Pass last 10 assistant/user messages as history so the server
    // doesn't need in-memory state (survives restarts)
    const chatHistory = messagesRef.current
      .filter(m => m.type === MESSAGE_TYPES.USER || m.type === 'ai')
      .slice(-10)
      .map(m => ({
        role: m.type === MESSAGE_TYPES.USER ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : String(m.content),
      }));

    try {
      const aiMessage = await sendChatMessage(
        content,
        false,
        conversationIdRef.current,
        userContext,
        chatHistory
      );
      setMessages(prev => [...prev, aiMessage]);
      saveMessages([...messagesRef.current, aiMessage]);
    } catch (err) {
      setError(err.message);
      
      const errorMessage = {
        id: generateId(),
        type: MESSAGE_TYPES.SYSTEM,
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
    setError(null);
    // New conversation ID when chat is cleared
    conversationIdRef.current = generateId();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
