// src/components/TitleUpdater.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles = {
  '/': 'MockAPI',
  '/home': 'MockAPI - Home',
  '/login': 'MockAPI - Login',
  '/signup': 'MockAPI - Sign Up',
  '/otp': 'MockAPI - Verify OTP',
  '/terms': 'MockAPI - Terms & Conditions',
  '/setting': 'MockAPI - Settings',
  '/manageaccount': 'MockAPI - Manage Account',
  '/subscribe': 'MockAPI - Subscribe',
  '/projects': 'MockAPI - Projects',
  '/settings': 'MockAPI - Settings',
};

const patterns = [
  { test: /^\/project\/[^/]+$/, title: 'MockAPI - Project Details' },
  { test: /^\/api\/[^/]+$/, title: 'MockAPI - API Details' },
  { test: /^\/user\/[^/]+$/, title: 'MockAPI - User Profile' },
];

function getTitleFromPath(pathname) {
  if (titles[pathname]) return titles[pathname];
  for (const pattern of patterns) {
    if (pattern.test(pathname)) return pattern.title;
  }
  const lastSegment = pathname.split('/').pop();
  if (lastSegment && lastSegment !== '') {
    const formatted = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    return `MockAPI - ${formatted}`;
  }
  return 'MockAPI';
}

export default function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getTitleFromPath(pathname);
  }, [pathname]);

  return null;
}