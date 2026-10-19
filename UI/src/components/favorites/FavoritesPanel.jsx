import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFavorites } from '@/contexts/FavoritesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseMarkdown } from '@/utils/helpers';

export function FavoritesPanel() {
  const { favorites, removeFavorite, isOpen, closePanel } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFavorites = favorites.filter(fav => {
    const query = searchQuery.toLowerCase();
    return (
      fav.question.toLowerCase().includes(query) ||
      fav.answer.toLowerCase().includes(query)
    );
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closePanel}
      >
        <motion.div
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold gradient-text">Favorite Responses</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {favorites.length} saved {favorites.length === 1 ? 'response' : 'responses'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={closePanel}
                className="text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>

            {/* Search */}
            <Input
              placeholder="Search favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Content */}
          <div className="h-[calc(100vh-180px)] w-full overflow-y-auto overflow-x-hidden">
            {filteredFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-6xl mb-4">⭐</div>
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery ? 'No matching favorites' : 'No favorites yet'}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Save your favorite responses by clicking the "Save" button on AI messages'}
                </p>
              </div>
            ) : (
              <div className="p-4 w-full overflow-hidden box-border space-y-4">
                {filteredFavorites.map((favorite) => (
                  <motion.div
                    key={favorite.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors overflow-hidden w-full min-w-0"
                  >
                    {/* Question */}
                    {favorite.question && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                          Question
                        </div>
                        <p className="text-sm font-medium">{favorite.question}</p>
                      </div>
                    )}

                    {/* Answer Preview */}
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                        Answer
                      </div>
                      <div
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-full w-full overflow-hidden break-words line-clamp-6 [&_.md-code-wrapper]:max-w-full [&_.md-pre]:overflow-x-auto [&_.md-table-wrap]:overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(favorite.answer) }}
                      />
                    </div>

                    {/* Sources */}
                    {favorite.sources && favorite.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {favorite.sources.map((source, idx) => {
                          // Handle both string and object sources
                          const sourceLabel = typeof source === 'string' 
                            ? source 
                            : (source.title || source.source || 'Unknown');
                          
                          return (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-500"
                            >
                              {sourceLabel}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Meta & Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(favorite.timestamp)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(favorite.answer)}
                          className="text-xs"
                        >
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFavorite(favorite.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
