import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { sendChatMessage, analyzeImageMessage } from '@/services/chatService';
import { MESSAGE_TYPES } from '@/config/constants';
import { generateId } from '@/utils/helpers';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

const SESSION_EXPIRY = 21 * 24 * 60 * 60 * 1000; // 3 weeks

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `cae_sessions_${user.id}` : 'cae_sessions_guest';
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    setSessionsLoaded(false);
    
    const storageKey = getStorageKey();
    const storedSessions = localStorage.getItem(storageKey);
    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions);
        const now = Date.now();
        
        const validSessions = parsed.filter(s => s.expiresAt > now);
        
        setSessions(validSessions);
        
        if (validSessions.length > 0) {
          const latest = validSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages || []);
        } else {
          const newSession = {
            id: generateId(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + SESSION_EXPIRY,
          };
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
          setMessages([]);
        }
        setSessionsLoaded(true);
      } catch (err) {
        console.error('Error loading sessions:', err);
        const newSession = {
          id: generateId(),
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + SESSION_EXPIRY,
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
        setMessages([]);
        setSessionsLoaded(true);
      }
    } else {
      const newSession = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + SESSION_EXPIRY,
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setSessionsLoaded(true);
    }
  }, [user, getStorageKey]);

  useEffect(() => {
    if (user && sessionsLoaded) {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(sessions));
      console.log(`Saved ${sessions.length} sessions to localStorage`);
    }
  }, [sessions, user, sessionsLoaded, getStorageKey]);

  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      updateSessionMessages(currentSessionId, messages);
    }
  }, [messages, currentSessionId]);

  const createNewSession = useCallback(() => {
    const newSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_EXPIRY,
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    
    return newSession;
  }, []);

  const loadSession = useCallback((sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages || []);
      
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, updatedAt: Date.now() }
          : s
      ));
    }
  }, [sessions]);

  const deleteSession = useCallback((sessionId) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      
      if (sessionId === currentSessionId) {
        if (filtered.length > 0) {
          const latest = filtered.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages || []);
        } else {
          createNewSession();
        }
      }
      
      return filtered;
    });
  }, [currentSessionId, createNewSession]);

  const updateSessionMessages = useCallback((sessionId, newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        let title = s.title;
        if (title === 'New Chat' && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.type === MESSAGE_TYPES.USER);
          if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
          }
        }
        
        return {
          ...s,
          messages: newMessages,
          title,
          updatedAt: Date.now(),
        };
      }
      return s;
    }));
  }, []);

  const renameSession = useCallback((sessionId, newTitle) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, title: newTitle, updatedAt: Date.now() }
        : s
    ));
  }, []);

  const sendMessage = useCallback(async (content, wantPointwise = false) => {
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

    try {
      const aiMessage = await sendChatMessage(content, wantPointwise);
      console.log('Received AI message:', {
        hasGraph: !!aiMessage.metadata?.graph,
        graphNodes: aiMessage.metadata?.graph?.nodes?.length || 0,
        graphEdges: aiMessage.metadata?.graph?.edges?.length || 0,
        pointwise: wantPointwise,
      });
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(' Chat error:', err);
      setError(err.message);
      
      let errorContent = 'Sorry, I encountered an error processing your request.';
      
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorContent = '**Request Timeout**\n\nThe AI model is taking longer than expected to respond. This is normal for:\n- First query after server start (model loading)\n- Complex architecture questions\n- Large context searches\n\nPlease try again. Subsequent queries will be faster.';
      } else if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
        errorContent = '**Backend Not Available**\n\nPlease ensure:\n1. Backend server is running (`cd Model && npm run dev`)\n2. Ollama is running (`ollama serve`)\n3. Data has been ingested (`npm run ingest`)\n\nOr enable mock mode in Settings.';
      } else if (err.response?.status === 503) {
        errorContent = '**Model Not Ready**\n\nThe AI model is still initializing. Please wait a moment and try again.';
      }
      
      const errorMessage = {
        id: generateId(),
        type: MESSAGE_TYPES.SYSTEM,
        content: errorContent,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendImageMessage = useCallback(async (content, imageFile) => {
    const prompt = content.trim() || 'Describe this architecture diagram in detail.';

    // Read the image as a data URL so it can be shown in the chat bubble
    const imagePreview = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(imageFile);
    });

    const userMessage = {
      id: generateId(),
      type: MESSAGE_TYPES.USER,
      content: prompt,
      imagePreview,
      imageName: imageFile.name,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const aiMessage = await analyzeImageMessage(prompt, imageFile);
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Image analysis error:', err);
      setError(err.message);
      const errorMessage = {
        id: generateId(),
        type: MESSAGE_TYPES.SYSTEM,
        content: 'Sorry, image analysis failed. Please ensure the backend is running and llama.cpp is built.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);



  const clearMessages = useCallback(() => {
    if (currentSessionId) {
      updateSessionMessages(currentSessionId, []);
      setMessages([]);
    }
    setError(null);
  }, [currentSessionId, updateSessionMessages]);

  return (
    <ChatContext.Provider value={{
      messages,
      isLoading,
      error,
      sendMessage,
      sendImageMessage,
      clearMessages,
      sessions,
      currentSessionId,
      createNewSession,
      loadSession,
      deleteSession,
      renameSession,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
