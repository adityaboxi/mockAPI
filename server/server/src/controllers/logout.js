/*async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE,
    path: '/'
  });
  res.clearCookie('guest_token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE,
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = logout;*/


function logout(req, res) {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      path: '/'
    });

    res.clearCookie('guest_token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      path: '/'
    });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[logout] Error:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
}

module.exports = logout;