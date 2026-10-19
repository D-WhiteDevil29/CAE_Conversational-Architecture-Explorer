import { motion } from 'framer-motion';
import { X, Moon, Sun, Bell, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme.jsx';

export function SettingsPanel({ onClose }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-background/95 backdrop-blur-xl border-border">
          <CardHeader className="border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <CardTitle>Settings</CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {/* Appearance */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Appearance
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={theme === 'dark' ? 'outline' : 'ghost'} 
                  className="justify-start bg-secondary/50"
                  onClick={theme === 'light' ? toggleTheme : undefined}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark Mode
                  {theme === 'dark' && <Badge variant="success" className="ml-auto">Active</Badge>}
                </Button>
                <Button 
                  variant={theme === 'light' ? 'outline' : 'ghost'} 
                  className="justify-start bg-secondary/50"
                  onClick={theme === 'dark' ? toggleTheme : undefined}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light Mode
                  {theme === 'light' && <Badge variant="success" className="ml-auto">Active</Badge>}
                </Button>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm">Deployment alerts</span>
                  <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm">System updates</span>
                  <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Connected Data Sources
              </h3>
              <div className="space-y-2">
                {['Jira', 'Confluence', 'Bamboo', 'Git'].map((source) => (
                  <div key={source} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-sm font-medium">{source}</span>
                    <Badge variant="success">Connected</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm">Enable animations</span>
                  <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm">Auto-refresh data</span>
                  <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
