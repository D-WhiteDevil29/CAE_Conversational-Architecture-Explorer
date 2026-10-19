import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Loader, AlertCircle, CheckCircle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/ToastContext';
import axios from 'axios';

export function FormatterWorkbench() {
  const [rawData, setRawData] = useState('');
  const [formatType, setFormatType] = useState('json');
  const [formatted, setFormatted] = useState('');
  const [issues, setIssues] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [formatHistory, setFormatHistory] = useState([]);
  const { success, error, info } = useToast();
  const outputRef = useRef(null);

  const formatTypes = ['json', 'yaml', 'xml', 'toml', 'markdown', 'csv'];

  const handleFormat = async () => {
    if (!rawData.trim()) {
      error('Please paste some data to format');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/format-data', {
        rawData,
        formatType,
      }, {
        timeout: 30000,
      });

      const data = response.data.data;
      setFormatted(data.formatted);
      setIssues(data.issues || []);
      setExplanation(data.explanation);

      // Add to history
      setFormatHistory(prev => [{
        id: Date.now(),
        formatType,
        rawDataPreview: rawData.substring(0, 40) + (rawData.length > 40 ? '...' : ''),
        timestamp: new Date().toLocaleTimeString(),
        isValid: data.success,
      }, ...prev].slice(0, 10));

      if (data.success || data.formatted) {
        success(`✓ Formatted ${formatType.toUpperCase()} successfully!`);
      } else {
        info('Format attempted with warnings');
      }

      // Scroll to output
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Format error:', err);
      const message = err.response?.data?.error || err.message || 'Formatting failed';
      error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!formatted) return;
    navigator.clipboard.writeText(formatted);
    success('Formatted data copied to clipboard');
  };

  const downloadFormatted = () => {
    if (!formatted) return;
    const element = document.createElement('a');
    const file = new Blob([formatted], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `formatted_${Date.now()}.${formatType}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    success(`Downloaded as ${formatType} file`);
  };

  const loadFromHistory = (item) => {
    // This would require storing more data, simplified for now
    info(`Loaded: ${item.rawDataPreview}`);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Split Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        
        {/* LEFT PANEL - INPUT (58%) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[58%] flex flex-col gap-3 overflow-hidden"
        >
          
          {/* Format Type Selector */}
          <div className="flex gap-2 flex-wrap">
            {formatTypes.map(type => (
              <motion.button
                key={type}
                onClick={() => setFormatType(type)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  formatType === type
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-border text-muted-foreground hover:bg-border/60'
                }`}
              >
                {type.toUpperCase()}
              </motion.button>
            ))}
          </div>

          {/* Raw Data Input */}
          <div className="flex-1 flex flex-col border border-border/40 rounded-lg overflow-hidden bg-background/40">
            <div className="px-4 py-2 border-b border-border/40 bg-background/60 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Raw Data Input</h3>
              <span className="text-xs text-muted-foreground">
                {rawData.length} characters
              </span>
            </div>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              disabled={isLoading}
              placeholder={getPlaceholder(formatType)}
              className="flex-1 p-4 font-mono text-sm bg-black/10 text-foreground focus:outline-none resize-none disabled:opacity-50"
            />
          </div>

          {/* Format Button */}
          <Button
            onClick={handleFormat}
            disabled={isLoading || !rawData.trim()}
            className="w-full gap-2 h-10"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Formatting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Format {formatType.toUpperCase()}
              </>
            )}
          </Button>

          {/* Format History */}
          {formatHistory.length > 0 && (
            <div className="border border-border/40 rounded-lg p-3 bg-background/40">
              <label className="block text-xs font-medium mb-2">Recent Formats</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {formatHistory.map((item) => (
                  <motion.button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    whileHover={{ x: 2 }}
                    className="w-full text-left p-2 rounded-md border border-border/40 hover:border-primary hover:bg-primary/5 transition-all truncate text-xs"
                    title={item.rawDataPreview}
                  >
                    <div className="flex items-center gap-2">
                      {item.isValid ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-yellow-600" />
                      )}
                      <span className="font-medium truncate">{item.formatType}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{item.timestamp}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* RIGHT PANEL - OUTPUT (42%) */}
        <motion.div 
          ref={outputRef}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[42%] flex flex-col gap-3 overflow-hidden"
        >
          
          {/* Formatted Output */}
          <div className="flex-1 flex flex-col border border-border/40 rounded-lg overflow-hidden bg-background/40">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background/60">
              <h3 className="text-xs font-semibold">Formatted Output</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExplanation(!showExplanation)}
                  disabled={!explanation}
                  className="h-7 px-2"
                >
                  {showExplanation ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!formatted}
                  className="h-7 px-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadFormatted}
                  disabled={!formatted}
                  className="h-7 px-2"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Output Display */}
            <motion.div
              className="flex-1 overflow-auto p-4 bg-black/10"
            >
              {isLoading ? (
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex flex-col items-center justify-center h-full gap-3"
                >
                  <Loader className="h-8 w-8 text-primary animate-spin" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Formatting your data...</p>
                    <p className="text-xs mt-1">Validating and applying proper formatting.</p>
                  </div>
                </motion.div>
              ) : formatted ? (
                <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                  <code>{formatted}</code>
                </pre>
              ) : (
                <div className="text-muted-foreground text-center py-8 flex items-center justify-center h-full">
                  Formatted output will appear here
                </div>
              )}
            </motion.div>
          </div>

          {/* Issues & Explanation */}
          <AnimatePresence>
            {(issues.length > 0 || explanation) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-2"
              >
                {/* Issues */}
                {issues.length > 0 && (
                  <motion.div className={`p-3 rounded-lg border ${getSeverityBg(issues[0]?.severity || 'error')}`}>
                    <h4 className={`text-xs font-semibold ${getSeverityColor(issues[0]?.severity || 'error')} mb-2`}>
                      Found {issues.length} issue{issues.length !== 1 ? 's' : ''}:
                    </h4>
                    <ul className="space-y-1">
                      {issues.slice(0, 5).map((issue, idx) => (
                        <li key={idx} className={`text-xs ${getSeverityColor(issue.severity)} font-mono`}>
                          <span className="font-semibold">Line {issue.line}</span>
                          {issue.column && <span>, Col {issue.column}</span>}
                          <span className="ml-2">{issue.message}</span>
                        </li>
                      ))}
                      {issues.length > 5 && (
                        <li className={`text-xs ${getSeverityColor('warning')} font-mono`}>
                          ... and {issues.length - 5} more issue{issues.length - 5 !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </motion.div>
                )}

                {/* Explanation */}
                {explanation && showExplanation && (
                  <motion.div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                      {explanation}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function getPlaceholder(formatType) {
  const placeholders = {
    json: `{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}`,
    yaml: `name: John\nage: 30\ncity: New York`,
    xml: `<person>\n  <name>John</name>\n  <age>30</age>\n</person>`,
    toml: `[person]\nname = "John"\nage = 30`,
    markdown: `# Heading\n\nThis is a paragraph.\n\n- Item 1\n- Item 2`,
    csv: `name,age,city\nJohn,30,New York\nJane,28,Boston`,
  };
  return `Paste your ${formatType.toUpperCase()} here...\n\nExample:\n${placeholders[formatType]}`;
}
