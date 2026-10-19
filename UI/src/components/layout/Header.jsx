import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Settings, Menu, X, MessageSquareText, LogOut, Shield, User, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useValidation } from '@/contexts/ValidationContext';
import { UserProfile } from '@/components/profile/UserProfile';

export function Header({ onSearchToggle, onSettingsToggle, onSessionToggle, onNavigateToAdmin }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileInitialSection, setProfileInitialSection] = useState('profile');
  const { user, logout, isAdmin } = useAuth();
  const { favorites, openPanel } = useFavorites();
  const { validationQueue } = useValidation();

  // Count pending reviews assigned to this user
  const pendingReviewCount = user
    ? validationQueue.filter((item) => {
        const level =
          item.reviewers.r1 === user.email
            ? 'r1'
            : item.reviewers.r2 === user.email
            ? 'r2'
            : item.reviewers.r3 === user.email
            ? 'r3'
            : null;
        if (!level) return false;
        return !item.reviews[level]; // not yet reviewed
      }).length
    : 0;

  const openReviews = () => {
    setProfileInitialSection('reviews');
    setIsProfileOpen(true);
    setShowUserMenu(false);
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 glass-effect"
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSessionToggle}
            className="lg:hidden"
          >
            <MessageSquareText className="h-5 w-5" />
          </Button>

          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg blur-lg opacity-50"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <img
                src="/images/helper.png"
                alt="CAE Logo"
                className="relative h-8 w-8 rounded-lg"
              />
              {/* <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div> */}
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">CAE</h1>
              <p className="text-xs text-muted-foreground">Architecture Explorer</p>
            </div>
            <Badge variant="success" className="hidden md:inline-flex">
              Live
            </Badge>
          </motion.div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1 xl:gap-2">
          {isAdmin && onNavigateToAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToAdmin}
              className="gap-2 text-purple-500 hover:text-purple-600 bg-purple-500/5 hover:bg-purple-500/15 border-purple-500/20"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden xl:inline">Admin</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={openPanel}
            className="gap-2 relative bg-accent/50 hover:bg-accent border-border/60"
            title="Favorites"
          >
            <span>Favorites</span>
            {favorites.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 text-xs bg-purple-500 text-white">
                {favorites.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSettingsToggle}
            className="gap-2 bg-accent/50 hover:bg-accent border-border/60"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden xl:inline">Settings</span>
          </Button>

          <div className="h-8 w-px bg-border mx-1 xl:mx-2" />

          {/* Review Notifications Bell */}
          {pendingReviewCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={openReviews}
              className="gap-2 relative bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-500"
              title={`${pendingReviewCount} review(s) pending`}
            >
              <Bell className="h-4 w-4" />
              <span className="hidden xl:inline">Reviews</span>
              <Badge className="px-1.5 py-0 h-5 text-xs bg-yellow-500 text-white">
                {pendingReviewCount}
              </Badge>
            </Button>
          )}

          <div className="h-8 w-px bg-border mx-1 xl:mx-2" />
          <div className="relative ml-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 xl:px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-accent transition-colors"
              title={user?.name}
            >
              <img
                src={user?.avatar}
                alt={user?.name}
                className="h-7 w-7 rounded-full ring-2 ring-purple-500/50"
              />
              <span className="text-sm font-medium hidden lg:inline truncate max-w-[120px]">
                {user?.name}
              </span>
            </motion.button>

            {/* User Menu */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-background/95 backdrop-blur-xl border border-border rounded-lg overflow-hidden shadow-xl z-[100]"
                >
                  <div className="p-3 border-b border-border bg-secondary/30">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileInitialSection('profile');
                      setIsProfileOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <User className="h-4 w-4" />
                    View Profile
                  </button>
                  <button
                    onClick={openReviews}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    My Reviews
                    {pendingReviewCount > 0 && (
                      <span className="ml-auto bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {pendingReviewCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-accent transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/40 md:hidden"
          >
            <div className="container p-4 space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                <img
                  src={user?.avatar}
                  alt={user?.name}
                  className="h-10 w-10 rounded-full ring-2 ring-purple-500/50"
                />
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full justify-start relative bg-accent/50 hover:bg-accent border-border/60" 
                onClick={() => {
                  openPanel();
                  setIsMenuOpen(false);
                }}
              >
                <span className="mr-2">Favorites</span>
                {favorites.length > 0 && (
                  <Badge variant="secondary" className="ml-auto px-2 py-0.5 h-5 text-xs bg-purple-500 text-white">
                    {favorites.length}
                  </Badge>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start bg-accent/50 hover:bg-accent border-border/60" 
                onClick={() => {
                  onSettingsToggle();
                  setIsMenuOpen(false);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start text-red-500 bg-red-500/5 hover:bg-red-500/10 border-red-500/20"
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      {isProfileOpen && (
        <UserProfile
          isOpen={isProfileOpen}
          initialSection={profileInitialSection}
          onClose={() => setIsProfileOpen(false)}
        />
      )}
    </motion.header>
  );
}
