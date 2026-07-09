import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from "../context/SocketContext";

const Footer = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const socket = useSocket();

  const isWhiteTheme = theme === 'white';
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Guard: do nothing until socket is connected
    if (!socket) return;

    let timeoutId = null;

    const resetHeartbeat = () => {
      setIsLive(true);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLive(false);
      }, 45000);
    };

    socket.on('connect', resetHeartbeat);
    socket.on('heartbeat', resetHeartbeat);
    socket.on('disconnect', () => {
      setIsLive(false);
      if (timeoutId) clearTimeout(timeoutId);
    });

    if (socket.connected) {
      resetHeartbeat();
    }

    return () => {
      socket.off('connect', resetHeartbeat);
      socket.off('heartbeat', resetHeartbeat);
      socket.off('disconnect', resetHeartbeat);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [socket]); // 👈 add socket as dependency

  const version = "v1.0";
  const termsText = "Terms and conditions";

  const handleTermsClick = () => navigate("/terms");
  const handleSettingsClick = () => navigate("/setting");

  return (
    <footer
      className={`
        h-12 flex flex-wrap justify-between items-center px-6 text-xs shrink-0
        ${
          isWhiteTheme
            ? "bg-white border-t border-gray-200 text-gray-500 hover:text-gray-700"
            : "bg-[#2b2d31] border-t border-zinc-700/50 text-gray-400 hover:text-gray-300"
        }
      `}
    >
      <div className="flex items-center space-x-4">
        <button
          onClick={handleTermsClick}
          className="tracking-wide hover:underline cursor-pointer focus:outline-none"
        >
          {termsText}
        </button>
        <span className="hidden sm:inline text-[11px] opacity-60">•</span>
        <span className="hidden sm:inline text-[11px] font-mono opacity-70">
          {version}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <div className="hidden md:flex items-center space-x-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isLive ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-[10px] uppercase tracking-wider">
            {isLive ? "Live" : "Offline"}
          </span>
        </div>

        <button
          onClick={handleSettingsClick}
          className={`
            group flex items-center justify-center w-7 h-7 rounded-md
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
              isWhiteTheme
                ? "hover:bg-gray-100 focus:ring-gray-400 focus:ring-offset-white"
                : "hover:bg-white/10 focus:ring-gray-500 focus:ring-offset-[#2b2d31]"
            }
          `}
          aria-label="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.38.138.752.43.992l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.074.124a6.57 6.57 0 0 1-.22.128c-.332.183-.582.495-.645.87l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.645-.87a6.59 6.59 0 0 1-.22-.127c-.324-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.5 6.5 0 0 1 0-.255c.007-.38-.138-.752-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.752.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.87l.214-1.281Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </button>
      </div>
    </footer>
  );
};

export default Footer;