// src/components/TitleUpdater.jsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// $O(1)$ Exact path map
const staticTitles = {
  '/': 'MockAPI',
  '/home': 'MockAPI - Studio',
  '/login': 'MockAPI - Sign In',
  '/signup': 'MockAPI - Sign Up',
  '/otp': 'MockAPI - Verify Security Code',
  '/terms': 'MockAPI - Terms & Conditions',
  '/setting': 'MockAPI - Settings',
  '/settings': 'MockAPI - Settings',
  '/manageaccount': 'MockAPI - Manage Account',
  '/subscribe': 'MockAPI - Upgrade Plan',
  '/projects': 'MockAPI - Workspaces',
  '/forgot-password': 'MockAPI - Account Recovery',
  '/change-password': 'MockAPI - Security & Password',
  '/dashboard': 'MockAPI - Telemetry Dashboard',
  '/tools': 'MockAPI - API Engineering Tools',
  '/general-question': 'MockAPI - Onboarding',
};

// Regex pattern matchers for parameterized URLs
const dynamicMatchers = [
  { regex: /^\/project\/[^/]+$/, title: 'MockAPI - Workspace Details' },
  { regex: /^\/api\/[^/]+$/, title: 'MockAPI - API Endpoint Details' },
  { regex: /^\/user\/[^/]+$/, title: 'MockAPI - User Profile' },
];

function getTitleFromPath(pathname) {
  if (!pathname) return 'MockAPI';

  // Normalize path by stripping trailing slash (except root '/')
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (staticTitles[normalized]) {
    return staticTitles[normalized];
  }

  for (const { regex, title } of dynamicMatchers) {
    if (regex.test(normalized)) return title;
  }

  return 'MockAPI';
}

export default function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = getTitleFromPath(pathname);
    }
  }, [pathname]);

  return null;
}