import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, ArrowLeft, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Navbar from '@/components/Navbar';
import PageTransition from '@/components/PageTransition';
import useStore, { Assignment } from '@/store/useStore';
import { apiCreateAssignment } from '@/lib/api';

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

function normalizeExtractedText(raw: string): string {
  const text = raw
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const lines = text.split('\n').map((line) => line.trim());
  const cleaned: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (cleaned[cleaned.length - 1] !== '') cleaned.push('');
      continue;
    }

    const isSectionHeader = /^(assignment|task|objective|instructions?|requirements?|grading|submission|deadline)\b/i.test(line);
    const isListItem = /^([\-\u2022*]|\d+[.)]|[a-z][.)])\s+/i.test(line);

    if (isSectionHeader && cleaned.length > 0 && cleaned[cleaned.length - 1] !== '') {
      cleaned.push('');
    }

    cleaned.push(line);

    if (isListItem) {
      // Keep list items visually separated for readability in the textarea.
      if (cleaned[cleaned.length - 1] !== '') cleaned.push('');
    }
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function rebuildPdfLines(items: PdfTextItem[]): string {
  const positioned = items
    .map((item) => {
      const str = (item.str || '').trim();
      if (!str) return null;
      const x = item.transform?.[4] ?? 0;
      const y = item.transform?.[5] ?? 0;
      return { str, x, y, width: item.width ?? 0 };
    })
    .filter(Boolean) as Array<{ str: string; x: number; y: number; width: number }>;

  // Group tokens by visual row (Y coordinate), then sort left-to-right.
  const rows = new Map<number, Array<{ str: string; x: number; width: number }>>();
  for (const token of positioned) {
    const rowKey = Math.round(token.y / 3) * 3;
    const existing = rows.get(rowKey) || [];
    existing.push({ str: token.str, x: token.x, width: token.width });
    rows.set(rowKey, existing);
  }

  const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => b - a);
  const lineTexts: string[] = [];

  for (const key of sortedRowKeys) {
    const row = (rows.get(key) || []).sort((a, b) => a.x - b.x);
    let line = '';
    let prevEndX: number | null = null;

    for (const token of row) {
      if (prevEndX !== null) {
        const gap = token.x - prevEndX;
        if (gap > 10) line += ' ';
      }
      if (line && !line.endsWith(' ')) line += ' ';
      line += token.str;
      prevEndX = token.x + token.width;
    }

    lineTexts.push(line.trim());
  }

  return lineTexts.join('\n');
}

const CreateAssignment = () => {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [created, setCreated] = useState<Assignment | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const addAssignment = useStore((s) => s.addAssignment);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsExtracting(true);
      let extractedText = '';

      if (file.name.toLowerCase().endsWith('.txt')) {
        extractedText = await file.text();
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        
        // Dynamically import pdfjs to prevent it from crashing the app on load
        const pdfjsLib = await import('pdfjs-dist');
        const pdfWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const numPages = pdf.numPages;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const pageText = rebuildPdfLines(textContent.items as PdfTextItem[]);

          if (pageText.trim()) {
            extractedText += `Page ${i}\n${pageText.trim()}\n\n`;
          }
        }
      } else {
        alert('Unsupported format. Please select a .pdf or .txt file.');
        return;
      }

      const cleaned = normalizeExtractedText(extractedText);
      setInstructions(prev => (prev ? `${prev.trim()}\n\n${cleaned}` : cleaned).trim());
    } catch (error) {
      console.error("Error extracting text:", error);
      alert('Failed to extract text from the file.');
    } finally {
      setIsExtracting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = useStore.getState().user;
    const code = 'POWAI-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const assignment: Assignment = {
      id: crypto.randomUUID(),
      title, instructions, deadline, code,
      createdAt: new Date().toISOString().split('T')[0],
      teacherEmail: currentUser?.email,
    };
    
    try {
      // Save via Express API (server handles DB + auth)
      await apiCreateAssignment(assignment);
      addAssignment(assignment);
      setCreated(assignment);
    } catch (err: any) {
      console.error('Create assignment error:', err);
      if (err.message === 'Authentication required') {
        alert('Session expired. Please log in again.');
        useStore.getState().logout();
        navigate('/auth');
        return;
      }
      alert(err.message || 'Failed to create assignment.');
    }
  };

  const copyCode = () => {
    if (created) {
      navigator.clipboard.writeText(created.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <PageTransition className="min-h-screen bg-[#f8f9fa] dark:bg-slate-950 font-body relative overflow-hidden isolate">
      {/* Background decoration */}
      <div className="absolute inset-0 subtle-dot-bg dark:opacity-20 -z-20 pointer-events-none"></div>
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/5 blur-[120px] rounded-full -translate-y-1/4 translate-x-1/4 -z-10 pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#545f73]/10 dark:bg-[#545f73]/20 blur-[120px] rounded-full translate-y-1/4 -translate-x-1/4 -z-10 pointer-events-none"
      />
      
      <Navbar />
      <main className="container max-w-3xl px-4 py-16">
        <AnimatePresence mode="wait">
          {!created ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              onSubmit={handleSubmit}
              className="flex flex-col"
            >
              <button 
                type="button"
                onClick={() => navigate('/dashboard')} 
                className="flex items-center gap-2 text-xs sm:text-sm font-bold tracking-widest uppercase text-[#545f73] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition-colors mb-4 sm:mb-6 self-start"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </button>

              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.05)] border border-[#e2e9ec] dark:border-slate-800 overflow-hidden">
                <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8 border-b border-[#e2e9ec] dark:border-slate-800 bg-[#f8f9fa]/50 dark:bg-slate-900/50">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E293B] dark:text-white font-headline">Create Assignment</h1>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-[#545f73] dark:text-slate-400">Configure parameters and attach instructions for your students.</p>
                </div>
                
                <div className="p-4 sm:p-6 md:p-10 space-y-4 sm:space-y-6">
                  <div className="space-y-2 flex flex-col">
                    <Label htmlFor="title" className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Assignment Title</Label>
                    <Input 
                      id="title" 
                      required 
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)} 
                      placeholder="e.g. Introduction to Network Security..." 
                      className="h-10 sm:h-12 bg-[#f8f9fa] dark:bg-slate-950 border-[#e2e9ec] dark:border-slate-800 rounded-lg sm:rounded-xl px-3 sm:px-4 font-medium text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                    />
                  </div>

                  <div className="space-y-2 flex flex-col">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="instructions" className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Instructions</Label>
                      <label htmlFor="file-upload" className={`cursor-pointer inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${isExtracting ? 'text-slate-400 bg-slate-100 dark:bg-slate-800' : 'text-primary bg-primary/10 hover:bg-primary/20'}`}>
                        <FileUp className="h-3.5 w-3.5" />
                        {isExtracting ? 'Processing...' : 'Import TXT / PDF'}
                      </label>
                      <input type="file" id="file-upload" accept=".txt,.pdf" className="hidden" disabled={isExtracting} onChange={handleFileUpload} />
                    </div>
                    <Textarea 
                      id="instructions" 
                      required 
                      value={instructions} 
                      onChange={(e) => setInstructions(e.target.value)} 
                      placeholder="Write or paste your detailed assignment instructions here..." 
                      rows={6}
                      className="bg-[#f8f9fa] dark:bg-slate-950 border-[#e2e9ec] dark:border-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-4 font-medium text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-sm resize-y"
                    />
                  </div>

                  <div className="space-y-2 flex flex-col">
                    <Label htmlFor="deadline" className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Submission Deadline</Label>
                    <Input 
                      id="deadline" 
                      type="date" 
                      required 
                      value={deadline} 
                      onChange={(e) => setDeadline(e.target.value)} 
                      className="h-10 sm:h-12 bg-[#f8f9fa] dark:bg-slate-950 border-[#e2e9ec] dark:border-slate-800 rounded-lg sm:rounded-xl px-3 sm:px-4 font-medium text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-sm w-full sm:w-1/2"
                    />
                  </div>
                </div>

                <div className="px-4 sm:px-6 md:px-10 py-4 sm:py-6 bg-[#f8f9fa] dark:bg-slate-900 border-t border-[#e2e9ec] dark:border-slate-800">
                  <Button type="submit" className="w-full text-sm sm:text-base h-11 sm:h-14 bg-[#1E293B] text-white hover:bg-[#1E293B]/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 rounded-lg sm:rounded-xl font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-px">
                    Deploy Assignment
                  </Button>
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-4 sm:space-y-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
                className="mx-auto flex h-12 sm:h-16 w-12 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-secondary/10"
              >
                <Check className="h-6 sm:h-8 w-6 sm:w-8 text-secondary" />
              </motion.div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">Assignment Created!</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Share the code below with your students.</p>

              <div className="mx-auto flex max-w-xs items-center gap-2 rounded-lg sm:rounded-xl border bg-muted/50 px-3 sm:px-5 py-2.5 sm:py-3.5">
                <code className="flex-1 text-center text-base sm:text-lg font-bold tracking-[0.1em] sm:tracking-[0.2em] text-foreground text-sm sm:text-base">{created.code}</code>
                <button type="button" onClick={copyCode} className="rounded-lg p-1 sm:p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {copied ? <Check className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-secondary" /> : <Copy className="h-3.5 sm:h-4 w-3.5 sm:w-4" />}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-2.5 sm:gap-3">
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="text-xs sm:text-sm h-10 sm:h-auto">Back to Dashboard</Button>
                <Button onClick={() => { setCreated(null); setTitle(''); setInstructions(''); setDeadline(''); }} className="text-xs sm:text-sm h-10 sm:h-auto">
                  Create Another
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
};

export default CreateAssignment;
