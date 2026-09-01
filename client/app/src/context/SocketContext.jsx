import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  // Ref to track if the socket was created – prevents double init in React Strict Mode
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in Strict Mode
    if (isInitialized.current) {
      return () => {};
    }

    const SOCKET_URL = import.meta.env.VITE_API_BASE_URL;
    if (!SOCKET_URL) {
      console.error("[SOCKET] VITE_API_BASE_URL is not defined – socket connection will fail");
    }

    // Create socket instance with robust reconnection settings
    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 10000,
      autoConnect: true,
    });

    // ─── Event listeners ──────────────────────────────────────────────
    socketInstance.on("connect", () => {
      console.log("[SOCKET] connected ✅", socketInstance.id);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[SOCKET] connect_error ❌", err.message);
      // You can optionally emit an event to your app here for UI notifications
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[SOCKET] disconnected ⚠️", reason);
      // Handle specific disconnection reasons for better UX
      if (reason === "io server disconnect") {
        // Server initiated disconnect – attempt manual reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on("error", (err) => {
      console.error("[SOCKET] error ❌", err);
    });

    // ─── Optional: ping/pong heartbeat (already handled by Socket.IO) ──

    setSocket(socketInstance);
    isInitialized.current = true;

    // ─── Cleanup ──────────────────────────────────────────────────────
    return () => {
      // Only disconnect if the component is unmounting for real
      // (In Strict Mode, this runs once and the effect runs again)
      if (socketInstance) {
        // Remove all listeners to prevent memory leaks
        socketInstance.off("connect");
        socketInstance.off("connect_error");
        socketInstance.off("disconnect");
        socketInstance.off("error");
        // Disconnect the socket
        socketInstance.disconnect();
      }
      isInitialized.current = false;
      setSocket(null);
    };
  }, []); // Empty dependency array – runs once on mount

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};