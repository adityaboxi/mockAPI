import { createContext, useContext, useEffect, useState } from "react";
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
  useEffect(() => {
const socketInstance = io(import.meta.env.VITE_API_BASE_URL, {
  withCredentials: true,
  transports: ["websocket"],
});

socketInstance.on("connect", () => {
  console.log("[SOCKET] connected:", socketInstance.id);
});

socketInstance.on("connect_error", (err) => {
  console.error("[SOCKET] connect_error:", err.message, err);
});

socketInstance.on("disconnect", (reason) => {
  console.log("[SOCKET] disconnected:", reason);
});

socketInstance.on("error", (err) => {
  console.error("[SOCKET] error:", err);
});

    setSocket(socketInstance);
return () => {
      socketInstance.disconnect();
    };
  }, []);
return (
<SocketContext.Provider value={socket}>
{children}
</SocketContext.Provider>
  );
};