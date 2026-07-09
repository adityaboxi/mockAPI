export const authenticateUser = async (username, password) => {
  const LOGIN_URL = import.meta.env.VITE_API_URL_LOGIN;
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  return response.ok;
};


