import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Loader } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiCheckPlagiarism } from '@/lib/api';

interface PlagiarismMatch {
  submissionId: string;
  studentName: string;
  similarity: number;
  matchedText: string[];
}

interface PlagiarismResult {
  score: number;
  matches: PlagiarismMatch[];
  flagged: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

interface PlagiarismDetectionProps {
  submissionText: string;
  assignmentId: string;
  submissionId: string;
  studentName: string;
  isEnabled?: boolean;
}

export const PlagiarismDetection = ({
  submissionText,
  assignmentId,
  submissionId,
  studentName,
  isEnabled = true,
}: PlagiarismDetectionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const checkPlagiarism = async () => {
    if (!submissionText.trim()) {
      toast.error('No submission text to check');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiCheckPlagiarism({
        text: submissionText,
        assignmentId,
        submissionId,
      });
      setResult(data);
      
      if (data.flagged) {
        toast.warning(`⚠️ High plagiarism risk detected: ${data.score}%`);
      } else {
        toast.success(`✓ Plagiarism check complete: ${data.score}% similarity`);
      }
    } catch (error) {
      console.error('Plagiarism check error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to check plagiarism');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isEnabled) return;
    if (!submissionText?.trim() || submissionText.trim().length < 20) return;
    void checkPlagiarism();
    // Run once when submission changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, isEnabled]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300';
      case 'low':
        return 'bg-secondary/10 border-secondary/30 text-secondary';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Plagiarism Detection</CardTitle>
                <CardDescription>Check {studentName}'s content similarity with other submissions</CardDescription>
              </div>
            </div>
            {result && (
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{result.score}%</div>
                <Badge className={`text-xs font-semibold ${getRiskColor(result.riskLevel)}`}>
                  {result.riskLevel.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isEnabled && (
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-4 text-sm text-muted-foreground">
              Plagiarism check is unavailable because readable text could not be extracted (or was too short). For file uploads, ensure the PDF/image contains clear selectable text.
            </div>
          )}

          {!result ? (
            <motion.button
              onClick={checkPlagiarism}
              disabled={isLoading || !isEnabled}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {!isEnabled ? (
                <>
                  <Shield className="w-4 h-4" />
                  Not Available For Upload Submission
                </>
              ) : isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Check for Plagiarism
                </>
              )}
            </motion.button>
          ) : (
            <motion.div className="space-y-4">
              <div className={`p-4 rounded-lg border ${getRiskColor(result.riskLevel)}`}>
                <div className="flex items-start gap-3">
                  {result.flagged && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-sm">
                      {result.flagged
                        ? '⚠️ Plagiarism Risk Detected'
                        : '✓ Plagiarism Check Passed'}
                    </p>
                    <p className="text-xs mt-1 opacity-90">
                      {result.score}% similarity detected
                      {result.matches.length > 0
                        ? ` with ${result.matches.length} other submission${result.matches.length !== 1 ? 's' : ''}`
                        : ' - No significant matches found'}
                    </p>
                  </div>
                </div>
              </div>

              {result.matches.length > 0 && (
                <div>
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    {expanded ? '▼' : '▶'} View {result.matches.length} matching submission
                    {result.matches.length !== 1 ? 's' : ''}
                  </button>

                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {result.matches.map((match, idx) => (
                        <motion.div
                          key={match.submissionId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm">{match.studentName}</p>
                            <Badge variant={match.similarity >= 70 ? 'destructive' : 'secondary'}>
                              {match.similarity}% match
                            </Badge>
                          </div>
                          {match.matchedText.length > 0 && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                              <p className="font-semibold">Matched segments:</p>
                              {match.matchedText.slice(0, 2).map((text, i) => (
                                <p key={i} className="italic opacity-75">
                                  "{text.length > 60 ? text.substring(0, 60) + '...' : text}"
                                </p>
                              ))}
                              {match.matchedText.length > 2 && (
                                <p className="opacity-50">
                                  +{match.matchedText.length - 2} more matches
                                </p>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              )}

              <Button
                onClick={checkPlagiarism}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isLoading ? 'Checking...' : 'Re-check'}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
