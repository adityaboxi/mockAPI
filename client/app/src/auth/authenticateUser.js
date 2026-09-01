import { apiClient } from '../services/apiClient';


export const authenticateUser = async (username, password) => {
  const LOGIN_URL = import.meta.env.VITE_API_URL_LOGIN || '/api/login';

  const cleanUsername = (username || '').trim();
  const cleanPassword = password || '';

  if (!cleanUsername || !cleanPassword) {
    return {
      success: false,
      error: 'Username and password are required',
      status: 400,
    };
  }

  try {
    const data = await apiClient.post(LOGIN_URL, {
      username: cleanUsername,
      password: cleanPassword,
    });
    return { success: true, data };
  } catch (err) {
    const errorMessage =
      err.data?.message || err.message || 'Invalid credentials or connection error';
    return {
      success: false,
      error: errorMessage,
      status: err.status || 500,
    };
  }
};