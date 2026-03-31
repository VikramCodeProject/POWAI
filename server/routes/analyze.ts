import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AIServiceError, analyzeSubmission, analyzeText } from '../services/gemini.js';
import { checkPlagiarism } from '../services/plagiarism.js';
import { sql } from '../services/db.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Analyze uploaded file (PDF/image)
router.post('/file', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const instructions = req.body.instructions || '';
    const analysis = await analyzeSubmission(req.file.buffer, req.file.mimetype, instructions);
    res.json(analysis);
  } catch (err: any) {
    console.error('File analysis error:', err);
    const statusCode = err instanceof AIServiceError ? err.statusCode : 500;
    res.status(statusCode).json({
      error: err?.message || 'AI analysis failed',
      code: err instanceof AIServiceError ? err.code : 'AI_ANALYSIS_FAILED',
    });
  }
});

// Analyze text content (from editor)
router.post('/text', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { text, instructions } = req.body;
    if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Submission text too short for analysis' });

    const analysis = await analyzeText(text, instructions || '');
    res.json(analysis);
  } catch (err: any) {
    console.error('Text analysis error:', err);
    const statusCode = err instanceof AIServiceError ? err.statusCode : 500;
    res.status(statusCode).json({
      error: err?.message || 'AI analysis failed',
      code: err instanceof AIServiceError ? err.code : 'AI_ANALYSIS_FAILED',
    });
  }
});

// Check plagiarism
router.post('/plagiarism', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { text, assignmentId, submissionId } = req.body;
    if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Submission text too short for plagiarism check' });
    if (!assignmentId) return res.status(400).json({ error: 'Assignment ID required' });

    // Fetch all submissions for this assignment
    const submissions = await sql`
      SELECT id, student_name, content, plagiarism_text FROM submissions 
      WHERE assignment_id = ${assignmentId}
    `;

    const otherSubmissions = submissions.map(s => ({
      id: s.id,
      studentName: s.student_name,
      content: s.plagiarism_text || s.content || '',
    }));

    const plagiarismResult = await checkPlagiarism(submissionId || '', text, otherSubmissions);
    
    console.log(`📋 Plagiarism check for submission ${submissionId || 'NEW'}: ${plagiarismResult.score}% (${plagiarismResult.riskLevel})`);
    
    res.json(plagiarismResult);
  } catch (err: any) {
    console.error('Plagiarism check error:', err);
    res.status(500).json({
      error: err?.message || 'Plagiarism check failed',
    });
  }
});

export default router;
