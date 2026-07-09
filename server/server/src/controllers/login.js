const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.clearCookie('guest_token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      path: '/'
    });

    const token = jwt.sign(
      { 
        username: user.username, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        userId: user._id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    res.cookie('token', token, { 
      httpOnly: true, 
      sameSite: process.env.COOKIE_SAMESITE, 
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10),
      path: '/'
    });

    res.json({ 
      success: true,
      user: {
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = login;