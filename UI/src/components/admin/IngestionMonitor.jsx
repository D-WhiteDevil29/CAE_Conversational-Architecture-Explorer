import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Terminal,
  Database,
  FileCheck,
  Clock,
  RotateCcw,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useValidation } from '@/contexts/ValidationContext';
import { useToast } from '@/contexts/ToastContext';
import api from '@/services/api';

export function IngestionMonitor({ onIngestionComplete }) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState('');
  const logsEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const { validationQueue, VALIDATION_STATES } = useValidation();
  const toast = useToast();

  useEffect(() => {
    const savedLastRun = localStorage.getItem('last_ingestion_run');
    if (savedLastRun) {
      setLastRun(JSON.parse(savedLastRun));
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        message,
        type,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const runIngestion = async () => {
    // Check for unapproved uploaded documents
    const uploadedDocs = validationQueue.filter(doc => doc.documentSource === 'uploaded');
    const unapprovedDocs = uploadedDocs.filter(
      doc => doc.status !== VALIDATION_STATES.READY_FOR_INGEST
    );

    if (unapprovedDocs.length > 0) {
      const unapprovedCount = unapprovedDocs.length;
      const pendingDetails = unapprovedDocs
        .map(doc => `• ${doc.documentName} (${doc.status})`)
        .join('\n');
      
      toast.error(
        `❌ Cannot ingest: ${unapprovedCount} uploaded document(s) pending validation`
      );
      
      addLog(
        `Ingestion blocked: ${unapprovedCount} document(s) awaiting validation approval`,
        'warning'
      );
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setStats(null);
    setError('');

    addLog('Starting data ingestion process...', 'info');
    const readyDocsCount = uploadedDocs.filter(
      doc => doc.status === VALIDATION_STATES.READY_FOR_INGEST
    ).length;
    if (readyDocsCount > 0) {
      addLog(`Found ${readyDocsCount} validated uploaded document(s) ready for ingestion`, 'success');
    }
    addLog('Reading documents from all sources...', 'info');

    try {
      const response = await api.post('/api/ingest');
      addLog(`${response.data.message}`, 'success');
      addLog('Processing documents... This may take a few moments.', 'info');

      let pollCount = 0;
      const maxPolls = 30; // 30 seconds max (30 * 1000ms)
      let lastStatus = null;
      let completionHandled = false;

      pollIntervalRef.current = setInterval(async () => {
        pollCount++;

        try {
          const statusResponse = await api.get('/api/ingest-status');
          const status = statusResponse.data;

          const statusChanged = JSON.stringify(status) !== JSON.stringify(lastStatus);
          lastStatus = status;

          if (status.isRunning) {
            if (status.currentStage && statusChanged) {
              addLog(`${status.currentStage}`, 'info');
            }
            if (status.progress && status.progress.processed !== undefined && statusChanged) {
              addLog(
                `Progress: ${status.progress.processed}/${status.progress.total} documents processed`,
                'info'
              );
            }
          } else if (status.completed && !completionHandled) {
            completionHandled = true;
            clearInterval(pollIntervalRef.current);
            
            addLog('Ingestion completed successfully!', 'success');
            
            if (status.stats) {
              setStats(status.stats);
              addLog(
                `Total documents ingested: ${status.stats.totalDocuments || 0}`,
                'success'
              );
              if (status.stats.sources && status.stats.sources.length > 0) {
                addLog(
                  `Sources: ${status.stats.sources.join(', ')}`,
                  'info'
                );
              }
            }

            const runInfo = {
              timestamp: new Date().toISOString(),
              stats: status.stats,
              success: true,
            };
            setLastRun(runInfo);
            localStorage.setItem('last_ingestion_run', JSON.stringify(runInfo));

            setIsRunning(false);
            
            if (onIngestionComplete) {
              onIngestionComplete(status.stats);
            }
          } else if (status.error) {
            // Error occurred
            clearInterval(pollIntervalRef.current);
            addLog(`Error: ${status.error}`, 'error');
            setError(status.error);
            setIsRunning(false);
          } else if (pollCount === 1 && !status.isRunning && !status.completed) {
            // If first poll shows nothing running and not completed, ingestion might have finished instantly
            clearInterval(pollIntervalRef.current);
            addLog('Ingestion may have completed very quickly. Check backend logs.', 'warning');
            addLog('Process finished', 'success');
            setIsRunning(false);
          }

          if (pollCount >= maxPolls) {
            clearInterval(pollIntervalRef.current);
            addLog(
              'Polling timeout. Ingestion may still be running. Check backend logs.',
              'warning'
            );
            setIsRunning(false);
          }
        } catch (err) {
          if (pollCount === 1) {
            addLog('Processing documents...', 'info');
          }
          
          if (pollCount >= 10) {
            clearInterval(pollIntervalRef.current);
            addLog('Ingestion process initiated. Check backend logs for details.', 'success');
            setIsRunning(false);
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Ingestion error:', err);
      const errorMsg = err.response?.data?.error || 'Failed to start ingestion';
      addLog(`Error: ${errorMsg}`, 'error');
      setError(errorMsg);
      setIsRunning(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Run Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            Data Ingestion
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ingest uploaded documents into the AI model
          </p>
        </div>

        <Button
          onClick={runIngestion}
          disabled={isRunning || validationQueue.some(doc => doc.documentSource === 'uploaded' && doc.status !== VALIDATION_STATES.READY_FOR_INGEST)}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title={validationQueue.some(doc => doc.documentSource === 'uploaded' && doc.status !== VALIDATION_STATES.READY_FOR_INGEST) ? 'Complete document validation first' : ''}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : validationQueue.some(doc => doc.documentSource === 'uploaded' && doc.status !== VALIDATION_STATES.READY_FOR_INGEST) ? (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Validation Pending
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Ingestion
            </>
          )}
        </Button>
      </div>

      {/* Validation Status */}
      {validationQueue.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass-effect rounded-lg p-4 border ${
            validationQueue.some(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST)
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-green-500/40 bg-green-500/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              validationQueue.some(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST)
                ? 'bg-red-500/10'
                : 'bg-green-500/10'
            }`}>
              {validationQueue.some(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST) ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div className="flex-1 text-sm">
              <h4 className={`font-medium mb-2 ${
                validationQueue.some(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST)
                  ? 'text-red-500'
                  : 'text-green-500'
              }`}>
                Document Validation Status
              </h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-green-500">
                    {validationQueue.filter(d => d.documentSource === 'uploaded' && d.status === VALIDATION_STATES.READY_FOR_INGEST).length}
                  </span>
                  {' '}approved documents ready for ingestion
                </div>
                <div>
                  <span className="font-medium text-red-500">
                    {validationQueue.filter(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST).length}
                  </span>
                  {' '}documents pending review
                </div>
                {validationQueue.some(d => d.documentSource === 'uploaded' && d.status !== VALIDATION_STATES.READY_FOR_INGEST) && (
                  <p className="text-xs text-red-600/60 mt-2 font-medium">
                    ⚠️ Ingestion is blocked until all uploaded documents are approved.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Last Run Info */}
      {lastRun && !isRunning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect border border-green-500/20 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1">Last Successful Run</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {formatDate(lastRun.timestamp)}
                </div>
                {lastRun.stats && (
                  <>
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-3 w-3" />
                      {lastRun.stats.totalDocuments || 0} documents processed
                    </div>
                    {lastRun.stats.sources && lastRun.stats.sources.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Database className="h-3 w-3" />
                        Sources: {lastRun.stats.sources.join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error Display */}
      {error && !isRunning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect border border-red-500/20 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-500 mb-1">Ingestion Failed</h4>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Logs Console */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect border border-border/40 rounded-xl overflow-hidden"
      >
        {/* Console Header */}
        <div className="bg-card/50 border-b border-border/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Console Output</span>
          </div>
          {logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="h-7 text-xs"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Console Body */}
        <div className="bg-slate-950 dark:bg-black/40 p-4 h-[400px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No logs yet. Click "Run Ingestion" to start.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`
                      flex items-start gap-2
                      ${log.type === 'error' ? 'text-red-400' : ''}
                      ${log.type === 'success' ? 'text-green-400' : ''}
                      ${log.type === 'warning' ? 'text-yellow-500' : ''}
                      ${log.type === 'info' ? 'text-blue-400' : ''}
                    `}
                  >
                    <span className="text-gray-400 dark:text-gray-500 opacity-80 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="break-words">{log.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Display */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="glass-effect border border-border/40 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileCheck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Documents Processed</p>
              </div>
            </div>
          </div>

          <div className="glass-effect border border-border/40 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Database className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sources?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Data Sources</p>
              </div>
            </div>
          </div>

          <div className="glass-effect border border-border/40 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.newDocuments !== undefined ? stats.newDocuments : '-'}
                </p>
                <p className="text-xs text-muted-foreground">New Documents</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
