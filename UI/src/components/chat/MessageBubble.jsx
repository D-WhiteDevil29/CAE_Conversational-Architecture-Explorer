import { motion } from 'framer-motion';
import { User, Bot, Star, StarOff, FileText, List, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MESSAGE_TYPES } from '@/config/constants';
import { formatRelativeTime, parseMarkdown } from '@/utils/helpers';
import { useState, forwardRef, useRef, useEffect } from 'react';
import { useFavorites } from '@/contexts/FavoritesContext';
import api from '@/services/api';

export const MessageBubble = forwardRef(function MessageBubble({ message, index, question }, ref) {
  const [copied, setCopied] = useState(false);
  const [isPointwise, setIsPointwise] = useState(false);
  const [pointwiseContent, setPointwiseContent] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const contentRef = useRef(null);
  const { toggleFavorite, isFavorited } = useFavorites();
  const isUser = message.type === MESSAGE_TYPES.USER;
  const isFav = !isUser && isFavorited(message.id);

  // Wire up copy buttons inside rendered markdown code blocks
  useEffect(() => {
    if (!contentRef.current) return;
    const buttons = contentRef.current.querySelectorAll('.md-copy-btn');
    const handlers = [];
    buttons.forEach(btn => {
      const handler = async () => {
        // Find the <pre> inside the same .md-code-wrapper as this button
        const wrapper = btn.closest('.md-code-wrapper');
        const pre = wrapper ? wrapper.querySelector('.md-pre') : null;
        const text = pre ? (pre.textContent || '') : '';
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add('copied');
          const label = btn.querySelector('.md-copy-label');
          if (label) label.textContent = 'Copied!';
          setTimeout(() => {
            btn.classList.remove('copied');
            if (label) label.textContent = 'Copy';
          }, 2000);
        } catch {
          // clipboard API not available — fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          const label = btn.querySelector('.md-copy-label');
          if (label) { label.textContent = 'Copied!'; setTimeout(() => { label.textContent = 'Copy'; }, 2000); }
        }
      };
      btn.addEventListener('click', handler);
      handlers.push({ btn, handler });
    });
    return () => handlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
  }, [message.content, isPointwise, pointwiseContent]);

  const handleCopy = async () => {
    const textToCopy = isPointwise ? pointwiseContent : message.content;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConvertToPointwise = async () => {
    if (isPointwise) {
      setIsPointwise(false);
      return;
    }

    if (pointwiseContent) {
      setIsPointwise(true);
      return;
    }

    setIsConverting(true);
    try {
      const response = await api.post('/api/format-pointwise', {
        text: message.content,
      });
      setPointwiseContent(response.data.formatted);
      setIsPointwise(true);
    } catch (error) {
      console.error('Error converting to pointwise:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleToggleFavorite = () => {
    toggleFavorite({
      id: message.id,
      question: question || '',
      answer: message.content,
      sources: message.metadata?.sources || [],
    });
  };

  const messageVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: index * 0.05,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.05 + 0.1 }}
          className="flex-shrink-0"
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-purple-500/30 rounded-full blur-md"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-full">
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>
        </motion.div>
      )}

      <div className={`flex flex-col gap-2 min-w-0 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message Content */}
        <motion.div
          whileHover={{}}
          className={`relative w-full min-w-0 overflow-hidden px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'glass-effect border border-border/40'
          }`}
        >
          {/* Attached image preview for user messages */}
          {isUser && message.imagePreview && (
            <div className="mb-2">
              <img
                src={message.imagePreview}
                alt={message.imageName || 'attached image'}
                className="rounded-lg max-w-xs max-h-48 object-cover border border-white/20"
              />
              {message.imageName && (
                <p className="text-xs mt-1 text-white/70 truncate max-w-xs">{message.imageName}</p>
              )}
            </div>
          )}
          {!isUser && message.metadata?.sources && message.metadata.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {message.metadata.sources.map((source, i) => {
                const sourceLabel = typeof source === 'string' 
                  ? source 
                  : (source.title || source.source || 'Unknown');
                const isWebSource = source.type === 'web';
                
                return (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className={`text-xs ${
                      isWebSource 
                        ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400' 
                        : 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isWebSource && '🌐 '}
                    {sourceLabel}
                  </Badge>
                );
              })}
              {message.metadata.usedWebSearch && (
                <Badge variant="outline" className="text-xs border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
                   Enhanced with Web Search
                </Badge>
              )}
            </div>
          )}

          <div
            ref={contentRef}
            className="prose prose-sm prose-invert max-w-full w-full overflow-hidden break-words"
            dangerouslySetInnerHTML={{ 
              __html: parseMarkdown(isPointwise ? pointwiseContent : message.content) 
            }}
          />

          {/* Action Buttons */}
          {!isUser && (
            <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/30">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs rounded-md hover:bg-accent flex items-center gap-1.5"
                onClick={handleToggleFavorite}
                title={isFav ? "Remove from favorites" : "Save to favorites"}
              >
                {isFav ? (
                  <>
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <StarOff className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs rounded-md hover:bg-accent flex items-center gap-1.5"
                onClick={handleConvertToPointwise}
                disabled={isConverting}
                title={isPointwise ? "Show original" : "Show as bullet points"}
              >
                {isPointwise ? (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span>Original</span>
                  </>
                ) : (
                  <>
                    <List className="h-3.5 w-3.5" />
                    <span>Points</span>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs rounded-md hover:bg-accent flex items-center gap-1.5"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Metadata */}
<div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span>{formatRelativeTime(message.timestamp)}</span>
          {isPointwise && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                Bullet Points
              </Badge>
            </>
          )}
          {message.metadata?.confidence && (
            <>
              <span>•</span>
              <span>
                Confidence: {(message.metadata.confidence * 100).toFixed(0)}%
              </span>
            </>
          )}
        </div>
      </div>

      {isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.05 + 0.1 }}
          className="flex-shrink-0"
        >
          <div className="bg-secondary p-2 rounded-full">
            <User className="h-5 w-5" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});
