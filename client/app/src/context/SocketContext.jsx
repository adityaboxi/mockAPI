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