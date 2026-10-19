import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Search,
  Hash,
  RefreshCw,
  Eye,
  Clock,
  BarChart3,
  AlertCircle,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

export function TrendingSearches() {
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('24h'); // '24h', '7d', '30d', 'all'
  const [privacyNote, setPrivacyNote] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadTrendingSearches();
  }, [timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadTrendingSearches();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, timeRange]);

  const loadTrendingSearches = async () => {
    setIsLoading(true);
    setError('');

    try {
      const allSessions = [];
      const storageKeys = Object.keys(localStorage);
      const sessionKeys = storageKeys.filter(key => key.startsWith('cae_sessions_'));
      
      sessionKeys.forEach(key => {
        try {
          const sessionsData = localStorage.getItem(key);
          if (sessionsData) {
            const sessions = JSON.parse(sessionsData);
            if (Array.isArray(sessions)) {
              allSessions.push(...sessions);
            }
          }
        } catch (err) {
          console.error(`Error parsing ${key}:`, err);
        }
      });
      
      console.log(`Found ${allSessions.length} sessions in localStorage`);
      
      if (allSessions.length > 0) {
        await api.post('/api/trending-searches/process', { sessions: allSessions });
      }
      
      const response = await api.get(`/api/trending-searches?range=${timeRange}`);
      setTrending(response.data.searches || []);
      setPrivacyNote(response.data.privacyNote || '');
      console.log('Trending searches updated:', response.data.searches?.length || 0, 'entities');
    } catch (err) {
      console.error('Error loading trending searches:', err);
      setError(err.response?.data?.error || 'Failed to load trending searches');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCount = (count) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count;
  };

  const getTimeRangeLabel = (range) => {
    const labels = {
      '24h': 'Last 24 Hours',
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      'all': 'All Time',
    };
    return labels[range] || range;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Trending Entities & Topics
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Most searched architecture terms and entities
            </p>
            {privacyNote && (
              <p className="text-xs text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
                <span>🔒</span> {privacyNote}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-effect border border-border/40">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <label htmlFor="auto-refresh" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                Auto-refresh (30s)
              </label>
            </div>
            
            <Button
              onClick={loadTrendingSearches}
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-500 flex items-start gap-2"
        >
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-2">
          {['24h', '7d', '30d', 'all'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(range)}
              className={
                timeRange === range
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : ''
              }
            >
              {getTimeRangeLabel(range)}
            </Button>
          ))}
        </div>
      </div>

      {/* Trending List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect border border-border/40 rounded-xl overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 animate-pulse text-purple-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading trending entities...</p>
            </div>
          </div>
        ) : trending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Database className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No entity data found</p>
            <p className="text-xs mt-2">Start chatting to see trending architecture terms appear here</p>
            <p className="text-xs text-purple-500 mt-1">Data is extracted live from your localStorage chat sessions</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {trending.map((item, index) => {
              const maxCount = trending[0].count;
              const percentage = (item.count / maxCount) * 100;

              return (
                <motion.div
                  key={item.query}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-accent/5 transition-colors relative overflow-hidden"
                >
                  {/* Background Bar */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="absolute inset-y-0 left-0 bg-purple-500/5"
                  />

                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 font-bold text-sm shrink-0">
                        {index + 1}
                      </div>

                      {/* Query */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                          <p className="font-medium truncate">{item.query}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            {formatCount(item.count)} mentions
                          </div>
                          {item.lastSearched && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(item.lastSearched).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Count Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCount(item.count)}</p>
                        <p className="text-xs text-muted-foreground">mentions</p>
                      </div>
                      <Hash className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
