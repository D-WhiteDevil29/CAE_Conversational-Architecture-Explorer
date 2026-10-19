import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Bell, Settings, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ReviewsPanel } from '@/components/profile/ReviewsPanel';

export function UserProfile({ isOpen = true, onClose, initialSection = 'profile' }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState(initialSection);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    onClose?.();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 pt-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-background rounded-lg border border-border max-w-4xl w-full mb-4"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={user?.avatar}
                alt={user?.name}
                className="h-12 w-12 rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold">{user?.name}</h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="border-b border-border flex gap-2 p-3 bg-secondary/30">
          <Button
            variant={activeSection === 'profile' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSection('profile')}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Profile
          </Button>
          <Button
            variant={activeSection === 'reviews' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSection('reviews')}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Document Reviews
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 ml-auto">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[60vh]">
          {activeSection === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-lg font-medium">{user?.name}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg font-medium">{user?.email}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <p className="text-lg font-medium capitalize">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user?.role === 'admin'
                        ? 'bg-purple-500/10 text-purple-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {user?.role}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                  <p className="text-lg font-medium">
                    {new Date(user?.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold mb-4">Account Management</h3>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </motion.div>
          )}

          {activeSection === 'reviews' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ReviewsPanel />
            </motion.div>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
