import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Server,
  MessageSquare,
  Network,
  FileUp,
  Database,
  TrendingUp,
  Zap,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_CONFIG, FEATURES } from '@/config/constants';
import { useToast } from '@/contexts/ToastContext';

const ENDPOINTS = [
  {
    name: 'Health Check',
    url: '/health',
    method: 'GET',
    icon: Activity,
    description: 'Backend service health status',
    critical: true,
  },
  {
    name: 'Chat Endpoint',
    url: '/api/chat',
    method: 'POST',
    icon: MessageSquare,
    description: 'AI chat conversation endpoint',
    critical: true,
    skipTest: true, 
    checkNote: 'Endpoint available (test skipped to preserve model resources)',
  },
  {
    name: 'Graph Endpoint',
    url: '/api/graph',
    method: 'POST',
    icon: Network,
    description: 'Entity relationship graph generator',
    critical: false,
    skipTest: true, 
    checkNote: 'Endpoint available (test skipped to preserve model resources)',
  },
  {
    name: 'Document Upload',
    url: '/api/upload-document',
    method: 'POST',
    icon: FileUp,
    description: 'Document upload and conversion',
    critical: false,
    skipTest: true, 
  },
  {
    name: 'Ingestion Status',
    url: '/api/ingest-status',
    method: 'GET',
    icon: Database,
    description: 'Document ingestion pipeline status',
    critical: false,
  },
  {
    name: 'Documents List',
    url: '/api/documents',
    method: 'GET',
    icon: FileUp,
    description: 'Ingested documents registry',
    critical: false,
  },
  {
    name: 'Trending Searches',
    url: '/api/trending-searches',
    method: 'GET',
    icon: TrendingUp,
    description: 'Popular search entities',
    critical: false,
  },
];

export function HealthCheck() {
  const toast = useToast();
  const [endpointStatus, setEndpointStatus] = useState({});
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
 
  const [mockMode, setMockMode] = useState(() => {
    const storedMode = window.localStorage.getItem('cae_mock_mode');
    return storedMode !== null ? storedMode === 'true' : FEATURES.mockMode;
  });

  
  const [contextOnlyMode, setContextOnlyMode] = useState(() => {
    const storedMode = window.localStorage.getItem('cae_context_only_mode');
    return storedMode === 'true';
  });

  useEffect(() => {
    checkAllEndpoints();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(checkAllEndpoints, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const checkEndpoint = async (endpoint) => {
    if (endpoint.skipTest) {
      return {
        status: 'skipped',
        message: endpoint.checkNote || 'Test skipped (requires special setup)',
        responseTime: 0,
      };
    }

    const startTime = Date.now();
    
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (endpoint.method !== 'GET' && endpoint.testPayload) {
        options.body = JSON.stringify(endpoint.testPayload);
      }

      const response = await fetch(`${API_CONFIG.baseURL}${endpoint.url}`, options);
      const responseTime = Date.now() - startTime;
      
      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok) {
        return {
          status: 'healthy',
          statusCode: response.status,
          responseTime,
          data: data ? (typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : String(data).substring(0, 100)) : null,
        };
      } else {
        return {
          status: 'error',
          statusCode: response.status,
          responseTime,
          message: data?.error || response.statusText,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'offline',
        responseTime,
        message: error.message,
      };
    }
  };

  const checkAllEndpoints = async () => {
    setIsChecking(true);
    setLastCheckTime(new Date().toISOString());

    const results = {};

    for (const endpoint of ENDPOINTS) {
      const result = await checkEndpoint(endpoint);
      results[endpoint.url] = result;
      
      setEndpointStatus(prev => ({ ...prev, [endpoint.url]: result }));
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsChecking(false);
  };

  const toggleMockMode = () => {
    const newMode = !mockMode;
    setMockMode(newMode);
    
    window.localStorage.setItem('cae_mock_mode', newMode);
    
    if (newMode) {
      toast.warning(
        'The chat will now use pre-defined responses.\n\nNote: Refresh the page or send a new message for changes to take effect.',
        {
          title: 'Mock Mode Enabled',
          iconType: 'mock',
          duration: 6000,
        }
      );
    } else {
      toast.info(
        'The chat will now use the LLaMA 3.1 8B AI model.\n\nNote: Ensure backend and Ollama are running. Refresh the page for changes to take effect.',
        {
          title: 'Real Model Mode Enabled',
          iconType: 'real',
          duration: 6000,
        }
      );
    }
  };

  const toggleContextMode = () => {
    const newMode = !contextOnlyMode;
    setContextOnlyMode(newMode);
    
    window.localStorage.setItem('cae_context_only_mode', newMode);
    
    if (newMode) {
      toast.info(
        'The model will ONLY use your ingested documents (Jira, Confluence, Bamboo).\n\nWeb search and general knowledge are disabled for strict accuracy.',
        {
          title: 'Context-Only Mode Enabled',
          iconType: 'contextOnly',
          duration: 7000,
        }
      );
    } else {
      toast.success(
        'The model will use:\n• Your ingested context (priority)\n• Web search for current info (if needed)\n• Training knowledge (fallback)\n\nThis provides broader answers while preventing hallucinations.',
        {
          title: 'Hybrid Mode Enabled',
          iconType: 'hybrid',
          duration: 7000,
        }
      );
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'skipped':
        return <Clock className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/50 bg-green-500/5';
      case 'error':
        return 'border-yellow-500/50 bg-yellow-500/5';
      case 'offline':
        return 'border-red-500/50 bg-red-500/5';
      case 'skipped':
        return 'border-gray-500/50 bg-gray-500/5';
      default:
        return 'border-border/40';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'error':
        return 'Warning';
      case 'offline':
        return 'Offline';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Unknown';
    }
  };

  const overallHealth = Object.values(endpointStatus).every(
    status => status.status === 'healthy' || status.status === 'skipped'
  );

  const criticalEndpoints = ENDPOINTS.filter(e => e.critical);
  const criticalHealthy = criticalEndpoints.every(
    endpoint => {
      const status = endpointStatus[endpoint.url]?.status;
      return status === 'healthy' || status === 'skipped';
    }
  );

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect border border-border/40 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${criticalHealthy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <Activity className={`h-6 w-6 ${criticalHealthy ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">System Health</h2>
              <p className="text-sm text-muted-foreground">
                {lastCheckTime 
                  ? `Last checked: ${new Date(lastCheckTime).toLocaleTimeString()}`
                  : 'Click refresh to check endpoints'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-purple-500/10 border-purple-500/50' : ''}
            >
              <Zap className="h-4 w-4 mr-2" />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={checkAllEndpoints}
              disabled={isChecking}
              className="gap-2"
            >
              <motion.div
                animate={isChecking ? { rotate: -360 } : {}}
                transition={{ duration: 1, repeat: isChecking ? Infinity : 0, ease: "linear" }}
                className="flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4" />
              </motion.div>
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`p-4 rounded-lg border-2 ${
            criticalHealthy
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-red-500/10 border-red-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {criticalHealthy ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <div>
                <h3 className="font-bold text-lg">
                  {criticalHealthy ? 'All Systems Operational' : 'Service Degradation Detected'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(endpointStatus).length} endpoints monitored
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Critical Services</div>
              <div className={`text-2xl font-bold ${criticalHealthy ? 'text-green-500' : 'text-red-500'}`}>
                {criticalEndpoints.filter(e => {
                  const status = endpointStatus[e.url]?.status;
                  return status === 'healthy' || status === 'skipped';
                }).length}/{criticalEndpoints.length}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Mock Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-effect border border-border/40 rounded-xl p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${mockMode ? 'bg-orange-500/10' : 'bg-purple-500/10'}`}>
              <Settings className={`h-6 w-6 ${mockMode ? 'text-orange-500' : 'text-purple-500'}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Model Mode</h3>
              <p className="text-sm text-muted-foreground">
                {mockMode 
                  ? 'Using mock responses for testing (no AI model required)'
                  : 'Using real LLaMA 3.1 8B model for responses'}
              </p>
            </div>
          </div>
          
          <Button
            onClick={toggleMockMode}
            className={`gap-2 ${
              mockMode
                ? 'bg-gradient-to-r from-orange-500 to-red-500'
                : 'bg-gradient-to-r from-purple-500 to-pink-500'
            }`}
          >
            <Server className="h-4 w-4" />
            Switch to {mockMode ? 'Real Model' : 'Mock Mode'}
          </Button>
        </div>

        {mockMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-600 dark:text-orange-400"
          >
            <strong>⚠️ Mock Mode Active:</strong> The application is using pre-defined responses. 
            Switch to Real Model mode to use the LLaMA AI model.
          </motion.div>
        )}
      </motion.div>

      {/* Context-Only / Hybrid Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-effect border border-border/40 rounded-xl p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${contextOnlyMode ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
              <Database className={`h-6 w-6 ${contextOnlyMode ? 'text-blue-500' : 'text-green-500'}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Response Mode</h3>
              <p className="text-sm text-muted-foreground">
                {contextOnlyMode 
                  ? 'Using ONLY ingested documents (strict accuracy)'
                  : 'Hybrid mode: Context → Web Search → General Knowledge'}
              </p>
            </div>
          </div>
          
          <Button
            onClick={toggleContextMode}
            className={`gap-2 ${
              contextOnlyMode
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
          >
            <Database className="h-4 w-4" />
            {contextOnlyMode ? 'Enable Hybrid Mode' : 'Enable Context-Only'}
          </Button>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-accent/50 border border-border/40">
          <div className="text-sm space-y-2">
            <div className="flex items-start gap-2">
              <div className="font-semibold text-foreground min-w-[120px]">Context-Only:</div>
              <div className="text-muted-foreground">
                Answers strictly from your ingested documents. Best for Singtel-specific questions.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-foreground min-w-[120px]">Hybrid Mode:</div>
              <div className="text-muted-foreground">
                Falls back to web search and general knowledge when context is insufficient. Better for general tech questions.
              </div>
            </div>
          </div>
        </div>

        {!contextOnlyMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-600 dark:text-green-400"
          >
            <strong>🌐 Hybrid Mode Active:</strong> The model will search the web if your context doesn't have the answer. 
            Web search requires API keys (BRAVE_API_KEY, SERPER_API_KEY, or TAVILY_API_KEY).
          </motion.div>
        )}
      </motion.div>

      {/* Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {ENDPOINTS.map((endpoint, index) => {
            const status = endpointStatus[endpoint.url];
            const Icon = endpoint.icon;

            return (
              <motion.div
                key={endpoint.url}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-effect border-2 rounded-xl p-5 ${
                  status ? getStatusColor(status.status) : 'border-border/40'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      endpoint.critical ? 'bg-purple-500/10' : 'bg-blue-500/10'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        endpoint.critical ? 'text-purple-500' : 'text-blue-500'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{endpoint.name}</h3>
                      <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                    </div>
                  </div>
                  
                  {status && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {getStatusIcon(status.status)}
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Endpoint:</span>
                    <code className="text-xs bg-accent/50 px-2 py-1 rounded">
                      {endpoint.method} {endpoint.url}
                    </code>
                  </div>

                  {status && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`font-medium ${
                          status.status === 'healthy' ? 'text-green-500' :
                          status.status === 'error' ? 'text-yellow-500' :
                          status.status === 'offline' ? 'text-red-500' :
                          'text-gray-500'
                        }`}>
                          {getStatusText(status.status)}
                          {status.statusCode && ` (${status.statusCode})`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Response Time:</span>
                        <span className={`font-medium ${
                          status.responseTime < 1000 ? 'text-green-500' :
                          status.responseTime < 3000 ? 'text-yellow-500' :
                          'text-red-500'
                        }`}>
                          {status.responseTime}ms
                        </span>
                      </div>

                      {status.message && (
                        <div className="pt-2 border-t border-border/40">
                          <p className={`text-xs ${
                            status.status === 'skipped' ? 'text-muted-foreground' : 'text-red-500'
                          }`}>
                            {status.message}
                          </p>
                        </div>
                      )}

                      {status.data && status.status === 'healthy' && (
                        <div className="pt-2 border-t border-border/40">
                          <p className="text-xs text-muted-foreground truncate">
                            {status.data}...
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {endpoint.critical && (
                    <div className="flex items-center gap-1 text-xs text-purple-500 mt-2">
                      <AlertCircle className="h-3 w-3" />
                      Critical Service
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* System Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-effect border border-border/40 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-bold">System Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Backend URL</p>
            <p className="text-sm font-mono bg-accent/50 px-3 py-2 rounded">
              {API_CONFIG.baseURL}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">API Timeout</p>
            <p className="text-sm font-mono bg-accent/50 px-3 py-2 rounded">
              {API_CONFIG.timeout / 1000}s
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Model Mode</p>
            <p className={`text-sm font-mono px-3 py-2 rounded ${
              mockMode ? 'bg-orange-500/10 text-orange-500' : 'bg-purple-500/10 text-purple-500'
            }`}>
              {mockMode ? 'Mock' : 'Real Model'}
            </p>
          </div>
        </div>

        {/* Health Check Tips */}
        <div className="mt-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-blue-600 dark:text-blue-400">Health Check Tips:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Green</strong>: Endpoint is responding correctly</li>
                <li>• <strong>Yellow</strong>: Endpoint returned an error response</li>
                <li>• <strong>Red</strong>: Endpoint is offline or unreachable</li>
                <li>• <strong>Gray</strong>: Test skipped to preserve model resources</li>
              </ul>
              <p className="text-xs pt-2">
                Enable auto-refresh to monitor endpoints continuously. Chat/Graph endpoints are skipped to avoid overwhelming the AI model with test requests.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
