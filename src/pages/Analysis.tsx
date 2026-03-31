import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Keyboard, ClipboardPaste, Timer, Pencil, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Navbar from '@/components/Navbar';
import PageTransition from '@/components/PageTransition';
import StatusBadge from '@/components/StatusBadge';
import { PlagiarismDetection } from '@/components/PlagiarismDetection';
import useStore from '@/store/useStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Editor from '@monaco-editor/react';
import { apiGetSubmissions, apiUpdateSubmissionScore } from '@/lib/api';

const Analysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.theme);
  const updateSubmissionScore = useStore((s) => s.updateSubmissionScore);
  const loadSubmissions = useStore((s) => s.loadSubmissions);
  const submission = useStore((s) => s.submissions.find((sub) => sub.id === id));
  const [editedScore, setEditedScore] = useState('');
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [scoreMessage, setScoreMessage] = useState('');

  if (!submission) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-16 text-center">
          <p className="text-muted-foreground">Submission not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>Back</Button>
        </div>
      </div>
    );
  }

  const { score, flags, activityLogs, studentName, assignmentTitle, status, content } = submission;
  const isUploadGeneratedContent = /^\[PDF\/Image Upload\]/.test((content || '').trim());
  const plagiarismSourceText = (submission.plagiarismText || submission.content || '').trim();
  const canRunPlagiarism = plagiarismSourceText.length >= 20;
  const submittedTextForView = isUploadGeneratedContent
    ? 'No direct text/code was submitted for this attempt. The student submitted file uploads only. Review the uploaded files and analysis signals above.'
    : content;

  useEffect(() => {
    setEditedScore(String(score));
  }, [score]);

  const timelineMap: Record<number, { keystrokes: number; pastes: number; deletes: number }> = {};
  activityLogs.forEach((log) => {
    const bucket = Math.floor((log.timestamp - (activityLogs[0]?.timestamp || 0)) / 30000);
    if (!timelineMap[bucket]) timelineMap[bucket] = { keystrokes: 0, pastes: 0, deletes: 0 };
    if (log.type === 'keystroke') timelineMap[bucket].keystrokes++;
    if (log.type === 'paste') timelineMap[bucket].pastes++;
    if (log.type === 'delete') timelineMap[bucket].deletes++;
  });
  const timeline = Object.entries(timelineMap).map(([k, v]) => ({ interval: `${Number(k) * 30}s`, ...v }));

  const keystrokes = activityLogs.filter((l) => l.type === 'keystroke').length;
  const pastes = activityLogs.filter((l) => l.type === 'paste').length;
  const edits = activityLogs.filter((l) => l.type === 'delete').length;

  const scoreColor = score >= 80 ? 'text-secondary' : score >= 50 ? 'text-primary' : 'text-destructive';
  const scoreBg = score >= 80 ? 'bg-secondary/10' : score >= 50 ? 'bg-primary/10' : 'bg-destructive/10';

  const breakdownItems = [
    { label: 'Keystrokes', value: keystrokes, icon: Keyboard },
    { label: 'Pastes', value: pastes, icon: ClipboardPaste },
    { label: 'Edits', value: edits, icon: Pencil },
    { label: 'Idle Events', value: activityLogs.filter((l) => l.type === 'idle').length, icon: Timer },
  ];

  const openPdfAsset = (url: string, fileName?: string) => {
    if (!url) return;

    try {
      if (url.startsWith('data:application/pdf')) {
        const separatorIndex = url.indexOf(',');
        if (separatorIndex === -1) return;

        const metadata = url.slice(0, separatorIndex);
        const payload = url.slice(separatorIndex + 1);
        const isBase64 = metadata.includes(';base64');

        let pdfBlob: Blob;

        if (isBase64) {
          const byteString = atob(payload);
          const bytes = new Uint8Array(byteString.length);
          for (let i = 0; i < byteString.length; i++) {
            bytes[i] = byteString.charCodeAt(i);
          }
          pdfBlob = new Blob([bytes], { type: 'application/pdf' });
        } else {
          pdfBlob = new Blob([decodeURIComponent(payload)], { type: 'application/pdf' });
        }

        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = fileName || 'submission.pdf';
        link.click();

        window.setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (err) {
      console.error('Unable to open PDF asset:', err);
    }
  };

  return (
    <PageTransition className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 sm:mb-5 text-muted-foreground text-xs sm:text-sm">
            <ArrowLeft className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Back
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground line-clamp-2">{studentName}</h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{assignmentTitle}</p>
            </div>
            <StatusBadge status={status} />
          </div>

          {user?.role === 'teacher' && (
            <div className="mt-4 rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Teacher Score Override</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editedScore}
                  onChange={(e) => {
                    setEditedScore(e.target.value);
                    setScoreMessage('');
                  }}
                  className="w-28"
                />
                <Button
                  disabled={isSavingScore}
                  onClick={async () => {
                    const parsed = Number(editedScore);
                    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                      setScoreMessage('Enter a valid score from 0 to 100.');
                      return;
                    }
                    if (!id) return;
                    setIsSavingScore(true);
                    setScoreMessage('');
                    try {
                      const updated = await apiUpdateSubmissionScore(id, parsed);
                      updateSubmissionScore(id, updated.score, updated.status);
                      const latestSubmissions = await apiGetSubmissions();
                      loadSubmissions(latestSubmissions);
                      setEditedScore(String(updated.score));
                      setScoreMessage('Score saved successfully.');
                    } catch (err: any) {
                      setScoreMessage(err.message || 'Failed to save score.');
                    } finally {
                      setIsSavingScore(false);
                    }
                  }}
                >
                  {isSavingScore ? 'Saving...' : 'Save Score'}
                </Button>
                {scoreMessage && <span className="text-sm text-muted-foreground">{scoreMessage}</span>}
              </div>
            </div>
          )}
        </motion.div>

        {/* Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className={`mt-6 sm:mt-8 flex flex-col items-center rounded-lg sm:rounded-2xl border p-6 sm:p-8 md:p-10 shadow-card ${scoreBg}`}
        >
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">Authenticity Score</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.35 }}
            className={`mt-2 sm:mt-3 text-5xl sm:text-6xl md:text-7xl font-bold ${scoreColor}`}
          >
            {score}
          </motion.p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">out of 100</p>
        </motion.div>

        {/* Score Explanation */}
        {submission.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="mt-6 rounded-2xl border bg-blue-50/50 dark:bg-blue-900/20 p-5 border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-start gap-3">
              <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Score Explanation</p>
                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{submission.explanation}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Score Breakdown by Factor */}
        {submission.scoreBreakdown && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-6 sm:mt-8 rounded-lg sm:rounded-2xl border bg-card p-4 sm:p-6 shadow-card"
          >
            <h3 className="mb-4 text-sm sm:text-base font-medium text-muted-foreground">Score Breakdown by Factor</h3>
            <div className="space-y-3 sm:space-y-4">
              {[
                { name: 'Paste Analysis', data: submission.scoreBreakdown.pasteAnalysis },
                { name: 'Typing Rhythm', data: submission.scoreBreakdown.typingRhythm },
                { name: 'Revision Pattern', data: submission.scoreBreakdown.revisionPattern },
                { name: 'Consistency', data: submission.scoreBreakdown.consistencyMetrics }
              ].map((factor, i) => (
                <div key={i} className="border border-border rounded-lg p-3 sm:p-4 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2">
                    <p className="font-semibold text-xs sm:text-sm text-foreground">{factor.name}</p>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="font-bold text-primary">{factor.data.score}</span>
                      <span className="text-muted-foreground">/ 100</span>
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] sm:text-xs font-medium">
                        {Math.round(factor.data.weight * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        factor.data.score >= 80 ? 'bg-secondary' :
                        factor.data.score >= 50 ? 'bg-primary' :
                        'bg-destructive'
                      }`}
                      style={{ width: `${factor.data.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{factor.data.explanation}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Breakdown */}
        <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {breakdownItems.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.07 }}
              className="rounded-lg sm:rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-card transition-all duration-200 hover:shadow-card-hover"
            >
              <item.icon className="mx-auto h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
              <p className="mt-2 text-lg sm:text-xl font-semibold text-foreground">{item.value}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{item.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Flags */}
        {flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="mt-6 sm:mt-8 rounded-lg sm:rounded-2xl border border-destructive/20 bg-destructive/5 p-4 sm:p-5"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Flags Detected
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {flags.map((f, i) => (
                <li key={i} className="text-xs sm:text-sm text-destructive/80 line-clamp-2">• {f}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.55 }}
            className="mt-6 sm:mt-8 rounded-lg sm:rounded-2xl border bg-card p-4 sm:p-6 shadow-card overflow-x-auto"
          >
            <h3 className="mb-4 sm:mb-5 text-xs sm:text-sm font-medium text-muted-foreground">Activity Timeline</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="interval" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="keystrokes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pastes" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Uploaded Assets (images + pdf) */}
        {submission.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="mt-6 rounded-2xl border bg-card p-6 shadow-card"
          >
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">Uploaded Student Files</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {submission.images.map((img, i) => {
                const isPdf = img.mimeType === 'application/pdf' || img.url.startsWith('data:application/pdf');
                if (isPdf) {
                  return (
                    <div key={i} className="rounded-xl border p-4 bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{img.fileName || `Document ${i + 1}`}</p>
                          <p className="text-xs text-muted-foreground">PDF submission</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPdfAsset(img.url, img.fileName)}
                        >
                          View PDF
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="rounded-xl border overflow-hidden bg-muted/20">
                    <img src={img.url} alt={img.fileName || `Uploaded file ${i + 1}`} className="h-44 w-full object-cover" />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        {/* Submitted Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.65 }}
          className="mt-6 rounded-2xl border bg-card p-6 shadow-card"
        >
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Submitted Text / Code</h3>
          <div className="rounded-xl border overflow-hidden">
            <Editor
              height="300px"
              defaultLanguage="plaintext"
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={submittedTextForView || 'No text content submitted.'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          </div>
        </motion.div>

        {/* Plagiarism Detection */}
        <div className="mt-6">
          <PlagiarismDetection
            submissionText={plagiarismSourceText}
            assignmentId={submission.assignmentId}
            submissionId={id!}
            studentName={studentName}
            isEnabled={canRunPlagiarism}
          />
        </div>

        {/* Pasted Snippets Box */}
        {activityLogs.some((l) => l.type === 'paste' && l.data) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
            className="mt-6 rounded-2xl border bg-card p-6 shadow-card"
          >
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">Captured Paste Events</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {activityLogs.filter((l) => l.type === 'paste' && l.data).map((log, i) => (
                <div key={i} className="rounded-lg bg-muted/30 p-4 border border-border/50 text-sm font-mono text-muted-foreground whitespace-pre-wrap break-words">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-destructive mb-3 border-b border-border/50 pb-2">
                    <span className="flex items-center gap-1.5"><ClipboardPaste className="w-3 h-3"/> Paste Event {i + 1}</span>
                    <span>{log.size} characters</span>
                  </div>
                  {log.data}
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </main>
    </PageTransition>
  );
};

export default Analysis;
