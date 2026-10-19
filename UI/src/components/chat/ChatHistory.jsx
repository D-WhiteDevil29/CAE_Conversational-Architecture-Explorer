import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, MessageSquare, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';

export function ChatHistory({ isOpen, onClose }) {
  const { sessions, currentSessionId, loadSession, deleteSession, createNewSession } = useChat();

  if (!isOpen) return null;

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const groupSessionsByDate = (sessions) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: [],
    };

    sessions.forEach(session => {
      const sessionDate = new Date(session.updatedAt);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === today.getTime()) {
        groups.today.push(session);
      } else if (sessionDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(session);
      } else if (sessionDate >= lastWeek) {
        groups.lastWeek.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  };

  const grouped = groupSessionsByDate(sortedSessions);

  const handleSessionClick = (sessionId) => {
    loadSession(sessionId);
    onClose();
  };

  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation();
    if (confirm('Delete this chat session?')) {
      deleteSession(sessionId);
    }
  };

  const renderSessionGroup = (title, sessions) => {
    if (sessions.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 px-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        </div>
        <div className="space-y-2">
          {sessions.map((session, index) => (
            <motion.button
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group ${
                session.id === currentSessionId
                  ? 'bg-purple-500/20 border border-purple-500/50'
                  : 'bg-secondary/30 hover:bg-accent'
              }`}
            >
              <MessageSquare className={`h-4 w-4 mt-0.5 shrink-0 ${
                session.id === currentSessionId
                  ? 'text-purple-500'
                  : 'text-muted-foreground group-hover:text-purple-500'
              } transition-colors`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{session.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {session.messages.length} messages · {new Date(session.updatedAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => handleDeleteSession(e, session.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-background/95 backdrop-blur-xl border border-border rounded-xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-semibold">Chat History</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    createNewSession();
                    onClose();
                  }}
                  className="text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
                >
                  New Chat
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Sessions List */}
            <div className="p-4 max-h-[70vh] overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {sortedSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No chat history yet</p>
                  <p className="text-xs mt-2">Start a conversation to see your history here</p>
                </div>
              ) : (
                <>
                  {renderSessionGroup('Today', grouped.today)}
                  {renderSessionGroup('Yesterday', grouped.yesterday)}
                  {renderSessionGroup('Last 7 Days', grouped.lastWeek)}
                  {renderSessionGroup('Older', grouped.older)}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
