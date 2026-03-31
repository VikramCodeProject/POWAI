import { useState, useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Upload, Clock, Radio, Send, FileUp, FileText, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Navbar from '@/components/Navbar';
import LoadingScreen from '@/components/LoadingScreen';
import PageTransition from '@/components/PageTransition';
import useStore, { ActivityLog, calculateScore, Submission, SubmissionAsset } from '@/store/useStore';
import { useNavigate } from 'react-router-dom';
import { apiValidateCode, apiCreateSubmission, apiAnalyzeFile, apiAnalyzeText, apiCheckSubmissionAccess } from '@/lib/api';

type Mode = 'write' | 'upload';

const Workspace = () => {
  const [code, setCode] = useState('');
  const [assignmentCode, setAssignmentCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<SubmissionAsset[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [codeError, setCodeError] = useState('');

  // Upload mode state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
  const [isWriteSubmitting, setIsWriteSubmitting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);

  const logs = useRef<ActivityLog[]>([]);
  const lastActivity = useRef(Date.now());
  const idleTimer = useRef<ReturnType<typeof setInterval>>();
  const { user, assignments, addSubmission, setAnalyzing, theme } = useStore();
  const storeIsAnalyzing = useStore((s) => s.isAnalyzing);
  const navigate = useNavigate();

  useEffect(() => {
    if (!joined || !mode) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [joined, mode]);

  useEffect(() => {
    if (!joined || mode !== 'write') return;
    idleTimer.current = setInterval(() => {
      if (Date.now() - lastActivity.current > 30000) {
        logs.current.push({ timestamp: Date.now(), type: 'idle' });
      }
    }, 30000);
    return () => clearInterval(idleTimer.current);
  }, [joined, mode]);

  const handleEditorMount: OnMount = (editor) => {
    editor.onDidChangeModelContent((e) => {
      lastActivity.current = Date.now();
      e.changes.forEach((c) => {
        if (c.text.length > 5 && c.rangeLength === 0) {
          logs.current.push({ timestamp: Date.now(), type: 'paste', size: c.text.length, data: c.text });
        } else if (c.text.length > 0) {
          logs.current.push({ timestamp: Date.now(), type: 'keystroke' });
        } else if (c.rangeLength > 0) {
          logs.current.push({ timestamp: Date.now(), type: 'delete' });
        }
      });
    });
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const now = Date.now();
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl) return;
        setImages((prev) => [...prev, { url: dataUrl, uploadedAt: now, mimeType: file.type, fileName: file.name }]);
        logs.current.push({ timestamp: now, type: 'image_upload' });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read uploaded file'));
    reader.readAsDataURL(file);
  });

  const handleJoin = async () => {
    setCodeError('');
    const trimmedCode = code.trim();
    if (!trimmedCode) { setCodeError('Please enter an assignment code.'); return; }
    try {
      const assignment = await apiValidateCode(trimmedCode);
      
      // Check if student has already submitted to this assignment
      try {
        await apiCheckSubmissionAccess(assignment.id);
      } catch (err: any) {
        console.log('⛔ Student cannot submit:', err.message);
        setCodeError('You have already submitted this assignment. You can only submit once per assignment.');
        return;
      }

      if (!assignments.find(a => a.code === trimmedCode)) {
        useStore.getState().addAssignment(assignment);
      }
      setAssignmentCode(trimmedCode);
      setJoined(true);
    } catch (err: any) {
      setCodeError(err.message || 'Invalid code. No assignment found.');
    }
  };

  // Editor mode submit
  const handleWriteSubmit = async () => {
    if (isWriteSubmitting) return;
    setCodeError('');

    const assignment = assignments.find((a) => a.code === assignmentCode);
    if (!assignment?.id) {
      setCodeError('Unable to locate assignment details. Please rejoin with assignment code.');
      return;
    }

    if (!content || content.trim().length < 20) {
      setCodeError('Please write a meaningful response before submitting.');
      return;
    }

    setAnalyzing(true);
    setIsWriteSubmitting(true);
    try {
      const behavioral = calculateScore(logs.current, images);

      // Accuracy-first scoring based on assignment relevance and answer quality.
      const ai = await apiAnalyzeText(content, assignment.instructions || '');
      const topicRelevance = Number(ai?.topic_relevance ?? 0);
      const contentQuality = Number(ai?.content_quality ?? 0);
      const consistency = Number(ai?.writing_consistency ?? 0);
      const weightedAccuracy = Math.round((topicRelevance * 0.75) + (contentQuality * 0.2) + (consistency * 0.05));
      let finalScore = Number.isFinite(weightedAccuracy)
        ? Math.max(0, Math.min(100, weightedAccuracy))
        : 0;

      // Hard client-side guard so irrelevant answers cannot keep a passing score.
      if (topicRelevance < 10) finalScore = Math.min(finalScore, 12);
      else if (topicRelevance < 25) finalScore = Math.min(finalScore, 30);
      else if (topicRelevance < 40) finalScore = Math.min(finalScore, 45);
      if (contentQuality < 20) finalScore = Math.min(finalScore, 38);

      if (Number.isFinite(Number(ai?.overall_score))) {
        finalScore = Math.min(finalScore, Math.max(0, Math.min(100, Number(ai.overall_score))));
      }

      const status = finalScore >= 80 ? 'genuine' : finalScore >= 50 ? 'review' : 'suspicious';
      const combinedFlags = [
        ...new Set([
          ...(behavioral.flags || []),
          ...(ai?.flags || []),
          `Assignment accuracy estimate: ${finalScore}%`,
          ...(Number(ai?.ai_probability || 0) > 60 ? [`AI probability: ${ai.ai_probability}%`] : []),
        ]),
      ];

      const sub: Submission = {
        id: crypto.randomUUID(),
        studentName: user?.name || 'Student',
        assignmentId: assignment.id,
        assignmentTitle: assignment.title || 'Assignment',
        content,
        plagiarismText: content,
        activityLogs: [...logs.current],
        images,
        submittedAt: new Date().toISOString().split('T')[0],
        score: finalScore,
        flags: combinedFlags,
        status,
        scoreBreakdown: behavioral.breakdown,
        explanation: `Scored by assignment alignment and answer quality.\nTopic relevance: ${Math.round(topicRelevance)}%\nContent quality: ${Math.round(contentQuality)}%\nWriting consistency: ${Math.round(consistency)}%\n\n${ai?.summary || ''}`,
      };

      await apiCreateSubmission(sub);
      addSubmission(sub);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Typed submission analysis error:', err);
      const message = String(err?.message || 'Failed to analyze or save submission. Please try again.');
      if (message.includes('Already submitted')) {
        setCodeError('You have already submitted this assignment. Only one submission is allowed.');
      } else if (message.toLowerCase().includes('deadline has passed')) {
        setCodeError(message);
      } else {
        setCodeError(message);
      }
    } finally {
      setIsWriteSubmitting(false);
      setAnalyzing(false);
    }
  };

  // Upload mode: analyze file
  const handleFileSelect = (file: File) => {
    const valid = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!valid.includes(file.type)) {
      setCodeError('Please upload a PDF or image file (PNG, JPG, WebP).');
      return;
    }
    setUploadedFile(file);
    setAiAnalysis(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleAnalyzeAndSubmit = async () => {
    if (!uploadedFile) return;
    setCodeError('');
    setIsAnalyzingLocal(true);
    try {
      const assignment = assignments.find((a) => a.code === assignmentCode);
      if (!assignment?.id) {
        throw new Error('Unable to locate assignment details. Please rejoin with assignment code.');
      }
      const analysis = await apiAnalyzeFile(uploadedFile, assignment?.instructions || '');
      setAiAnalysis(analysis);
      const uploadedDataUrl = await fileToDataUrl(uploadedFile);

      const status = analysis.overall_score >= 80 ? 'genuine' : analysis.overall_score >= 50 ? 'review' : 'suspicious';
      const flags = [
        ...(analysis.flags || []),
        ...(analysis.ai_probability > 60 ? [`AI probability: ${analysis.ai_probability}%`] : []),
      ];

      const sub: Submission = {
        id: crypto.randomUUID(),
        studentName: user?.name || 'Student',
        assignmentId: assignment.id,
        assignmentTitle: assignment.title || 'Assignment',
        content: `[PDF/Image Upload] ${uploadedFile.name}\n\nAI Analysis: ${analysis.summary}`,
        plagiarismText: (analysis.extracted_text || '').trim(),
        activityLogs: [{ timestamp: Date.now(), type: 'image_upload' }],
        images: [{ url: uploadedDataUrl, uploadedAt: Date.now(), mimeType: uploadedFile.type, fileName: uploadedFile.name }],
        submittedAt: new Date().toISOString().split('T')[0],
        score: analysis.overall_score,
        flags,
        status,
      };
      try {
        await apiCreateSubmission(sub);
        addSubmission(sub);
      } catch (err: any) {
        console.error('Failed to persist:', err);
        // Check if error is due to duplicate submission
        if (err.message && err.message.includes('Already submitted')) {
          throw new Error('⛔ You have already submitted this assignment. Only one submission is allowed per assignment.');
        } else if (err.message && err.message.toLowerCase().includes('deadline has passed')) {
          throw new Error(err.message);
        } else {
          throw new Error(err?.message || 'Failed to save submission. Please try again.');
        }
      }
      setIsSubmitted(true);
    } catch (err: any) {
      setCodeError(err.message || 'AI analysis failed. Please try again.');
    } finally {
      setIsAnalyzingLocal(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const resetWorkspaceFlow = () => {
    setIsSubmitted(false);
    setMode(null);
    setJoined(false);
    setAssignmentCode('');
    setCode('');
    setContent('');
    setImages([]);
    setUploadedFile(null);
    setAiAnalysis(null);
    setCodeError('');
    setElapsed(0);
    logs.current = [];
  };

  const assignment = assignments.find((a) => a.code === assignmentCode);

  const renderAssignmentDetails = () => {
    if (!assignment) return null;

    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assignment Brief</p>
          {assignment.deadline && (
            <span className="text-xs text-muted-foreground">Due: {assignment.deadline}</span>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {assignment.instructions || 'No instructions provided by teacher.'}
        </p>
      </div>
    );
  };

  if (storeIsAnalyzing) return <LoadingScreen />;

  return (
    <PageTransition className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <AnimatePresence mode="wait">
        {isSubmitted ? (
          /* ─── SUCCESS SCREEN ─── */
          <motion.main key="success" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="container flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-12 sm:py-16 text-center">
            <div className="flex h-16 sm:h-20 md:h-24 w-16 sm:w-20 md:w-24 items-center justify-center rounded-full bg-green-500/20 text-green-500 mb-6 sm:mb-8 ring-8 ring-green-500/10">
              <span className="material-symbols-outlined text-[36px] sm:text-[44px] md:text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-headline mb-4 sm:mb-5">Assignment Submitted!</h1>
            {aiAnalysis && (
              <div className="mb-6 sm:mb-8 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-2xl bg-card border max-w-md w-full text-left">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Authenticity Estimate</span>
                  <span className={`text-2xl sm:text-3xl font-extrabold ${aiAnalysis.overall_score >= 80 ? 'text-green-500' : aiAnalysis.overall_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{aiAnalysis.overall_score}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">AI Probability</span><span className="font-bold">{aiAnalysis.ai_probability}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Topic Relevance</span><span className="font-bold">{aiAnalysis.topic_relevance}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Content Quality</span><span className="font-bold">{aiAnalysis.content_quality}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Consistency</span><span className="font-bold">{aiAnalysis.writing_consistency}%</span></div>
                  <div className="col-span-2 flex justify-between border-t pt-2 mt-1"><span className="text-muted-foreground">Model Confidence</span><span className="font-bold">{typeof aiAnalysis.analysis_confidence === 'number' ? `${aiAnalysis.analysis_confidence}%` : 'N/A'}</span></div>
                </div>
                <p className="mt-3 sm:mt-4 text-xs text-muted-foreground border-t pt-2.5 sm:pt-3">{aiAnalysis.summary}</p>
              </div>
            )}
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-6 sm:mb-8">Your teacher will review your submission shortly.</p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full max-w-md">
              <Button onClick={resetWorkspaceFlow} variant="outline" className="px-4 sm:px-6 py-5 sm:py-6 rounded-lg sm:rounded-xl font-bold flex gap-2 text-sm sm:text-md w-full sm:w-auto">
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">refresh</span>
                <span className="hidden sm:inline">Submit Another</span><span className="sm:hidden">Another</span>
              </Button>
              <Button
                onClick={() => {
                  resetWorkspaceFlow();
                  navigate('/workspace', { replace: true });
                }}
                className="px-4 sm:px-8 py-5 sm:py-6 rounded-lg sm:rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex gap-2 sm:gap-3 text-sm sm:text-md w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">home</span>
                <span className="hidden sm:inline">Return to Home</span><span className="sm:hidden">Home</span>
              </Button>
            </div>
          </motion.main>

        ) : !joined ? (
          /* ─── JOIN SCREEN ─── */
          <motion.main key="join" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="container flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-12 sm:py-16">
            <div className="flex h-12 sm:h-14 w-12 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10"><Radio className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /></div>
            <h1 className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-3xl font-semibold text-foreground text-center">Enter Assignment Code</h1>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground text-center">Get your code from your teacher to start.</p>
            <div className="mt-5 sm:mt-6 flex w-full max-w-xs gap-2">
              <Input placeholder="POWAI-XXXXXX" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }} className="text-center tracking-widest text-xs sm:text-sm" />
              <Button onClick={handleJoin} className="text-xs sm:text-sm">Join</Button>
            </div>
            {codeError && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-xs sm:text-sm text-destructive font-semibold">{codeError}</motion.p>}
          </motion.main>

        ) : !mode ? (
          /* ─── MODE SELECTION ─── */
          <motion.main key="mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="container flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-12 sm:py-16">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 font-headline text-center line-clamp-2">{assignment?.title || 'Assignment'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-10 text-center">How would you like to submit?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-lg w-full">
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => setMode('write')}
                className="flex flex-col items-center gap-3 sm:gap-4 p-5 sm:p-8 rounded-lg sm:rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all">
                <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-lg sm:rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <PenTool className="h-6 sm:h-8 w-6 sm:w-8 text-blue-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-foreground text-sm sm:text-lg">Write Here</h3>
                  <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Type in editor. Tracking enabled.</p>
                </div>
              </motion.button>
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => setMode('upload')}
                className="flex flex-col items-center gap-3 sm:gap-4 p-5 sm:p-8 rounded-lg sm:rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all">
                <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-lg sm:rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <Upload className="h-6 sm:h-8 w-6 sm:w-8 text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-foreground text-sm sm:text-lg">Upload File</h3>
                  <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Document (.pdf, .docx, .txt)</p>
                </div>
              </motion.button>
            </div>
          </motion.main>

        ) : mode === 'upload' ? (
          /* ─── UPLOAD MODE ─── */
          <motion.main key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-8 sm:py-12 max-w-2xl mx-auto">
            <div className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6 sm:mb-8">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-foreground font-headline">{assignment?.title || 'Assignment'}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Upload your submission for AI analysis</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
                  <button onClick={() => setMode('write')} className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-muted/60 whitespace-nowrap">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px]">edit_note</span> <span className="hidden sm:inline">Switch to</span> Write
                  </button>
                  <button onClick={() => setMode(null)} className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-muted/60 whitespace-nowrap">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px]">arrow_back</span> Back
                  </button>
                </div>
              </div>

              <details className="mb-4 sm:mb-5 rounded-lg sm:rounded-xl border bg-muted/25 px-3 sm:px-4 py-2.5 sm:py-3">
                <summary className="cursor-pointer select-none text-xs sm:text-sm font-semibold text-foreground">
                  View Assignment Instructions
                </summary>
                <div className="mt-3 text-xs sm:text-sm">{renderAssignmentDetails()}</div>
              </details>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg sm:rounded-2xl p-6 sm:p-8 md:p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : uploadedFile ? 'border-green-500/50 bg-green-500/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                onClick={() => document.getElementById('pdf-upload')?.click()}
              >
                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-lg sm:rounded-2xl bg-green-500/10 flex items-center justify-center">
                      <FileText className="h-5 sm:h-8 w-5 sm:w-8 text-green-500" />
                    </div>
                    <p className="font-bold text-foreground text-sm sm:text-base">{uploadedFile.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{(uploadedFile.size / 1024).toFixed(1)} KB • Click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-lg sm:rounded-2xl bg-muted flex items-center justify-center">
                      <Upload className="h-5 sm:h-8 w-5 sm:w-8 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-foreground text-sm sm:text-base">Drop your file here or click to browse</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Supports PDF, PNG, JPG, WebP (max 15MB)</p>
                  </div>
                )}
                <input type="file" id="pdf-upload" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              </div>

              {codeError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 sm:mt-4 text-xs sm:text-sm text-destructive font-semibold text-center">{codeError}</motion.p>}

              {/* Submit button */}
              <Button
                onClick={handleAnalyzeAndSubmit}
                disabled={!uploadedFile || isAnalyzing}
                className="w-full mt-5 sm:mt-6 h-11 sm:h-14 text-xs sm:text-base font-bold rounded-lg sm:rounded-xl gap-2"
              >
                {isAnalyzing ? (
                  <><span className="material-symbols-outlined animate-spin text-[18px] sm:text-[20px]">progress_activity</span> <span className="hidden sm:inline">Analyzing with Local ML</span><span className="sm:hidden">Analyzing</span>...</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px] sm:text-[20px]">auto_awesome</span> <span className="hidden sm:inline">Analyze & Submit</span><span className="sm:hidden">Submit</span></>
                )}
              </Button>
            </div>
          </motion.main>

        ) : (
          /* ─── WRITE MODE (Monaco Editor) ─── */
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-1 flex-col">
            <div className="border-b bg-card/80 backdrop-blur-sm">
              <div className="container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 px-4 sm:px-6 md:px-8 py-2">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <button onClick={() => setMode(null)} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-muted/60 whitespace-nowrap flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span className="hidden sm:inline">Back to</span> Modes
                  </button>
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">{assignment?.title || assignmentCode}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
                  <button onClick={() => setMode('upload')} className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-muted/60 whitespace-nowrap flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px]">upload_file</span>
                    <span className="hidden sm:inline">Switch to</span> Upload
                  </button>
                  <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm tabular-nums text-muted-foreground flex-shrink-0"><Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" /><span className="hidden sm:inline">{formatTime(elapsed)}</span><span className="sm:hidden text-[10px]">{formatTime(elapsed)}</span></div>
                  <div className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-secondary/10 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-secondary flex-shrink-0">
                    <span className="relative flex h-1.5 sm:h-2 w-1.5 sm:w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-50" /><span className="relative inline-flex h-full w-full rounded-full bg-secondary" /></span>
                    <span className="hidden sm:inline">Tracking Active</span><span className="sm:hidden">Recording</span>
                  </div>
                </div>
              </div>
              <div className="container px-4 sm:px-6 md:px-8 pb-2.5 sm:pb-3">
                <details className="rounded-lg sm:rounded-xl border bg-muted/25 px-3 sm:px-4 py-2 sm:py-3">
                  <summary className="cursor-pointer select-none text-xs sm:text-sm font-semibold text-foreground">
                    View Assignment Instructions
                  </summary>
                  <div className="mt-2.5 sm:mt-3 text-xs sm:text-sm">{renderAssignmentDetails()}</div>
                </details>
              </div>
            </div>
            <div className="flex-1">
              <Editor height="60vh" defaultLanguage="plaintext" theme={theme === 'dark' ? 'vs-dark' : 'light'} value={content} onChange={(v) => setContent(v || '')} onMount={handleEditorMount}
                options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'off', wordWrap: 'on', padding: { top: 16 }, scrollBeyondLastLine: false, renderLineHighlight: 'none' }} />
            </div>
            <div className="border-t bg-card/80 backdrop-blur-sm">
              <div className="container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full sm:w-auto">
                  <label className="flex cursor-pointer items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted hover:text-foreground whitespace-nowrap">
                    <Upload className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> <span className="hidden sm:inline">Upload</span> Handwritten
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  {images.length > 0 && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-primary/10 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-medium text-primary flex-shrink-0">
                      {images.length} image{images.length > 1 ? 's' : ''}
                    </motion.span>
                  )}
                  {codeError && (
                    <span className="text-xs font-semibold text-destructive line-clamp-1">{codeError}</span>
                  )}
                </div>
                <Button disabled={isWriteSubmitting || storeIsAnalyzing} onClick={handleWriteSubmit} size="sm" className="w-full sm:w-auto text-xs sm:text-sm gap-1.5">
                  <Send className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  <span className="hidden sm:inline">{isWriteSubmitting ? 'Submitting...' : 'Submit'}</span>
                  <span className="sm:hidden">{isWriteSubmitting ? 'Submitting...' : 'Submit'}</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Workspace;
