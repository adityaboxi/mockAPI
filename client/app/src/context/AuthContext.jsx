import { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};



export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const initialSyncDone = useRef(false);
  // Track in-flight requests to prevent duplicate calls
  const pendingRequests = useRef(new Map());

  //  Environment variables
  const GUEST_SESSION_URL = import.meta.env.VITE_API_URL_GUEST_SESSION;
  const SYNC_AUTH_URL = import.meta.env.VITE_API_URL_SYNCAUTH;
  const SUBSCRIBE_URL = import.meta.env.VITE_API_URL_SUBSCRIBE;
  const UNSUBSCRIBE_URL = import.meta.env.VITE_API_URL_UNSUBSCRIBE;
  const LOGOUT_URL = import.meta.env.VITE_API_URL_LOGOUT;

  // ─── Core: create guest session ───────────────────────────────────────────────
  const createGuestSession = useCallback(async () => {
    try {
      const response = await fetch(GUEST_SESSION_URL, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setIsGuest(true);
        setUser({ username: "Guest", role: "guest", subscribe: false });
        return true;
      } else {
        console.warn("Guest session creation failed:", response.status);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Guest session error:", error);
      setUser(null);
      return false;
    }
  }, [GUEST_SESSION_URL]);

  // ─── Core: refresh user data (with deduplication) ──────────────────────────
  const refreshUser = useCallback(async () => {
    // Return existing in-flight request if any
    const pendingKey = "refreshUser";
    if (pendingRequests.current.has(pendingKey)) {
      return pendingRequests.current.get(pendingKey);
    }

    const promise = (async () => {
      try {
        const response = await fetch(SYNC_AUTH_URL, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user && data.user.username) {
            const userData = {
              ...data.user,
              role: data.user.role || "user",
              subscribe: data.user.subscribe === true,
            };
            setUser(userData);
            setIsGuest(false);
            return userData;
          }
        }
        // If not authenticated, fallback to guest
        await createGuestSession();
        return null;
      } catch (error) {
        console.error("Refresh user error:", error);
        await createGuestSession();
        return null;
      } finally {
        pendingRequests.current.delete(pendingKey);
      }
    })();

    pendingRequests.current.set(pendingKey, promise);
    return promise;
  }, [SYNC_AUTH_URL, createGuestSession]);

  // ─── Subscription actions ──────────────────────────────────────────────────────
  const subscribeUser = useCallback(async () => {
    try {
      const response = await fetch(SUBSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        await refreshUser();
        return { success: true, message: "Subscribed successfully" };
      } else {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.error || "Subscription failed" };
      }
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }, [SUBSCRIBE_URL, refreshUser]);

  const unsubscribeUser = useCallback(async () => {
    try {
      const response = await fetch(UNSUBSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        await refreshUser();
        return { success: true, message: "Unsubscribed successfully" };
      } else {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.error || "Unsubscription failed" };
      }
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }, [UNSUBSCRIBE_URL, refreshUser]);

  // ─── Login / Logout ────────────────────────────────────────────────────────────
  const login = useCallback((userData) => {
    if (!userData?.username) return;
    setUser({
      ...userData,
      role: userData.role || "user",
      subscribe: userData.subscribe === true,
    });
    setIsGuest(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(LOGOUT_URL, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      // silent fail – we still clear local state
    } finally {
      setUser(null);
      setIsGuest(false);
      localStorage.removeItem("active_project");
      await createGuestSession();
    }
  }, [LOGOUT_URL, createGuestSession]);

  // ─── Initial sync ──────────────────────────────────────────────────────────────
  const syncSession = useCallback(async () => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    try {
      const response = await fetch(SYNC_AUTH_URL, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user?.username) {
          setUser({
            ...data.user,
            role: data.user.role || "user",
            subscribe: data.user.subscribe === true,
          });
          setIsGuest(false);
          setIsLoading(false);
          return;
        }
      }
      // No authenticated user – create guest session
      await createGuestSession();
    } catch (error) {
      await createGuestSession();
    } finally {
      setIsLoading(false);
    }
  }, [SYNC_AUTH_URL, createGuestSession]);

  useEffect(() => {
    syncSession();
    // Cleanup pending requests on unmount
    return () => {
      pendingRequests.current.clear();
    };
  }, [syncSession]);

  // ─── Provider value ──────────────────────────────────────────────────────────
  const value = {
    user,
    login,
    logout,
    isLoading,
    isGuest,
    refreshUser,
    subscribeUser,
    unsubscribeUser,
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
};