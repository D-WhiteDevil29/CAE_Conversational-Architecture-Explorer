import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Send, Copy, Download, Play, AlertCircle, CheckCircle, Eye, EyeOff, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/ToastContext';
import axios from 'axios';

export function SQLWorkbench() {
  const [description, setDescription] = useState('');
  const [databaseType, setDatabaseType] = useState('oracle');
  const [complexity, setComplexity] = useState('simple');
  const [schemaContext, setSchemaContext] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [validation, setValidation] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [queryHistory, setQueryHistory] = useState([]);
  const { error, success, info } = useToast();
  const descriptionRef = useRef(null);
  const outputRef = useRef(null);

  // Helper function to show toast messages
  const showToast = (type, message) => {
    if (type === 'error') error(message);
    else if (type === 'success') success(message);
    else if (type === 'info') info(message);
    else success(message); // default to success
  };

  const generateSQL = async () => {
    if (!description.trim()) {
      showToast('error', 'Please enter a query description');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/generate-sql', {
        description,
        databaseType,
        schemaContext,
        complexity,
      }, {
        timeout: 120000, // 2 minutes for model inference
      });

      const { data } = response.data;
      setGeneratedSQL(data.query);
      setExplanation(data.explanation);
      setValidation(data.validation);
      setRiskLevel(data.riskLevel);
      setWarnings(data.warnings);

      // Add to history
      setQueryHistory(prev => [{
        id: Date.now(),
        description,
        databaseType,
        complexity,
        query: data.query,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 10));

      showToast('success', 'SQL query generated successfully');
      
      // Scroll to output
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('SQL generation error:', error);
      const message = error.response?.data?.details || 'Failed to generate SQL query';
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedSQL) return;
    navigator.clipboard.writeText(generatedSQL);
    showToast('success', 'SQL copied to clipboard');
  };

  const downloadSQL = () => {
    if (!generatedSQL) return;
    const element = document.createElement('a');
    const file = new Blob([generatedSQL], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `query_${Date.now()}.sql`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('success', 'SQL downloaded');
  };

  const loadFromHistory = (item) => {
    setDescription(item.description);
    setGeneratedSQL(item.query);
    showToast('info', 'Loaded from history');
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBgColor = () => {
    switch (riskLevel) {
      case 'low': return 'bg-green-50 border-green-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'critical': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getWarningMessage = (warning) => {
    const messages = {
      nested_select: 'Query contains nested SELECT - consider optimization',
      select_wildcard: 'Using SELECT * - consider specifying columns for better performance',
      verify_indexes: 'Verify indexes on WHERE clause columns for optimal performance',
      consider_limit: 'Consider adding LIMIT to SELECT queries to prevent excessive data retrieval',
    };
    return messages[warning] || warning;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-sm">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">SQL Query Generator</h2>
        <p className="text-xs text-muted-foreground ml-auto">Powered by AI - Generates optimized SQL queries</p>
      </div>

      <div className="flex-1 overflow-hidden flex gap-2 p-3">
        {/* Left Panel - Input */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-96 flex flex-col gap-3 overflow-y-auto border border-border/40 rounded-lg p-4 bg-background/40"
        >
          {/* Database Type Selection */}
          <div>
            <label className="block text-xs font-medium mb-2">Database Type</label>
            <select
              value={databaseType}
              onChange={(e) => setDatabaseType(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-border/40 rounded-md bg-background hover:border-border disabled:opacity-50"
            >
              <option value="oracle">Oracle (PL/SQL)</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          {/* Complexity Selection */}
          <div>
            <label className="block text-xs font-medium mb-2">Query Complexity</label>
            <div className="grid grid-cols-3 gap-2">
              {['simple', 'intermediate', 'complex'].map((level) => (
                <button
                  key={level}
                  onClick={() => setComplexity(level)}
                  disabled={isLoading}
                  className={`px-3 py-2 text-xs rounded-md font-medium transition-all ${
                    complexity === level
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/40 hover:border-border disabled:opacity-50'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Query Description */}
          <div>
            <label className="block text-xs font-medium mb-2">Query Description</label>
            <p className="text-xs text-muted-foreground mb-2">Describe what SQL query you need in natural language</p>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Find all journal keys where ID_TYPE=4 and ELEMENT_ID=57042 and status is active"
              disabled={isLoading}
              className="w-full h-32 px-3 py-2 text-sm border border-border/40 rounded-md bg-background/60 focus:outline-none focus:border-primary disabled:opacity-50 resize-none"
            />
          </div>

          {/* Schema Context */}
          <div>
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="flex items-center gap-2 text-xs font-medium mb-2 hover:text-primary transition-colors"
            >
              {showSchema ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Schema Context (Optional)
            </button>
            {showSchema && (
              <textarea
                value={schemaContext}
                onChange={(e) => setSchemaContext(e.target.value)}
                placeholder="Provide table and column definitions to improve accuracy...&#10;&#10;Example:&#10;TABLE JNL_KEYS: JNL_CODE_ID, ID_TYPE, ID_VALUE, ELEMENT_ID, PROVIDER_ID, INACTIVE_DATE&#10;TABLE JNL_CUSTOM: JNL_CODE_ID, PIC_PRODUCT_OWNER"
                disabled={isLoading}
                className="w-full h-24 px-3 py-2 text-xs border border-border/40 rounded-md bg-background/60 focus:outline-none focus:border-primary disabled:opacity-50 resize-none"
              />
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateSQL}
            disabled={isLoading || !description.trim()}
            className="w-full gap-2"
          >
            <Play className="h-4 w-4" />
            {isLoading ? 'Generating...' : 'Generate SQL'}
          </Button>

          {/* Query History */}
          {queryHistory.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-2">Recent Queries</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {queryHistory.map((item) => (
                  <motion.button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    whileHover={{ x: 2 }}
                    className="w-full text-left p-2 rounded-md border border-border/40 hover:border-primary hover:bg-primary/5 transition-all truncate text-xs"
                    title={item.description}
                  >
                    <div className="truncate font-medium">{item.description.substring(0, 40)}...</div>
                    <div className="text-xs text-muted-foreground">{item.databaseType} • {item.timestamp}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Panel - Output */}
        <motion.div
          ref={outputRef}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col gap-3 overflow-hidden"
        >
          {/* Generated SQL Display */}
          <div className="flex-1 flex flex-col border border-border/40 rounded-lg overflow-hidden bg-background/40">
            {/* SQL Editor Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background/60">
              <h3 className="text-sm font-semibold">Generated SQL Query</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!generatedSQL}
                  className="h-7 px-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadSQL}
                  disabled={!generatedSQL}
                  className="h-7 px-2"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* SQL Code Display */}
            <motion.pre
              initial={generatedSQL ? { opacity: 0, y: 10 } : {}}
              animate={generatedSQL ? { opacity: 1, y: 0 } : {}}
              className="flex-1 overflow-auto p-4 font-mono text-sm bg-black/10 text-foreground whitespace-pre-wrap break-words"
            >
              {isLoading && (
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex flex-col items-center justify-center h-full gap-3"
                >
                  <Loader className="h-8 w-8 text-primary animate-spin" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Generating SQL query...</p>
                    <p className="text-xs mt-1">This may take a moment while the model processes your request.</p>
                  </div>
                </motion.div>
              )}
              {!isLoading && generatedSQL && <code>{generatedSQL}</code>}
              {!isLoading && !generatedSQL && (
                <div className="text-muted-foreground text-center py-8">
                  Generate a SQL query to see the result here
                </div>
              )}
            </motion.pre>
          </div>

          {/* Explanation, Validation & Risk Level */}
          <AnimatePresence>
            {generatedSQL && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-2"
              >
                {/* Explanation */}
                {explanation && (
                  <motion.div className="p-3 rounded-lg border border-border/40 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                      <span className="font-semibold">Explanation: </span>
                      {explanation}
                    </p>
                  </motion.div>
                )}

                {/* Risk Level & Validation */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Risk Level */}
                  {riskLevel && (
                    <motion.div
                      className={`p-3 rounded-lg border ${getRiskBgColor()}`}
                    >
                      <div className={`flex items-center gap-2 font-semibold text-sm ${getRiskColor()}`}>
                        <AlertCircle className="h-4 w-4" />
                        Risk: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                      </div>
                    </motion.div>
                  )}

                  {/* Validation Status */}
                  {validation && (
                    <motion.div
                      className={`p-3 rounded-lg border ${
                        validation.isValid
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-2 font-semibold text-sm ${
                          validation.isValid ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'
                        }`}
                      >
                        {validation.isValid ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {validation.isValid ? 'Query Valid' : 'Issues Found'}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Validation Issues */}
                {validation && validation.issues.length > 0 && (
                  <motion.div className="p-3 rounded-lg border border-border/40 bg-background/60">
                    <h4 className="text-xs font-semibold mb-2">Validation Issues:</h4>
                    <ul className="space-y-1">
                      {validation.issues.map((issue, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                          <span>•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <motion.div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
                    <h4 className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Performance Notes:</h4>
                    <ul className="space-y-1">
                      {warnings.map((warning, idx) => (
                        <li key={idx} className="text-xs text-yellow-800 dark:text-yellow-300 flex gap-2">
                          <span>•</span>
                          <span>{getWarningMessage(warning)}</span>
                        </li>
                      ))}
                    </ul>
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
