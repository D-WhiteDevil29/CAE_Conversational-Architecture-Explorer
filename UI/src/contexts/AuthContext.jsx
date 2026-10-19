import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const ADMIN_EMAIL = 'xv.digvijay.shingare@singtel.com';

const STORAGE_KEYS = {
  USER: 'cae_user',
  TOKEN: 'cae_token',
  SESSIONS: 'cae_sessions',
  USERS_DB: 'cae_users_db', 
};


const SESSION_EXPIRY = 21 * 24 * 60 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        
        if (parsedUser.expiresAt && Date.now() < parsedUser.expiresAt) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
      const now = Date.now();
      
      const validSessions = sessions.filter(session => 
        session.expiresAt && session.expiresAt > now
      );
      
      if (validSessions.length !== sessions.length) {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(validSessions));
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(cleanupInterval);
  }, []);

  const login = async (email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
        
        const registeredUser = usersDB.find(u => u.email === email);
        
        if (!registeredUser) {
          reject(new Error('User not found. Please sign up first.'));
          return;
        }
        
        if (registeredUser.password !== password) {
          reject(new Error('Invalid password'));
          return;
        }

        const expiresAt = Date.now() + SESSION_EXPIRY;
        const userData = {
          id: registeredUser.id,
          email: registeredUser.email,
          name: registeredUser.name, 
          role: registeredUser.role || (registeredUser.email === ADMIN_EMAIL ? 'admin' : 'user'),
          avatar: registeredUser.avatar,
          createdAt: registeredUser.createdAt,
          expiresAt,
        };
        
        const token = btoa(`${email}:${Date.now()}`);
        
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        
        setUser(userData);
        resolve(userData);
      }, 1000);
    });
  };

  const signup = async (email, password, name) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password.length >= 6 && name) {
          const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
          if (usersDB.some(u => u.email === email)) {
            reject(new Error('User with this email already exists'));
            return;
          }
          
          const newUser = {
            id: Date.now().toString(),
            email,
            name,
            password,
            role: email === ADMIN_EMAIL ? 'admin' : 'user',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            createdAt: Date.now(),
          };
          
          usersDB.push(newUser);
          localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(usersDB));
          
          resolve({ success: true, email, name });
        } else {
          reject(new Error('Please provide valid credentials'));
        }
      }, 1000);
    });
  };

  const forgotPassword = async (email) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
        const user = usersDB.find(u => u.email === email);
        
        if (!user) {
          reject(new Error('No account found with this email'));
          return;
        }
        
        // Generate a simple reset token (in production, this would be sent via email)
        const resetToken = btoa(`${email}:${Date.now()}`);
        const resetExpiry = Date.now() + (60 * 60 * 1000); // 1 hour expiry
        
        // Store reset token in user object
        const userIndex = usersDB.findIndex(u => u.email === email);
        usersDB[userIndex].resetToken = resetToken;
        usersDB[userIndex].resetTokenExpiry = resetExpiry;
        
        localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(usersDB));
        
        resolve({ 
          success: true, 
          message: 'Password reset link generated',
          token: resetToken // In production, this would be sent via email
        });
      }, 1000);
    });
  };

  const resetPassword = async (email, newPassword, token) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!newPassword || newPassword.length < 6) {
          reject(new Error('Password must be at least 6 characters'));
          return;
        }
        
        const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
        const userIndex = usersDB.findIndex(u => u.email === email);
        
        if (userIndex === -1) {
          reject(new Error('User not found'));
          return;
        }
        
        const user = usersDB[userIndex];
        
        // Verify reset token
        if (!user.resetToken || user.resetToken !== token) {
          reject(new Error('Invalid reset token'));
          return;
        }
        
        if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
          reject(new Error('Reset token has expired'));
          return;
        }
        
        // Update password and clear reset token
        usersDB[userIndex].password = newPassword;
        delete usersDB[userIndex].resetToken;
        delete usersDB[userIndex].resetTokenExpiry;
        
        localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(usersDB));
        
        resolve({ success: true, message: 'Password reset successfully' });
      }, 1000);
    });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    setUser(null);
  };

  const getAllUsers = () => {
    const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
    return usersDB.map(({ password, ...user }) => user);
  };

  const updateUser = async (userId, updates) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
          const userIndex = usersDB.findIndex(u => u.id === userId);
          
          if (userIndex === -1) {
            reject(new Error('User not found'));
            return;
          }
          
          usersDB[userIndex] = {
            ...usersDB[userIndex],
            ...updates,
            id: usersDB[userIndex].id,
            createdAt: usersDB[userIndex].createdAt,
            role: usersDB[userIndex].email === ADMIN_EMAIL ? 'admin' : (updates.role || usersDB[userIndex].role),
          };
          
          localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(usersDB));
          
          if (user && user.id === userId) {
            const updatedUser = { ...user, ...updates };
            setUser(updatedUser);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
          }
          
          resolve(usersDB[userIndex]);
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  };

  const deleteUser = async (userId) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
          const userToDelete = usersDB.find(u => u.id === userId);
          
          if (!userToDelete) {
            reject(new Error('User not found'));
            return;
          }
          
          if (userToDelete.email === ADMIN_EMAIL) {
            reject(new Error('Cannot delete admin user'));
            return;
          }
          
          const filtered = usersDB.filter(u => u.id !== userId);
          localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(filtered));
          
          const userSessionKey = `cae_sessions_${userId}`;
          localStorage.removeItem(userSessionKey);
          
          resolve(true);
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  };

  const getAppStats = () => {
    const usersDB = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
    const allSessions = [];
    
    usersDB.forEach(user => {
      const sessionKey = `cae_sessions_${user.id}`;
      const sessions = JSON.parse(localStorage.getItem(sessionKey) || '[]');
      allSessions.push(...sessions);
    });
    
    return {
      totalUsers: usersDB.length,
      totalSessions: allSessions.length,
      activeUsers: usersDB.filter(u => {
        const sessionKey = `cae_sessions_${u.id}`;
        const sessions = JSON.parse(localStorage.getItem(sessionKey) || '[]');
        return sessions.length > 0;
      }).length,
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      signup,
      logout,
      forgotPassword,
      resetPassword,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      getAllUsers,
      updateUser,
      deleteUser,
      getAppStats,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
