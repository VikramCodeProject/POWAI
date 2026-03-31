import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const rawDatabaseUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error('Database URL is missing. Set DATABASE_URL (preferred) or VITE_DATABASE_URL.');
}

const normalizedInput = rawDatabaseUrl
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/^DATABASE_URL\s*=\s*/i, '')
  .replace(/\\\s+/g, '')
  .replace(/\s+/g, '');

const extractedUrl = normalizedInput.match(/postgres(?:ql)?:\/\/[^\s'"`]+/i)?.[0] || normalizedInput;

const DATABASE_URL = extractedUrl;

if (!/^postgres(ql)?:\/\//i.test(DATABASE_URL)) {
  throw new Error('Invalid database URL format. Expected: postgresql://user:password@host/db?sslmode=require');
}

export const sql = neon(DATABASE_URL);

export const initDb = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      deadline TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      teacher_email TEXT DEFAULT ''
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      assignment_title TEXT NOT NULL,
      content TEXT DEFAULT '',
      plagiarism_text TEXT DEFAULT '',
      activity_logs TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      submitted_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      flags TEXT DEFAULT '[]',
      status TEXT NOT NULL,
      teacher_email TEXT DEFAULT '',
      plagiarism_score INTEGER DEFAULT 0,
      plagiarism_flagged BOOLEAN DEFAULT false
    )
  `;
  try { await sql`ALTER TABLE assignments ADD COLUMN teacher_email TEXT`; } catch { /* exists */ }
  try { await sql`ALTER TABLE submissions ADD COLUMN plagiarism_text TEXT DEFAULT ''`; } catch { /* exists */ }
  try { await sql`ALTER TABLE submissions ADD COLUMN plagiarism_score INTEGER DEFAULT 0`; } catch { /* exists */ }
  try { await sql`ALTER TABLE submissions ADD COLUMN plagiarism_flagged BOOLEAN DEFAULT false`; } catch { /* exists */ }
  console.log('✅ Database tables initialized');
};
