import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'powai-fallback-secret';

export interface AuthRequest extends Request {
  user?: { email: string; name: string; role: 'teacher' | 'student' };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (role: 'teacher' | 'student') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `Access restricted to ${role}s` });
    }
    next();
  };
};

export const signToken = (user: { email: string; name: string; role: string }) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
};
