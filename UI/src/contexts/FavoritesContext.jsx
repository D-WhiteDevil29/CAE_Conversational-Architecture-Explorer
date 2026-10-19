import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { generateId } from '@/utils/helpers';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `cae_favorites_${user.id}` : 'cae_favorites_guest';
  }, [user]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (!user) return;

    const storageKey = getStorageKey();
    const storedFavorites = localStorage.getItem(storageKey);
    
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites);
        setFavorites(parsed);
      } catch (err) {
        console.error('Error loading favorites:', err);
        setFavorites([]);
      }
    }
    setIsLoaded(true);
  }, [user, getStorageKey]);

  // Save favorites to localStorage whenever they change (only after initial load)
  useEffect(() => {
    if (user && isLoaded) {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(favorites));
    }
  }, [favorites, user, isLoaded, getStorageKey]);

  const addFavorite = useCallback((messageData) => {
    const favorite = {
      id: generateId(),
      messageId: messageData.id,
      question: messageData.question || '',
      answer: messageData.answer || '',
      timestamp: Date.now(),
      sessionId: messageData.sessionId,
      sources: messageData.sources || [],
    };

    setFavorites(prev => [favorite, ...prev]);
  }, []);

  const removeFavorite = useCallback((favoriteId) => {
    setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
  }, []);

  const isFavorited = useCallback((messageId) => {
    return favorites.some(fav => fav.messageId === messageId);
  }, [favorites]);

  const toggleFavorite = useCallback((messageData) => {
    const existingFavorite = favorites.find(fav => fav.messageId === messageData.id);
    
    if (existingFavorite) {
      removeFavorite(existingFavorite.id);
    } else {
      addFavorite(messageData);
    }
  }, [favorites, addFavorite, removeFavorite]);

  const clearAllFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      addFavorite,
      removeFavorite,
      isFavorited,
      toggleFavorite,
      clearAllFavorites,
      isOpen,
      openPanel,
      closePanel,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
