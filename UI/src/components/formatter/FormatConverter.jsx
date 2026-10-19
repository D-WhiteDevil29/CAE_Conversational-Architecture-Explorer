import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Download,
  ChevronDown,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import axios from 'axios';

const FormatConverter = () => {
  const formats = ['json', 'yaml', 'xml', 'toml', 'csv', 'markdown'];

  const [sourceFormat, setSourceFormat] = useState('json');
  const [targetFormat, setTargetFormat] = useState('yaml');
  const [rawData, setRawData] = useState('');
  const [converted, setConverted] = useState('');
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [conversionHistory, setConversionHistory] = useState([]);
  const sourceRef = useRef(null);
  const targetRef = useRef(null);

  const handleConvert = async () => {
    if (!rawData.trim()) {
      setNotification('Please provide data to convert');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/api/convert', {
        rawData,
        fromFormat: sourceFormat,
        toFormat: targetFormat,
      });

      if (response.data.success) {
        const result = response.data.data;
        setConverted(result.converted || '');
        setIssues(result.issues || []);
        setNotification('✓ Conversion successful!');

        // Add to history
        setConversionHistory([
          {
            id: Date.now(),
            from: sourceFormat,
            to: targetFormat,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...conversionHistory.slice(0, 9),
        ]);
      } else {
        setNotification(`Error: ${response.data.data.error}`);
        setConverted('');
        setIssues(response.data.data.issues || []);
      }
    } catch (error) {
      setNotification(`Error: ${error.response?.data?.error || error.message}`);
      setConverted('');
    } finally {
      setIsLoading(false);
    }
  };

  const swapFormats = () => {
    if (converted && sourceFormat !== targetFormat) {
      setSourceFormat(targetFormat);
      setTargetFormat(sourceFormat);
      setRawData(converted);
      setConverted('');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setNotification('Copied to clipboard!');
  };

  const downloadFile = () => {
    const element = document.createElement('a');
    const file = new Blob([converted], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `converted.${targetFormat}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setNotification('File downloaded!');
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Format Converter
          </h1>
          <p className="text-slate-400 text-center text-sm">
            Convert between JSON, YAML, XML, TOML, CSV, and Markdown formats
          </p>
        </div>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 bg-emerald-900/50 border border-emerald-500 text-emerald-200 rounded-lg text-sm"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Source Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-slate-700 bg-slate-750">
              <label className="text-white text-sm font-semibold mb-3 block">
                Source Format
              </label>
              <select
                value={sourceFormat}
                onChange={(e) => setSourceFormat(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm hover:border-slate-500 focus:border-blue-500 focus:outline-none"
              >
                {formats.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              ref={sourceRef}
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="Paste your data here..."
              className="flex-1 p-4 bg-slate-900 text-white text-sm font-mono resize-none focus:outline-none border-none"
              style={{ minHeight: '400px' }}
            />

            <div className="p-3 bg-slate-750 border-t border-slate-700 text-xs text-slate-400">
              {rawData.length} characters
            </div>
          </motion.div>

          {/* Swap Button & Target Panel */}
          <div className="flex flex-col">
            {/* Swap Button */}
            <motion.button
              onClick={swapFormats}
              className="mb-4 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowRightLeft size={16} />
              Swap & Reverse
            </motion.button>

            {/* Target Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col flex-1"
            >
              <div className="p-4 border-b border-slate-700 bg-slate-750">
                <label className="text-white text-sm font-semibold mb-3 block">
                  Target Format
                </label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm hover:border-slate-500 focus:border-blue-500 focus:outline-none"
                >
                  {formats.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 p-4 bg-slate-900 overflow-auto">
                {converted ? (
                  <pre className="text-green-300 text-sm font-mono whitespace-pre-wrap break-words">
                    {converted}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    Converted output will appear here
                  </div>
                )}
              </div>

              {/* Actions */}
              {converted && (
                <div className="p-3 bg-slate-750 border-t border-slate-700 flex gap-2">
                  <button
                    onClick={() => copyToClipboard(converted)}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                  <button
                    onClick={downloadFile}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Convert Button */}
        <motion.button
          onClick={handleConvert}
          disabled={isLoading || !rawData.trim()}
          className="w-full mb-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Converting...
            </>
          ) : (
            <>
              <ArrowRightLeft size={18} />
              Convert to {targetFormat.toUpperCase()}
            </>
          )}
        </motion.button>

        {/* Issues Panel */}
        {issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6"
          >
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              {issues.some((i) => i.severity === 'error') ? (
                <AlertCircle size={18} className="text-red-400" />
              ) : (
                <AlertTriangle size={18} className="text-yellow-400" />
              )}
              Issues Found
            </h3>
            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded ${
                    issue.severity === 'error'
                      ? 'bg-red-900/30 text-red-300 border border-red-700/50'
                      : 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50'
                  }`}
                >
                  <div className="font-mono">
                    {issue.line && `Line ${issue.line}: `}
                    {issue.message}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* History */}
        {conversionHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 rounded-lg border border-slate-700 p-4"
          >
            <h3 className="text-white font-semibold mb-3">Recent Conversions</h3>
            <div className="space-y-2">
              {conversionHistory.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSourceFormat(item.from);
                    setTargetFormat(item.to);
                  }}
                  className="w-full text-left p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors text-sm text-slate-300"
                >
                  <span className="font-mono">
                    {item.from.toUpperCase()} → {item.to.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 float-right">
                    {item.timestamp}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FormatConverter;
