// src/components/CodeExportModal.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const CodeExportModal = ({ isOpen, onClose, endpointData }) => {
  const [activeTab, setActiveTab] = useState('curl');
  const { theme } = useTheme();
  const { showSuccess } = useToast();
  const isWhiteTheme = theme === 'white';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const {
    url = 'http://localhost:8080/p/project1/v1/api',
    method = 'GET',
    headers = [],
    queryParams = [],
    requestBody = '',
    expectedToken = '',
    expectedApiKey = '',
    authScheme = '',
    isAuthEnabled = false,
  } = endpointData || {};

  // Build full query string
  const fullUrl = useMemo(() => {
    let result = url;
    if (Array.isArray(queryParams) && queryParams.length > 0) {
      const validParams = queryParams.filter((q) => q.key && q.value);
      if (validParams.length > 0) {
        const qs = validParams
          .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
          .join('&');
        result += (result.includes('?') ? '&' : '?') + qs;
      }
    }
    return result;
  }, [url, queryParams]);

  // Build active headers object
  const headerObj = useMemo(() => {
    const obj = {};
    if (Array.isArray(headers)) {
      headers.forEach((h) => {
        if (h.key && h.value) obj[h.key] = h.value;
      });
    }
    if (isAuthEnabled) {
      if (authScheme === 'BearerAuth' && expectedToken) {
        obj['Authorization'] = `Bearer ${expectedToken}`;
      } else if (authScheme === 'ApiKeyAuth' && expectedApiKey) {
        obj['x-api-key'] = expectedApiKey;
      }
    }
    if (method !== 'GET' && method !== 'HEAD' && requestBody && !obj['Content-Type']) {
      obj['Content-Type'] = 'application/json';
    }
    return obj;
  }, [headers, isAuthEnabled, authScheme, expectedToken, expectedApiKey, method, requestBody]);

  // 1. cURL generator
  const generateCurl = useCallback(() => {
    let cmd = `curl -X ${method} "${fullUrl}"`;
    Object.entries(headerObj).forEach(([k, v]) => {
      cmd += ` \\\n  -H "${k}: ${v}"`;
    });
    if (requestBody && method !== 'GET' && method !== 'HEAD') {
      const sanitizedBody = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
      cmd += ` \\\n  -d '${sanitizedBody.replace(/'/g, "'\\''")}'`;
    }
    return cmd;
  }, [method, fullUrl, headerObj, requestBody]);

  // 2. JavaScript Fetch generator
  const generateFetch = useCallback(() => {
    const options = {
      method,
      headers: headerObj,
    };
    if (requestBody && method !== 'GET' && method !== 'HEAD') {
      try {
        options.body = typeof requestBody === 'string' ? JSON.stringify(JSON.parse(requestBody)) : JSON.stringify(requestBody);
      } catch {
        options.body = requestBody;
      }
    }
    return `// JavaScript (Fetch API)
fetch("${fullUrl}", ${JSON.stringify(options, null, 2)})
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error("Error:", error));`;
  }, [method, headerObj, requestBody, fullUrl]);

  // 3. Node.js Axios generator
  const generateAxios = useCallback(() => {
    const config = {
      method: method.toLowerCase(),
      url: fullUrl,
      headers: headerObj,
    };
    if (requestBody && method !== 'GET' && method !== 'HEAD') {
      try {
        config.data = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
      } catch {
        config.data = requestBody;
      }
    }
    return `// Node.js (Axios)
const axios = require('axios');

axios(${JSON.stringify(config, null, 2)})
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error.message));`;
  }, [method, fullUrl, headerObj, requestBody]);

  // 4. Python Requests generator
  const generatePython = useCallback(() => {
    const headerLines = Object.entries(headerObj)
      .map(([k, v]) => `    "${k}": "${v}"`)
      .join(',\n');
    let code = `import requests\n\nurl = "${fullUrl}"\n`;
    if (headerLines) {
      code += `headers = {\n${headerLines}\n}\n`;
    } else {
      code += `headers = {}\n`;
    }
    if (requestBody && method !== 'GET' && method !== 'HEAD') {
      const bodyStr = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
      code += `payload = ${bodyStr}\n\n`;
      code += `response = requests.${method.toLowerCase()}(url, json=payload, headers=headers)\n`;
    } else {
      code += `\nresponse = requests.${method.toLowerCase()}(url, headers=headers)\n`;
    }
    code += `print(response.status_code)\nprint(response.json())`;
    return code;
  }, [headerObj, fullUrl, requestBody, method]);

  // 5. Go generator
  const generateGo = useCallback(() => {
    const escapedBody = (requestBody || '').replace(/`/g, '` + "`" + `');
    return `package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
)

func main() {
	url := "${fullUrl}"
	payload := strings.NewReader(\`${escapedBody}\`)

	req, _ := http.NewRequest("${method}", url, payload)
${Object.entries(headerObj)
  .map(([k, v]) => `\treq.Header.Add("${k}", "${v}")`)
  .join('\n')}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	fmt.Println(res.Status)
	fmt.Println(string(body))
}`;
  }, [fullUrl, requestBody, method, headerObj]);

  const codeSnippet = useMemo(() => {
    switch (activeTab) {
      case 'curl':
        return generateCurl();
      case 'fetch':
        return generateFetch();
      case 'axios':
        return generateAxios();
      case 'python':
        return generatePython();
      case 'go':
        return generateGo();
      default:
        return generateCurl();
    }
  }, [activeTab, generateCurl, generateFetch, generateAxios, generatePython, generateGo]);

  const handleCopy = () => {
    const text = codeSnippet;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showSuccess(`Copied ${activeTab.toUpperCase()} snippet to clipboard!`);
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showSuccess(`Copied ${activeTab.toUpperCase()} snippet to clipboard!`);
      } catch (_) {}
      document.body.removeChild(textarea);
    }
  };

  if (!isOpen || !endpointData) return null;

  const cardBg = isWhiteTheme ? 'bg-white text-gray-800' : 'bg-[#181825] text-zinc-200';
  const borderBg = isWhiteTheme ? 'border-gray-200' : 'border-[#313244]';
  const codeBg = isWhiteTheme ? 'bg-gray-900 text-gray-100' : 'bg-[#11111b] text-emerald-400';

  const tabs = [
    { id: 'curl', label: 'cURL' },
    { id: 'fetch', label: 'JavaScript (Fetch)' },
    { id: 'axios', label: 'Node.js (Axios)' },
    { id: 'python', label: 'Python (Requests)' },
    { id: 'go', label: 'Go' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="codeExportTitle"
    >
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-mono max-h-[90vh] ${cardBg} ${borderBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${borderBg}`}>
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">🚀</span>
            <h3 id="codeExportTitle" className="text-sm font-bold tracking-wide">
              Export Client Code
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close export dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className={`flex items-center gap-1.5 px-4 py-2 border-b overflow-x-auto shrink-0 ${borderBg} custom-scrollbar`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Snippet Box */}
        <div className="relative flex-1 p-4 overflow-hidden flex flex-col min-h-[260px]">
          <pre className={`flex-1 p-4 rounded-xl text-xs overflow-auto font-mono leading-relaxed select-all border border-black/20 custom-scrollbar ${codeBg}`}>
            <code>{codeSnippet}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-3 border-t shrink-0 ${borderBg}`}>
          <span className="text-[11px] text-zinc-500 truncate max-w-xs font-mono">
            {method} {fullUrl}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition focus:outline-none"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span>📋 Copy Code</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CodeExportModal);