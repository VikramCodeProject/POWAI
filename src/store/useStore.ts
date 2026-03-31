import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ───────── Types ───────── */
export interface Assignment {
  id: string;
  title: string;
  instructions: string;
  deadline: string;
  code: string;
  createdAt: string;
  teacherEmail?: string;
}

export interface ActivityLog {
  timestamp: number;
  type: 'keystroke' | 'paste' | 'delete' | 'idle' | 'image_upload';
  data?: string;
  size?: number;
}

export interface SubmissionAsset {
  url: string;
  uploadedAt: number;
  mimeType?: string;
  fileName?: string;
}

export interface ScoreBreakdown {
  pasteAnalysis: { score: number; weight: number; explanation: string };
  typingRhythm: { score: number; weight: number; explanation: string };
  revisionPattern: { score: number; weight: number; explanation: string };
  consistencyMetrics: { score: number; weight: number; explanation: string };
  overall: number;
}

export interface Submission {
  id: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  content: string;
  plagiarismText?: string;
  activityLogs: ActivityLog[];
  images: SubmissionAsset[];
  submittedAt: string;
  score: number;
  flags: string[];
  status: 'genuine' | 'suspicious' | 'review';
  teacherEmail?: string;
  scoreBreakdown?: ScoreBreakdown;
  explanation?: string;
}

interface AppState {
  /* Auth */
  user: { name: string; email: string; role: 'teacher' | 'student' } | null;
  registeredUsers: { name: string; email: string; password?: string; role: 'teacher' | 'student' }[];
  setUser: (user: AppState['user']) => void;
  registerUser: (user: AppState['registeredUsers'][0]) => void;
  logout: () => void;

  /* Theme */
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  /* Assignments */
  assignments: Assignment[];
  addAssignment: (a: Assignment) => void;

  /* Submissions */
  submissions: Submission[];
  addSubmission: (s: Submission) => void;
  updateSubmissionScore: (id: string, score: number, status: Submission['status']) => void;

  /* Loading */
  isAnalyzing: boolean;
  setAnalyzing: (v: boolean) => void;

  /* API data hydration */
  loadSubmissions: (subs: Submission[]) => void;
  loadAssignments: (assignments: Assignment[]) => void;
}

/* ───────── Typing Rhythm Analysis ───────── */
function calculateTypingRhythm(logs: ActivityLog[]): { score: number; iki: number; consistency: number; flags: string[] } {
  const keystrokes = logs.filter(l => l.type === 'keystroke').sort((a, b) => a.timestamp - b.timestamp);
  const flags: string[] = [];
  
  if (keystrokes.length < 5) {
    return { score: 75, iki: 0, consistency: 0, flags };
  }

  // Calculate inter-keystroke intervals (IKI) in milliseconds
  const intervals: number[] = [];
  for (let i = 1; i < keystrokes.length; i++) {
    intervals.push(keystrokes[i].timestamp - keystrokes[i - 1].timestamp);
  }

  const avgIKI = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, iki) => sum + (iki - avgIKI) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - (stdDev / avgIKI) * 100); // Lower stdDev = higher consistency

  let rhythmScore = 100;

  // Flag extremely inconsistent typing (likely paste bursts mixed with pauses)
  if (consistency < 30) {
    rhythmScore -= 25;
    flags.push(`Highly erratic typing rhythm (${Math.round(consistency)}% consistency)`);
  } else if (consistency < 50) {
    rhythmScore -= 10;
    flags.push(`Inconsistent typing rhythm (${Math.round(consistency)}% consistency)`);
  } else if (consistency >= 80) {
    rhythmScore += 5; // Bonus for naturally consistent rhythm
    flags.push(`Natural, consistent typing rhythm detected`);
  }

  // Detect abnormal speed bursts (very fast keystrokes followed by slow pauses)
  let fastBursts = 0;
  let slowPauses = 0;
  for (const iki of intervals) {
    if (iki < 30) fastBursts++;
    if (iki > 800) slowPauses++;
  }

  const burstRatio = fastBursts / intervals.length;
  if (burstRatio > 0.6) {
    rhythmScore -= 15;
    flags.push(`Suspicious rapid typing bursts detected (${Math.round(burstRatio * 100)}% of strokes)`);
  }

  // Detect unusual pause patterns (pauses followed immediately by paste = copy-paste)
  let pausePrePaste = 0;
  for (let i = 0; i < logs.length - 1; i++) {
    if (logs[i].type === 'keystroke' && logs[i + 1].type === 'paste') {
      const timeDiff = logs[i + 1].timestamp - logs[i].timestamp;
      if (timeDiff > 1000) pausePrePaste++; // Long pause then paste
    }
  }

  if (pausePrePaste > 2) {
    rhythmScore -= 12;
    flags.push(`${pausePrePaste} instances of pause followed by paste (copy-paste pattern)`);
  }

  return {
    score: Math.max(0, Math.min(100, rhythmScore)),
    iki: Math.round(avgIKI),
    consistency: Math.round(consistency),
    flags
  };
}

/* ───────── Scoring logic with breakdown ───────── */
export function calculateScore(logs: ActivityLog[], images: SubmissionAsset[]): { 
  score: number; 
  flags: string[]; 
  breakdown: ScoreBreakdown;
  explanation: string;
} {
  const pastes = logs.filter(l => l.type === 'paste');
  const keystrokes = logs.filter(l => l.type === 'keystroke');
  const deletes = logs.filter(l => l.type === 'delete');
  const flags: string[] = [];

  // ─── 1. PASTE ANALYSIS ───
  let pasteAnalysisScore = 100;
  let totalPastedChars = 0;
  
  pastes.forEach(p => {
    const size = p.size || 0;
    totalPastedChars += size;
    if (size > 200) {
      pasteAnalysisScore -= 25;
      flags.push(`Massive paste detected (${size} chars)`);
    } else if (size > 50) {
      pasteAnalysisScore -= 10;
      flags.push(`Large paste detected (${size} chars)`);
    }
  });

  const totalTypedChars = keystrokes.length;
  const totalContentSize = Math.max(1, totalTypedChars + totalPastedChars);
  const pasteRatio = totalPastedChars / totalContentSize;

  if (pasteRatio > 0.6) {
    pasteAnalysisScore -= 30;
    flags.push(`Suspiciously high paste ratio (${Math.round(pasteRatio * 100)}% of content)`);
  } else if (pasteRatio > 0.3) {
    pasteAnalysisScore -= 10;
    flags.push(`Moderate paste ratio (${Math.round(pasteRatio * 100)}% of content)`);
  }

  pasteAnalysisScore = Math.max(0, Math.min(100, pasteAnalysisScore));

  // ─── 2. TYPING RHYTHM ANALYSIS ───
  const rhythmData = calculateTypingRhythm(logs);
  flags.push(...rhythmData.flags);

  // ─── 3. REVISION PATTERN ANALYSIS ───
  let revisionScore = 100;
  let revisionExplanation = 'Natural revision pattern';

  if (keystrokes.length > 50) {
    const revisionRatio = deletes.length / keystrokes.length;
    if (revisionRatio === 0) {
      revisionScore -= 15;
      revisionExplanation = 'Zero backspaces - unnatural typing pattern';
      flags.push('Zero backspaces/deletions (unnatural typing pattern)');
    } else if (revisionRatio < 0.01) {
      revisionScore -= 5;
      revisionExplanation = 'Extremely low revision rate';
      flags.push('Extremely low revision rate');
    } else if (revisionRatio > 0.05 && revisionRatio < 0.30) {
      revisionScore += 5;
      revisionExplanation = `Healthy revision rate (${Math.round(revisionRatio * 100)}%) indicates deliberate work`;
    }

    // WPM Analysis
    const firstKey = keystrokes[0].timestamp;
    const lastKey = keystrokes[keystrokes.length - 1].timestamp;
    const timeInSeconds = Math.max(1, (lastKey - firstKey) / 1000);
    const wpm = (keystrokes.length / 5) / (timeInSeconds / 60);

    if (wpm > 120 && keystrokes.length > 200) {
      revisionScore -= 20;
      revisionExplanation = `Superhuman typing speed (${Math.round(wpm)} WPM) - likely assisted`;
      flags.push(`Superhuman typing speed (${Math.round(wpm)} WPM)`);
    }
  }

  revisionScore = Math.max(0, Math.min(100, revisionScore));

  // ─── 4. CONSISTENCY METRICS ───
  let consistencyScore = 100;
  let consistencyExplanation = 'Consistent submission patterns';

  let suspiciousIdles = 0;
  for (let i = 0; i < logs.length - 1; i++) {
    const current = logs[i];
    const next = logs[i + 1];
    if (current.type === 'idle' && next.type === 'paste' && (next.size || 0) > 50) {
      suspiciousIdles++;
    }
  }

  if (suspiciousIdles > 0) {
    consistencyScore -= suspiciousIdles * 15;
    consistencyExplanation = `${suspiciousIdles} idle-to-paste pattern(s) - suspicious timing`;
    flags.push(`Idle period immediately followed by large paste (${suspiciousIdles}x)`);
  }

  if (images.length > 1) {
    const timestamps = images.map(i => i.uploadedAt).sort();
    const allSameTime = timestamps.every((t, i) => i === 0 || t - timestamps[i - 1] < 5000);
    if (allSameTime) {
      consistencyScore -= 10;
      consistencyExplanation = 'All images uploaded simultaneously - unusual pattern';
      flags.push('All images uploaded simultaneously');
    }
  }

  consistencyScore = Math.max(0, Math.min(100, consistencyScore));

  // ─── CALCULATE WEIGHTED SCORE ───
  const weights = { paste: 0.25, rhythm: 0.30, revision: 0.25, consistency: 0.20 };
  const overallScore = Math.round(
    pasteAnalysisScore * weights.paste +
    rhythmData.score * weights.rhythm +
    revisionScore * weights.revision +
    consistencyScore * weights.consistency
  );

  // ─── GENERATE EXPLANATION ───
  const scoreFactors = [
    `Paste Analysis: ${pasteAnalysisScore}% (${pasteRatio > 0.6 ? 'high paste ratio' : pasteRatio > 0.3 ? 'moderate paste activity' : 'minimal paste activity'})`,
    `Typing Rhythm: ${rhythmData.score}% (${rhythmData.consistency}% consistency, avg keystroke interval: ${rhythmData.iki}ms)`,
    `Revision Pattern: ${revisionScore}% (${revisionExplanation})`,
    `Consistency: ${consistencyScore}% (${consistencyExplanation})`
  ];

  const explanation = `Score Breakdown:\n${scoreFactors.join('\n')}\n\nOverall: ${overallScore}% - ${overallScore >= 80 ? 'Appears Genuine' : overallScore >= 50 ? 'Needs Review' : 'Highly Suspicious'}`;

  const breakdown: ScoreBreakdown = {
    pasteAnalysis: {
      score: pasteAnalysisScore,
      weight: weights.paste,
      explanation: `${Math.round(pasteRatio * 100)}% of content from pastes. ${pasteRatio > 0.6 ? 'Suspiciously high' : pasteRatio > 0.3 ? 'Moderate' : 'Low'} paste ratio.`
    },
    typingRhythm: {
      score: rhythmData.score,
      weight: weights.rhythm,
      explanation: `${rhythmData.consistency}% consistency, ${rhythmData.iki}ms avg interval. ${rhythmData.flags.length > 0 ? rhythmData.flags[0] : 'Natural rhythm detected.'}`
    },
    revisionPattern: {
      score: revisionScore,
      weight: weights.revision,
      explanation: revisionExplanation
    },
    consistencyMetrics: {
      score: consistencyScore,
      weight: weights.consistency,
      explanation: consistencyExplanation
    },
    overall: overallScore
  };

  return {
    score: overallScore,
    flags,
    breakdown,
    explanation
  };
}

/* ───────── Generate assignment code ───────── */
function generateCode(): string {
  return 'POWAI-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* ───────── Store ───────── */
const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      registeredUsers: [],
      setUser: (user) => set({ user }),
      registerUser: (user) => set((s) => ({ registeredUsers: [...s.registeredUsers, user] })),
      logout: () => { localStorage.removeItem('powai-token'); set({ user: null }); },

      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      assignments: [],
      addAssignment: (a) => set((s) => ({ assignments: [...s.assignments, { ...a, code: a.code || generateCode(), teacherEmail: a.teacherEmail || s.user?.email }] })),

      submissions: [],
      addSubmission: (sub) => set((s) => {
        const assignment = s.assignments.find(a => a.id === sub.assignmentId);
        return { submissions: [...s.submissions, { ...sub, teacherEmail: assignment?.teacherEmail }] };
      }),
      updateSubmissionScore: (id, score, status) => set((s) => ({
        submissions: s.submissions.map((sub) => (
          sub.id === id ? { ...sub, score, status } : sub
        )),
      })),

      isAnalyzing: false,
      setAnalyzing: (v) => set({ isAnalyzing: v }),

      loadSubmissions: (subs) => set({ submissions: subs }),
      loadAssignments: (assignments) => set({ assignments }),
    }),
    {
      name: 'powai-storage', // unique name
      version: 1, // Adding version clears legacy dummy data from user's localStorage
    }
  )
);

export default useStore;
