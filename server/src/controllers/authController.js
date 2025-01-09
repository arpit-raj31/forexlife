import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export const register = async (req, res) => {
  const { username, email, password, fullname } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }

    console.log('Plain password before hashing:', password);
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashedPassword);

    const newUser = new User({
      fullname,
      username,
      email,
      password: hashedPassword,
    });

    const savedUser = await newUser.save();
    console.log('Saved user in DB:', savedUser);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Error registering user', error: err });
  }
};


export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('Login attempt for:', username);

    const user = await User.findOne({ username });
    if (!user) {
      console.log('User not found:', username);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User fetched from DB:', user);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Plain password:', password);
    console.log('Hashed password in DB:', user.password);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    console.log('Login successful for user:', username);

    res.status(200).json({ message: 'Login successful', token, user });
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};



export const validateToken = (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: 'Token is valid', user: decoded });
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};



export const logout = (req, res) => {
  res.status(200).json({ message: 'Logout successful' });
};
