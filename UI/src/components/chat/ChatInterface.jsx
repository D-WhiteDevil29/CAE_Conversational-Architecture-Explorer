import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, List, Mic, MicOff, Download, ImagePlus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { QuickSuggestions } from './QuickSuggestions';
import { TypingIndicator } from './TypingIndicator';
import { useChat } from '@/contexts/ChatContext';
import { useToast } from '@/contexts/ToastContext';
import { parseMarkdown } from '@/utils/helpers';
import { QUICK_SUGGESTIONS } from '@/config/constants';

export function ChatInterface() {
  const toast = useToast();
  const [inputValue, setInputValue] = useState('');
  const [wantPointwise, setWantPointwise] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const { messages, isLoading, sendMessage, sendImageMessage } = useChat();

  const [attachedImage, setAttachedImage] = useState(null); // File | null
  const [imagePreview, setImagePreview] = useState(null);   // data-URL | null
  const imageInputRef = useRef(null);

  const handleImageAttach = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only PNG and JPG images are supported.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image must be under 20 MB.');
      return;
    }
    setAttachedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearAttachedImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
  };

  // Auto-scroll to bottom when messages change or on mount
  useEffect(() => {
    if (scrollRef.current) {
      // ScrollArea uses Radix UI which has a viewport element
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  // Scroll to bottom on component mount (page reload)
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };
    
    // Small delay to ensure messages are rendered
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInputValue(transcript);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const handleSend = async () => {
    if ((!inputValue.trim() && !attachedImage) || isLoading) return;

    if (attachedImage) {
      const prompt = inputValue.trim();
      setInputValue('');
      clearAttachedImage();
      await sendImageMessage(prompt, attachedImage);
      inputRef.current?.focus();
      return;
    }

    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message, wantPointwise);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  const exportToPDF = () => {
    if (messages.length === 0) {
      toast.error('No messages to export.');
      return;
    }

    try {
      const date = new Date().toLocaleString();
      const rows = messages.map(m => {
        const role = m.role === 'user' ? 'You' : 'Assistant';
        const isUser = m.role === 'user';
        // Use parseMarkdown for assistant messages so all formatting is preserved;
        // escape then parse for user messages (plain text, but keep line breaks)
        const content = isUser
          ? (m.content || '')
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/\n/g, '<br/>')
          : parseMarkdown(m.content || '');
        return `<div style="margin:14px 0;padding:14px 18px;border-radius:8px;border-left:3px solid ${isUser ? '#7c3aed' : '#0891b2'};background:${isUser ? '#f5f3ff' : '#f0f9ff'}">
          <div style="font-weight:bold;font-size:12px;color:${isUser ? '#7c3aed' : '#0891b2'};margin-bottom:6px">${role}</div>
          <div style="font-size:13px;line-height:1.7;color:#1e293b">${content}</div>
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CAE Chat Export</title>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; color: #1e293b; padding: 32px; max-width: 780px; margin: auto; }
          h2 { color: #7c3aed; margin-bottom: 4px; }
          .meta { color: #64748b; font-size: 11px; margin-bottom: 20px; }
          hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
          pre { white-space: pre-wrap; word-wrap: break-word; background:#1e293b; color:#e2e8f0; padding:10px; border-radius:4px; overflow:auto; font-size:12px; }
          code { background:#f1f5f9; padding:1px 4px; border-radius:3px; font-size:12px; }
          pre code { background: none; padding: 0; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
          th { background: #f8fafc; font-weight: 600; }
          h1,h2,h3,h4 { margin: 12px 0 4px; color: #0f172a; }
          ul, ol { padding-left: 20px; margin: 6px 0; }
          li { margin: 3px 0; }
          strong { font-weight: 600; }
          em { font-style: italic; }
          blockquote { border-left: 3px solid #94a3b8; margin: 8px 0; padding-left: 12px; color: #475569; }
          hr.md-hr { border-top: 1px solid #e2e8f0; }
          @media print {
            body { padding: 16px; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head><body>
        <h2>CAE Assistant — Chat Export</h2>
        <p class="meta">Exported: ${date} &nbsp;|&nbsp; ${messages.length} messages</p>
        <hr/>
        ${rows}
      </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.addEventListener('load', () => {
        win.focus();
        win.print();
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    }
  };

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error(
        'Please use Chrome, Edge, or Safari for voice input.',
        {
          title: 'Speech Recognition Not Supported',
          duration: 5000,
        }
      );
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background to-purple-950/10">
      {/* Chat Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-b border-border/40 glass-effect"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-purple-500/30 rounded-full blur-md"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-full">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">AI Architecture Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask about Kenan, ECOM, ESOM architecture</p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={exportToPDF}
              title="Export chat"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <motion.div
            className="h-2 w-2 bg-green-500 rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        </div>
      </motion.div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0 p-0" ref={scrollRef}>
        <div className="space-y-4 max-w-4xl mx-auto px-2 pb-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full min-h-[400px] text-center"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="mb-8"
              >
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-3xl opacity-30"
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 90, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                    }}
                  />
                  <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-full">
                    <Sparkles className="h-12 w-12 text-white" />
                  </div>
                </div>
              </motion.div>

              <h3 className="text-2xl font-bold gradient-text mb-2">
                Welcome to CAE
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Your intelligent guide to Singtel's architecture ecosystem. Ask me anything about services, dependencies, deployments, and more.
              </p>

              <QuickSuggestions
                suggestions={QUICK_SUGGESTIONS}
                onSelect={handleSuggestionClick}
              />
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => {
                let questionText = '';
                if (message.type !== 'user') {
                  for (let i = index - 1; i >= 0; i--) {
                    if (messages[i].type === 'user') {
                      questionText = messages[i].content;
                      break;
                    }
                  }
                }
                
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    index={index}
                    question={questionText}
                  />
                );
              })}
            </AnimatePresence>
          )}

          {isLoading && <TypingIndicator />}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-t border-border/40 glass-effect"
      >
        <div className="max-w-4xl mx-auto">
          {/* Image preview strip — shown above input when an image is attached */}
          {attachedImage && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-3 p-2 rounded-lg border border-border/40 bg-secondary/30"
            >
              <img
                src={imagePreview}
                alt="attached"
                className="w-12 h-10 object-cover rounded-md border border-border/40 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{attachedImage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(attachedImage.size / 1024).toFixed(1)} KB — Qwen2.5-VL will analyze this image
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-red-400"
                onClick={clearAttachedImage}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* Pointwise Option */}
          <div className="flex items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="pointwise"
                checked={wantPointwise}
                onCheckedChange={setWantPointwise}
                className="border-purple-500/50 data-[state=checked]:bg-purple-500"
              />
              <label 
                htmlFor="pointwise" 
                className="text-sm text-muted-foreground cursor-pointer flex items-center gap-2 select-none"
              >
                <List className="h-4 w-4" />
                Get response in pointwise format
              </label>
            </div>
            
            {/* Voice Input Status */}
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-red-500"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-red-500 rounded-full"
                />
                <span className="text-xs font-medium">Listening...</span>
              </motion.div>
            )}
          </div>
          
          <div className="flex gap-2">
            {/* Hidden image file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleImageAttach}
            />

            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about architecture, dependencies, deployments..."
                className="pr-24 h-12 bg-secondary/50 border-border/40 focus:border-primary transition-all"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {inputValue && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-muted-foreground"
                  >
                    {inputValue.length}
                  </motion.span>
                )}
                {/* Attach image button */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 ${
                    attachedImage
                      ? 'text-purple-500'
                      : 'text-muted-foreground hover:text-purple-500'
                  }`}
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach architecture diagram"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 ${
                    isListening
                      ? 'text-red-500 animate-pulse'
                      : 'text-muted-foreground hover:text-purple-500'
                  }`}
                  onClick={toggleVoiceInput}
                  disabled={isLoading}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !attachedImage) || isLoading}
              size="lg"
              className="h-12 px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI-powered assistant for Singtel architecture exploration
            {recognition && (
              <span className="ml-2 text-purple-500">• Voice input enabled</span>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
