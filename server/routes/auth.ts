import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { sql } from '../services/db.js';
import { hashPassword } from '../services/crypto.js';
import { signToken, authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: 'Missing required fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await sql`SELECT email FROM users WHERE email = ${email}`;
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userName = name || email.split('@')[0];
    await sql`INSERT INTO users (email, name, password, role) VALUES (${email}, ${userName}, ${hashedPassword}, ${role})`;

    const user = { email, name: userName, role };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (users.length === 0) return res.status(404).json({ error: 'No account found with this email' });

    const dbUser = users[0];
    let valid = false;

    if (dbUser.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, dbUser.password);
    } else {
      // Legacy: plaintext or SHA-256 — try both, then migrate to bcrypt
      valid = dbUser.password === password;
      if (!valid) {
        const sha = await hashPassword(password);
        valid = dbUser.password === sha;
      }
      if (valid) {
        const bcryptHash = await bcrypt.hash(password, 12);
        await sql`UPDATE users SET password = ${bcryptHash} WHERE email = ${email}`;
      }
    }

    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    if (dbUser.role !== role) return res.status(403).json({ error: `This account is registered as a ${dbUser.role}. Please switch roles.` });

    const user = { email: dbUser.email, name: dbUser.name, role: dbUser.role };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
