// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import { apiClient } from "../services/apiClient";

const AuthContext = createContext(null);

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
  const pendingRequests = useRef(new Map());
  const mountedRef = useRef(true);

  const GUEST_SESSION_URL = import.meta.env.VITE_API_URL_GUEST_SESSION || '/api/guest-session';
  const SYNC_AUTH_URL = import.meta.env.VITE_API_URL_SYNCAUTH || '/api/sync-auth';
  const SUBSCRIBE_URL = import.meta.env.VITE_API_URL_SUBSCRIBE || '/api/subscribe';
  const UNSUBSCRIBE_URL = import.meta.env.VITE_API_URL_UNSUBSCRIBE || '/api/unsubscribe';
  const LOGOUT_URL = import.meta.env.VITE_API_URL_LOGOUT || '/api/logout';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRequests.current.clear();
    };
  }, []);

  // ─── Core: create guest session ───────────────────────────────────────────────
  const createGuestSession = useCallback(async () => {
    try {
      await apiClient.post(GUEST_SESSION_URL);
      if (mountedRef.current) {
        setIsGuest(true);
        setUser({ username: "Guest", role: "guest", subscribe: false });
      }
      return true;
    } catch (error) {
      console.warn("Guest session error:", error.message);
      if (mountedRef.current) {
        setUser(null);
      }
      return false;
    }
  }, [GUEST_SESSION_URL]);

  // ─── Core: refresh user data (with deduplication) ──────────────────────────
  const refreshUser = useCallback(async () => {
    const pendingKey = "refreshUser";
    if (pendingRequests.current.has(pendingKey)) {
      return pendingRequests.current.get(pendingKey);
    }

    const promise = (async () => {
      try {
        const savedToken = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
        const data = await apiClient.get(SYNC_AUTH_URL);
        if (data.user && data.user.username) {
          const userData = {
            ...data.user,
            role: data.user.role || "user",
            subscribe: data.user.subscribe === true,
          };
          if (mountedRef.current) {
            setUser(userData);
            setIsGuest(false);
          }
          return userData;
        }
        if (!savedToken) {
          await createGuestSession();
        }
        return null;
      } catch (error) {
        console.error("Refresh user error:", error.message);
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
      await apiClient.post(SUBSCRIBE_URL);
      await refreshUser();
      return { success: true, message: "Subscribed successfully" };
    } catch (error) {
      return { success: false, error: error.message || "Subscription failed" };
    }
  }, [SUBSCRIBE_URL, refreshUser]);

  const unsubscribeUser = useCallback(async () => {
    try {
      await apiClient.post(UNSUBSCRIBE_URL);
      await refreshUser();
      return { success: true, message: "Unsubscribed successfully" };
    } catch (error) {
      return { success: false, error: error.message || "Unsubscription failed" };
    }
  }, [UNSUBSCRIBE_URL, refreshUser]);

  // ─── Login / Logout ────────────────────────────────────────────────────────────
  const login = useCallback((userData, token) => {
    if (!userData?.username) return;
    if (token) {
      localStorage.setItem("auth_token", token);
    }
    setUser({
      ...userData,
      role: userData.role || "user",
      subscribe: userData.subscribe === true,
    });
    setIsGuest(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post(LOGOUT_URL);
    } catch {
      // silent fail – we still clear local state
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("active_project");
      if (mountedRef.current) {
        setUser(null);
        setIsGuest(false);
      }
      await createGuestSession();
    }
  }, [LOGOUT_URL, createGuestSession]);

  // ─── Initial sync ──────────────────────────────────────────────────────────────
  const syncSession = useCallback(async () => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    try {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
      const data = await apiClient.get(SYNC_AUTH_URL);
      if (data.user?.username) {
        if (mountedRef.current) {
          setUser({
            ...data.user,
            role: data.user.role || "user",
            subscribe: data.user.subscribe === true,
          });
          setIsGuest(false);
          setIsLoading(false);
        }
        return;
      }
      if (!savedToken) {
        await createGuestSession();
      }
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem("auth_token");
      }
      await createGuestSession();
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [SYNC_AUTH_URL, createGuestSession]);

  // ─── Global Events: Token Expired & Cross-Tab Sync ──────────────────────────
  useEffect(() => {
    syncSession();

    const handleAuthExpired = () => {
      localStorage.removeItem("auth_token");
      createGuestSession();
    };

    const handleStorageChange = (e) => {
      if (e.key === "auth_token") {
        refreshUser();
      }
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncSession, createGuestSession, refreshUser]);

  // ─── Memoized Provider Value ─────────────────────────────────────────────────
  const value = useMemo(() => ({
    user,
    login,
    logout,
    isLoading,
    isGuest: isGuest || user?.role === "guest",
    refreshUser,
    subscribeUser,
    unsubscribeUser,
  }), [
    user,
    login,
    logout,
    isLoading,
    isGuest,
    refreshUser,
    subscribeUser,
    unsubscribeUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};