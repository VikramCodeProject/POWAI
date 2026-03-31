import { Router, Response } from 'express';
import { sql } from '../services/db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

function isPastDeadline(deadline?: string): boolean {
  if (!deadline) return false;

  // Treat deadline as inclusive through end-of-day.
  const endOfDay = new Date(`${deadline}T23:59:59.999`);
  if (Number.isNaN(endOfDay.getTime())) return false;

  return Date.now() > endOfDay.getTime();
}

// Get teacher's assignments
router.get('/', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await sql`SELECT * FROM assignments WHERE teacher_email = ${req.user!.email} ORDER BY created_at DESC`;
    res.json(rows.map(r => ({ id: r.id, title: r.title, instructions: r.instructions, deadline: r.deadline, code: r.code, createdAt: r.created_at, teacherEmail: r.teacher_email })));
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Validate assignment code (any authenticated user)
router.get('/code/:code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await sql`SELECT * FROM assignments WHERE code = ${req.params.code}`;
    if (rows.length === 0) return res.status(404).json({ error: 'No assignment found with this code' });
    const a = rows[0];
    if (isPastDeadline(a.deadline)) {
      return res.status(403).json({
        error: 'Assignment deadline has passed',
        message: `This assignment closed on ${a.deadline}. Submissions are no longer accepted.`,
        assignmentClosed: true,
      });
    }
    res.json({ id: a.id, title: a.title, instructions: a.instructions, deadline: a.deadline, code: a.code, teacherEmail: a.teacher_email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

// Check if student can submit to assignment (one submission only)
router.post('/check-access/:assignmentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const studentName = req.user!.email;

    const assignmentRows = await sql`
      SELECT id, deadline FROM assignments WHERE id = ${assignmentId}
    `;
    if (assignmentRows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignmentRows[0];
    if (isPastDeadline(assignment.deadline)) {
      return res.status(403).json({
        error: 'Assignment deadline has passed',
        message: `This assignment closed on ${assignment.deadline}. Submissions are no longer accepted.`,
        assignmentClosed: true,
        canAccess: false,
      });
    }

    // Check if student has already submitted to this assignment
    const existingSubmissions = await sql`
      SELECT id, status FROM submissions 
      WHERE assignment_id = ${assignmentId} AND student_name = ${studentName}
    `;

    if (existingSubmissions.length > 0) {
      const submission = existingSubmissions[0];
      console.log(`⛔ Student ${studentName} attempted to re-submit to assignment ${assignmentId} (already has submission ${submission.id})`);
      return res.status(403).json({
        error: 'Already submitted',
        message: 'You have already submitted this assignment. You can only submit once.',
        existingSubmissionId: submission.id,
        canAccess: false,
      });
    }

    console.log(`✅ Student ${studentName} is allowed to submit assignment ${assignmentId}`);
    res.json({ 
      canAccess: true, 
      message: 'You can proceed with submission' 
    });
  } catch (err) {
    console.error('Check submission access error:', err);
    res.status(500).json({ error: 'Failed to check submission access' });
  }
});

// Create assignment
router.post('/', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, instructions, deadline, code, createdAt } = req.body;
    const teacherEmail = req.user!.email;
    await sql`INSERT INTO assignments (id, title, instructions, deadline, code, created_at, teacher_email)
              VALUES (${id}, ${title}, ${instructions}, ${deadline}, ${code}, ${createdAt}, ${teacherEmail})`;
    res.json({ id, title, instructions, deadline, code, createdAt, teacherEmail });
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Delete assignment (teacher, own assignments only)
router.delete('/:id', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await sql`SELECT id, teacher_email FROM assignments WHERE id = ${req.params.id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    if (rows[0].teacher_email !== req.user!.email) {
      return res.status(403).json({ error: 'You can only delete your own assignments' });
    }

    await sql`DELETE FROM assignments WHERE id = ${req.params.id}`;
    return res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('Delete assignment error:', err);
    return res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

export default router;
