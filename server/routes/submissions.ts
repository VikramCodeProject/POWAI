import { Router, Response } from 'express';
import { sql } from '../services/db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

function isPastDeadline(deadline?: string): boolean {
  if (!deadline) return false;
  const endOfDay = new Date(`${deadline}T23:59:59.999`);
  if (Number.isNaN(endOfDay.getTime())) return false;
  return Date.now() > endOfDay.getTime();
}

// Get teacher's submissions
router.get('/', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await sql`
      SELECT
        s.*,
        COALESCE(NULLIF(s.teacher_email, ''), a.teacher_email, '') AS owner_email
      FROM submissions s
      LEFT JOIN assignments a ON a.id = s.assignment_id
      WHERE COALESCE(NULLIF(s.teacher_email, ''), a.teacher_email, '') = ${req.user!.email}
      ORDER BY s.submitted_at DESC
    `;
    res.json(rows.map(r => ({
      id: r.id, studentName: r.student_name, assignmentId: r.assignment_id,
      assignmentTitle: r.assignment_title, content: r.content,
      plagiarismText: r.plagiarism_text || r.content || '',
      activityLogs: JSON.parse(r.activity_logs || '[]'),
      images: JSON.parse(r.images || '[]'),
      submittedAt: r.submitted_at, score: r.score,
      flags: JSON.parse(r.flags || '[]'),
      status: r.status, teacherEmail: r.owner_email || r.teacher_email,
    })));
  } catch (err) {
    console.error('Get submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Get single submission
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await sql`SELECT * FROM submissions WHERE id = ${req.params.id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const r = rows[0];
    res.json({
      id: r.id, studentName: r.student_name, assignmentId: r.assignment_id,
      assignmentTitle: r.assignment_title, content: r.content,
      plagiarismText: r.plagiarism_text || r.content || '',
      activityLogs: JSON.parse(r.activity_logs || '[]'),
      images: JSON.parse(r.images || '[]'),
      submittedAt: r.submitted_at, score: r.score,
      flags: JSON.parse(r.flags || '[]'),
      status: r.status, teacherEmail: r.teacher_email,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// Create submission (student)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentName, assignmentId, assignmentTitle, content, plagiarismText, activityLogs, images, submittedAt, score, flags, status } = req.body;

    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required to save submission' });
    }

    // Check if student has already submitted to this assignment
    const existingSubmissions = await sql`
      SELECT id FROM submissions 
      WHERE assignment_id = ${assignmentId} AND student_name = ${studentName}
    `;

    if (existingSubmissions.length > 0) {
      console.log(`⛔ Attempted duplicate submission: ${studentName} for assignment ${assignmentId}`);
      return res.status(403).json({ 
        error: 'Already submitted',
        message: 'You have already submitted this assignment. You can only submit once.',
        existingSubmissionId: existingSubmissions[0].id,
      });
    }

    const assignmentRows = await sql`SELECT id, title, teacher_email, deadline FROM assignments WHERE id = ${assignmentId}`;
    if (assignmentRows.length === 0) {
      return res.status(400).json({ error: 'Assignment not found for this submission' });
    }
    const assignment = assignmentRows[0];
    if (isPastDeadline(assignment.deadline)) {
      return res.status(403).json({
        error: 'Assignment deadline has passed',
        message: `This assignment closed on ${assignment.deadline}. Submissions are no longer accepted.`,
        assignmentClosed: true,
      });
    }

    const resolvedTeacherEmail = assignment.teacher_email || '';
    const resolvedAssignmentTitle = assignment.title || assignmentTitle || 'Assignment';

    await sql`INSERT INTO submissions (id, student_name, assignment_id, assignment_title, content, plagiarism_text, activity_logs, images, submitted_at, score, flags, status, teacher_email)
          VALUES (${id}, ${studentName}, ${assignmentId}, ${resolvedAssignmentTitle}, ${content || ''}, ${plagiarismText || content || ''},
                      ${JSON.stringify(activityLogs || [])}, ${JSON.stringify(images || [])},
                      ${submittedAt}, ${score}, ${JSON.stringify(flags || [])}, ${status}, ${resolvedTeacherEmail})`;
    
    console.log(`✅ Submission created: ${id} by ${studentName} for assignment ${assignmentId}`);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Create submission error:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// Update submission score (teacher)
router.put('/:id/score', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { score } = req.body;
    const normalized = Math.max(0, Math.min(100, Number(score)));

    if (!Number.isFinite(normalized)) {
      return res.status(400).json({ error: 'Score must be a valid number between 0 and 100' });
    }

    const existing = await sql`
      SELECT
        s.id,
        s.teacher_email,
        COALESCE(NULLIF(s.teacher_email, ''), a.teacher_email, '') AS owner_email
      FROM submissions s
      LEFT JOIN assignments a ON a.id = s.assignment_id
      WHERE s.id = ${req.params.id}
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (existing[0].owner_email !== req.user!.email) {
      return res.status(403).json({ error: 'You can only edit scores for your own submissions' });
    }

    const status = normalized >= 80 ? 'genuine' : normalized >= 50 ? 'review' : 'suspicious';
    await sql`
      UPDATE submissions
      SET
        score = ${Math.round(normalized)},
        status = ${status},
        teacher_email = COALESCE(NULLIF(teacher_email, ''), ${req.user!.email})
      WHERE id = ${req.params.id}
    `;

    return res.json({ id: req.params.id, score: Math.round(normalized), status });
  } catch (err) {
    console.error('Update submission score error:', err);
    return res.status(500).json({ error: 'Failed to update submission score' });
  }
});

export default router;
