import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Clock, TrendingUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/contexts/ChatContext';

export function SearchModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches] = useState([
    'Kenan architecture',
    'ECOM deployment status',
    'Payment service dependencies',
    'API gateway configuration',
  ]);
  const inputRef = useRef(null);
  const { sendMessage, messages } = useChat();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = (query) => {
    if (query.trim()) {
      sendMessage(query);
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    }
  };

  if (!isOpen) return null;

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
            {/* Search Input */}
            <div className="p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search architecture, services, deployments..."
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-lg"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Search Results / Suggestions */}
            <div className="p-4 max-h-[70vh] overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {/* Recent Searches */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Recent Searches</h3>
                </div>
                <div className="space-y-2">
                  {recentSearches.map((search, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSearch(search)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-accent transition-colors text-left group"
                    >
                      <Search className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                      <span className="text-sm">{search}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Recent Messages */}
              {messages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Recent Conversations</h3>
                  </div>
                  <div className="space-y-2">
                    {messages
                      .filter(m => m.type === 'user')
                      .slice(-5)
                      .reverse()
                      .map((message, index) => (
                        <motion.button
                          key={message.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleSearch(message.content)}
                          className="w-full flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-accent transition-colors text-left group"
                        >
                          <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-2">{message.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(message.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
