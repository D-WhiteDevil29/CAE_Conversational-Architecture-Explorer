import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  MoreVertical,
  Edit2,
  Check,
  X,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/contexts/ChatContext';
import { formatRelativeTime } from '@/utils/helpers';

export function SessionSidebar({ isOpen, onClose }) {
  const {
    sessions,
    currentSessionId,
    createNewSession,
    loadSession,
    deleteSession,
    renameSession,
  } = useChat();

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const buttonRefs = useRef({});

  const handleRename = (sessionId) => {
    if (editValue.trim()) {
      renameSession(sessionId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const startEdit = (session) => {
    setEditingId(session.id);
    setEditValue(session.title);
    setMenuOpenId(null);
  };

  const handleDelete = (sessionId) => {
    if (confirm('Delete this chat session?')) {
      deleteSession(sessionId);
      setMenuOpenId(null);
    }
  };

  const handleMenuToggle = (sessionId, event) => {
    if (menuOpenId === sessionId) {
      setMenuOpenId(null);
    } else {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 144, // 144px = w-36
      });
      setMenuOpenId(sessionId);
    }
  };

  const handleNewSession = () => {
    createNewSession();
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  };

  // Close menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpenId && !e.target.closest('[data-menu]') && !e.target.closest('button')) {
        setMenuOpenId(null);
      }
    };

    const handleScroll = () => {
      if (menuOpenId) {
        setMenuOpenId(null);
      }
    };

    if (menuOpenId) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpenId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-background/95 backdrop-blur-xl border-r border-border z-40 flex flex-col lg:block"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Chat Sessions</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewSession}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                onClick={handleNewSession}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>

            {/* Sessions List */}
            <ScrollArea className="flex-1">
              <div className="p-0 mb-20 space-y-1 overflow-visible">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No sessions yet
                  </div>
                ) : (
                  sessions
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((session, index) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative overflow-visible"
                      >
                        {editingId === session.id ? (
                          // Edit Mode
                          <div className="flex items-center gap-1 p-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(session.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRename(session.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          // Normal Mode
                          <div
                            className={`group relative flex items-center gap-1.5 p-2.5 pr-2 rounded-lg cursor-pointer transition-colors overflow-visible ${
                              currentSessionId === session.id
                                ? 'bg-accent'
                                : 'hover:bg-accent/50'
                            }`}
                            onClick={() => {
                              loadSession(session.id);
                              if (window.innerWidth < 1024) {
                                onClose?.();
                              }
                            }}
                          >
                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-sm font-medium truncate">
                                {(() => {
                                  const words = session.title.split(' ');
                                  return words.length > 4
                                    ? words.slice(0, 4).join(' ') + ' ...'
                                    : session.title;
                                })()}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{formatRelativeTime(session.updatedAt)}</span>
                                <span className="flex-shrink-0">•</span>
                                <span className="flex-shrink-0">{session.messages.length}msg</span>
                              </div>
                            </div>

                            <div className="relative flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMenuToggle(session.id, e);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                )}
              </div>
            </ScrollArea>

            {/* Dropdown Menu - Rendered outside ScrollArea to avoid clipping */}
            <AnimatePresence>
              {menuOpenId && (
                <motion.div
                  data-menu
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    position: 'fixed',
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                  className="w-36 bg-popover border border-border rounded-lg overflow-hidden shadow-xl z-[200]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      const session = sessions.find(s => s.id === menuOpenId);
                      if (session) startEdit(session);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <Edit2 className="h-4 w-4" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(menuOpenId)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-secondary/30 text-xs text-muted-foreground">
              <p>Sessions auto-delete after 3 weeks</p>
              <p className="mt-1">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
