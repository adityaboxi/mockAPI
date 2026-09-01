// src/context/SocketContext.jsx
import React, { createContext, useContext } from "react";
import { socket } from "../socket";

const SocketContext = createContext(socket);

export const SocketProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context || socket;
};