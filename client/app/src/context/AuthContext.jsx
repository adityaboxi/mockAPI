import { createContext, useState, useContext, useEffect, useRef } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const initialSyncDone = useRef(false);

  // ==========environment Variables (add these to your .env if missing) ==========
  const GUEST_SESSION_URL = import.meta.env.VITE_API_URL_GUEST_SESSION;
  const SYNC_AUTH_URL = import.meta.env.VITE_API_URL_SYNCAUTH;
  const SUBSCRIBE_URL = import.meta.env.VITE_API_URL_SUBSCRIBE;     // add to .env if needed
  const UNSUBSCRIBE_URL = import.meta.env.VITE_API_URL_UNSUBSCRIBE; // add to .env if needed
  const LOGOUT_URL = import.meta.env.VITE_API_URL_LOGOUT;

  // Create guest session
  const createGuestSession = async () => {
    try {
      const response = await fetch(GUEST_SESSION_URL, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setIsGuest(true);
        setUser({ 
          username: "Guest", 
          role: "guest",
          subscribe: false  
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Guest session failed:", error);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch(SYNC_AUTH_URL, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.username) {
          setUser({
            ...data.user,
            role: data.user.role || "user",
            subscribe: data.user.subscribe === true
          });
          setIsGuest(false);
          return data.user;
        }
      }
      return null;
    } catch (error) {
      console.error("Refresh user error:", error);
      return null;
    }
  };

  const subscribeUser = async () => {
    try {
      const response = await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (response.ok) {
        await refreshUser();  
        return { success: true, message: 'Subscribed successfully' };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Subscription failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const unsubscribeUser = async () => {
    try {
      const response = await fetch(UNSUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (response.ok) {
        await refreshUser();  
        return { success: true, message: 'Unsubscribed successfully' };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Unsubscription failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const syncSession = async () => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    try {
      const response = await fetch(SYNC_AUTH_URL, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.username) {
          setUser({
            ...data.user,
            role: data.user.role || "user",
            subscribe: data.user.subscribe === true
          });
          setIsGuest(false);
          setIsLoading(false);
          return;
        }
      }
      setUser(null);
      await createGuestSession();
    } catch (error) {
      setUser(null);
      await createGuestSession();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncSession();
  }, []);

  const login = async (userData) => {
    if (!userData || !userData.username) {
      return;
    }
    setUser({
      ...userData,
      role: "user",
      subscribe: userData.subscribe === true
    });
    setIsGuest(false);
  };

  
  
  const logout = async () => {
    try {
      await fetch(LOGOUT_URL, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
    } finally {
      setUser(null);
      setIsGuest(false);
      localStorage.removeItem('active_project'); 
      await createGuestSession();
    }
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
    isGuest,
    refreshUser,
    subscribeUser,
    unsubscribeUser
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
};

