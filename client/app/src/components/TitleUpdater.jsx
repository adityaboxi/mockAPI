

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const matchers = [
  // Exact path matches
  { test: (path) => path === '/', title: 'MockAPI' },
  { test: (path) => path === '/home', title: 'MockAPI - Home' },
  { test: (path) => path === '/login', title: 'MockAPI - Login' },
  { test: (path) => path === '/signup', title: 'MockAPI - Sign Up' },
  { test: (path) => path === '/otp', title: 'MockAPI - Verify OTP' },
  { test: (path) => path === '/terms', title: 'MockAPI - Terms & Conditions' },
  { test: (path) => path === '/setting', title: 'MockAPI - Settings' },
  { test: (path) => path === '/manageaccount', title: 'MockAPI - Manage Account' },
  { test: (path) => path === '/subscribe', title: 'MockAPI - Subscribe' },
  { test: (path) => path === '/projects', title: 'MockAPI - Projects' },
  { test: (path) => path === '/settings', title: 'MockAPI - Settings' },

  // Pattern matches (regex)
  { test: (path) => /^\/project\/[^/]+$/.test(path), title: 'MockAPI - Project Details' },
  { test: (path) => /^\/api\/[^/]+$/.test(path), title: 'MockAPI - API Details' },
  { test: (path) => /^\/user\/[^/]+$/.test(path), title: 'MockAPI - User Profile' },
];

function getTitleFromPath(pathname) {
  for (const matcher of matchers) {
    if (matcher.test(pathname)) return matcher.title;
  }
  // Fallback – return a generic title for unmatched paths
  return 'MockAPI';
}

export default function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getTitleFromPath(pathname);
  }, [pathname]);

  return null;
}