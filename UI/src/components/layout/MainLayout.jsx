// src/components/layout/MainLayout.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { DependencyGraph } from '@/components/graph/DependencyGraph';
import { SearchPanel } from '@/components/search/SearchPanel';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { SessionSidebar } from '@/components/session/SessionSidebar';
import { ArchitectureFlow } from '@/components/architecture/ArchitectureFlow';
import { SQLWorkbench } from '@/components/sql/SQLWorkbench';
import { FormatterWorkbench } from '@/components/formatter/FormatterWorkbench';
import FormatConverter from '@/components/formatter/FormatConverter';

import { MessageSquare, Network, LayoutGrid, Zap, Database, Wrench, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VIEW_MODES } from '@/config/constants';
import { useChat } from '@/contexts/ChatContext';

export function MainLayout({ onNavigateToAdmin }) {
  const [viewMode, setViewMode] = useState(VIEW_MODES.SPLIT);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionOpen, setIsSessionOpen] = useState(true);
  const { messages } = useChat();
  
  const getLatestGraph = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'ai' && messages[i].metadata?.graph) {
        return messages[i].metadata.graph;
      }
    }
    return null;
  };
  
  const latestGraph = getLatestGraph();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        onSearchToggle={() => setIsSearchOpen(!isSearchOpen)}
        onSettingsToggle={() => setIsSettingsOpen(!isSettingsOpen)}
        onSessionToggle={() => setIsSessionOpen(!isSessionOpen)}
        onNavigateToAdmin={onNavigateToAdmin}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Session Sidebar */}
        <SessionSidebar 
          isOpen={isSessionOpen} 
          onClose={() => setIsSessionOpen(false)} 
        />

        {/* Main Content Wrapper */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSessionOpen ? 'lg:ml-64' : 'ml-0'}`}>
          {/* Search & Settings Panels */}
          <AnimatePresence>
            {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}
            {isSettingsOpen && <SettingsPanel onClose={() => setIsSettingsOpen(false)} />}
          </AnimatePresence>

          {/* View Mode Switcher Tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-background/60 backdrop-blur-sm">
            <Button
              variant={viewMode === VIEW_MODES.CHAT ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.CHAT)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.CHAT ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </Button>
            <Button
              variant={viewMode === VIEW_MODES.SPLIT ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.SPLIT)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.SPLIT ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Split</span>
            </Button>
            <Button
              variant={viewMode === VIEW_MODES.GRAPH ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.GRAPH)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.GRAPH ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Graph</span>
            </Button>
            {/* New Architecture Tab */}
            <Button
              variant={viewMode === VIEW_MODES.ARCHITECTURE ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.ARCHITECTURE)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.ARCHITECTURE ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Architecture</span>
            </Button>
            {/* SQL Workbench Tab */}
            <Button
              variant={viewMode === VIEW_MODES.SQL ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.SQL)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.SQL ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>SQL</span>
            </Button>
            {/* Formatter Tab */}
            <Button
              variant={viewMode === VIEW_MODES.FORMATTER ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.FORMATTER)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.FORMATTER ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Formatter</span>
            </Button>
            {/* Converter Tab */}
            <Button
              variant={viewMode === VIEW_MODES.CONVERTER ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(VIEW_MODES.CONVERTER)}
              className={`h-7 px-3 gap-1.5 text-xs ${viewMode === VIEW_MODES.CONVERTER ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Converter</span>
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {viewMode === VIEW_MODES.CHAT && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full"
                >
                  <ChatInterface />
                </motion.div>
              )}

              {viewMode === VIEW_MODES.GRAPH && (
                <motion.div
                  key="graph"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full"
                >
                  <DependencyGraph graphData={latestGraph} />
                </motion.div>
              )}

              {viewMode === VIEW_MODES.SPLIT && (
                <motion.div
                  key="split"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full grid grid-cols-1 lg:grid-cols-[58%_1fr] gap-2 p-2"
                >
                  <motion.div className="h-full overflow-hidden rounded-lg border border-border/40">
                    <ChatInterface />
                  </motion.div>
                  <motion.div className="h-full overflow-hidden rounded-lg border border-border/40">
                    <DependencyGraph graphData={latestGraph} />
                  </motion.div>
                </motion.div>
              )}

              {/* New Architecture View */}
              {viewMode === VIEW_MODES.ARCHITECTURE && (
                <motion.div
                  key="architecture"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full"
                >
                  <ArchitectureFlow />
                </motion.div>
              )}

              {/* SQL Workbench View */}
              {viewMode === VIEW_MODES.SQL && (
                <motion.div
                  key="sql"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full"
                >
                  <SQLWorkbench />
                </motion.div>
              )}

              {/* Formatter View */}
              {viewMode === VIEW_MODES.FORMATTER && (
                <motion.div
                  key="formatter"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full"
                >
                  <FormatterWorkbench />
                </motion.div>
              )}

              {/* Converter View */}
              {viewMode === VIEW_MODES.CONVERTER && (
                <motion.div
                  key="converter"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full"
                >
                  <FormatConverter />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Bar */}
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="border-t border-border/40 glass-effect px-4 py-2"
          >
            <div className="container flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}</span>
                <span>•</span>
                <span>Singtel Architecture Explorer</span>
              </div>
              <div className="flex items-center gap-4">
                <span>All rights reserved by Integration Services Team</span>
                <span>•</span>
                <span>© 2026 Singtel</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}