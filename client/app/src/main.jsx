/*import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ProjectProvider } from './context/ProjectContext'
import { ThemeProvider } from './context/ThemeContext'
import { ApiVersionProvider } from './context/ApiVersionContext'
import { SocketProvider } from "./context/SocketContext";

// ===== GLOBAL FETCH OVERRIDE =====
// Ensures every fetch request sends credentials (cookies) by default.
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  options = options || {};
  options.credentials = 'include';
  return originalFetch.call(this, url, options);
};

function RootContainer() {
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#1e1e24';
    document.body.style.backgroundColor = '#1e1e24';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <ApiVersionProvider>
            <SocketProvider> 
              <App />
            </SocketProvider>
          </ApiVersionProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RootContainer />
    </BrowserRouter>
  </StrictMode>,
);*/



import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ApiVersionProvider } from './context/ApiVersionContext';
import { SocketProvider } from './context/SocketContext';

// ===== GLOBAL FETCH OVERRIDE =====
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  options = options || {};
  options.credentials = 'include';
  return originalFetch.call(this, url, options);
};

function RootContainer() {
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#1e1e24';
    document.body.style.backgroundColor = '#1e1e24';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <ApiVersionProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </ApiVersionProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RootContainer />
    </BrowserRouter>
  </StrictMode>
);