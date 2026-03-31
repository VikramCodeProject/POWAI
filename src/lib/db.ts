import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL as string | undefined;

if (!DATABASE_URL) {
  console.warn('VITE_DATABASE_URL not set. Database operations will fail.');
}

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

const ensureDb = () => {
  if (!sql) throw new Error('Database not configured. Set VITE_DATABASE_URL in .env');
  return sql;
};

export const initDb = async () => {
  const db = ensureDb();
  await db`
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
  await db`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      assignment_title TEXT NOT NULL,
      content TEXT DEFAULT '',
      activity_logs TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      submitted_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      flags TEXT DEFAULT '[]',
      status TEXT NOT NULL,
      teacher_email TEXT DEFAULT ''
    )
  `;
  try {
    await db`ALTER TABLE assignments ADD COLUMN teacher_email TEXT`;
  } catch (err) {
    // Ignore if column already exists
  }
};

export const insertAssignment = async (assignment: any) => {
  const db = ensureDb();
  await db`
    INSERT INTO assignments (id, title, instructions, deadline, code, created_at, teacher_email)
    VALUES (${assignment.id}, ${assignment.title}, ${assignment.instructions}, ${assignment.deadline}, ${assignment.code}, ${assignment.createdAt}, ${assignment.teacherEmail || ''})
  `;
};

export const getAssignments = async (teacherEmail?: string) => {
  const db = ensureDb();
  const assignments = teacherEmail
    ? await db`SELECT * FROM assignments WHERE teacher_email = ${teacherEmail} ORDER BY created_at DESC`
    : await db`SELECT * FROM assignments ORDER BY created_at DESC`;
  return assignments.map(row => ({
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    deadline: row.deadline,
    code: row.code,
    createdAt: row.created_at,
    teacherEmail: row.teacher_email,
  }));
};

export const insertUser = async (user: any) => {
  const db = ensureDb();
  await db`
    INSERT INTO users (email, name, password, role)
    VALUES (${user.email}, ${user.name}, ${user.password}, ${user.role})
  `;
};

export const getUserByEmail = async (email: string) => {
  const db = ensureDb();
  const users = await db`SELECT * FROM users WHERE email = ${email}`;
  return users.length > 0 ? users[0] : null;
};

export const updateUserPassword = async (email: string, hashedPassword: string) => {
  const db = ensureDb();
  await db`UPDATE users SET password = ${hashedPassword} WHERE email = ${email}`;
};

export const insertSubmission = async (submission: any) => {
  const db = ensureDb();
  await db`
    INSERT INTO submissions (id, student_name, assignment_id, assignment_title, content, activity_logs, images, submitted_at, score, flags, status, teacher_email)
    VALUES (
      ${submission.id},
      ${submission.studentName},
      ${submission.assignmentId},
      ${submission.assignmentTitle},
      ${submission.content || ''},
      ${JSON.stringify(submission.activityLogs || [])},
      ${JSON.stringify(submission.images || [])},
      ${submission.submittedAt},
      ${submission.score},
      ${JSON.stringify(submission.flags || [])},
      ${submission.status},
      ${submission.teacherEmail || ''}
    )
  `;
};

export const getSubmissions = async (teacherEmail?: string) => {
  const db = ensureDb();
  const rows = teacherEmail
    ? await db`SELECT * FROM submissions WHERE teacher_email = ${teacherEmail} ORDER BY submitted_at DESC`
    : await db`SELECT * FROM submissions ORDER BY submitted_at DESC`;
  return rows.map(row => ({
    id: row.id,
    studentName: row.student_name,
    assignmentId: row.assignment_id,
    assignmentTitle: row.assignment_title,
    content: row.content,
    activityLogs: JSON.parse(row.activity_logs || '[]'),
    images: JSON.parse(row.images || '[]'),
    submittedAt: row.submitted_at,
    score: row.score,
    flags: JSON.parse(row.flags || '[]'),
    status: row.status,
    teacherEmail: row.teacher_email,
  }));
};
