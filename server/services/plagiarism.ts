// Plagiarism detection service
// Uses text similarity analysis to detect potential plagiarism

interface PlagiarismResult {
  score: number; // 0-100 percentage
  matches: Array<{
    submissionId: string;
    studentName: string;
    similarity: number;
    matchedText: string[];
  }>;
  flagged: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate similarity score between two texts using cosine similarity
function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(normalizeText(text1).split(/\s+/));
  const tokens2 = new Set(normalizeText(text2).split(/\s+/));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return (intersection.size / union.size) * 100;
}

// Find similar n-grams between texts
function findMatchedSegments(text1: string, text2: string, ngramSize: number = 5): string[] {
  const normalize = (t: string) => normalizeText(t).split(/\s+/);
  
  const tokens1 = normalize(text1);
  const tokens2 = normalize(text2);

  const ngrams1 = new Set<string>();
  for (let i = 0; i <= tokens1.length - ngramSize; i++) {
    ngrams1.add(tokens1.slice(i, i + ngramSize).join(' '));
  }

  const matches: string[] = [];
  for (let i = 0; i <= tokens2.length - ngramSize; i++) {
    const ngram = tokens2.slice(i, i + ngramSize).join(' ');
    if (ngrams1.has(ngram)) {
      matches.push(ngram);
    }
  }

  return [...new Set(matches)]; // Remove duplicates
}

// Determine risk level based on similarity score
function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// Check submission against other submissions
export async function checkPlagiarism(
  currentSubmissionId: string,
  currentText: string,
  otherSubmissions: Array<{
    id: string;
    studentName: string;
    content: string;
  }>
): Promise<PlagiarismResult> {
  const matches = [];
  let maxSimilarity = 0;

  for (const other of otherSubmissions) {
    if (other.id === currentSubmissionId) continue; // Skip self
    if (!other.content || other.content.trim().length < 20) continue; // Skip empty

    const similarity = calculateSimilarity(currentText, other.content);
    
    if (similarity > 30) { // Only include matches above 30% similarity
      const matchedText = findMatchedSegments(currentText, other.content);
      matches.push({
        submissionId: other.id,
        studentName: other.studentName,
        similarity: Math.round(similarity),
        matchedText: matchedText.slice(0, 5), // Top 5 matched segments
      });
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
  }

  // Sort by similarity score (descending)
  matches.sort((a, b) => b.similarity - a.similarity);

  const riskLevel = getRiskLevel(maxSimilarity);
  const flagged = riskLevel === 'high' || (matches.length > 2 && maxSimilarity > 50);

  return {
    score: Math.round(maxSimilarity),
    matches: matches.slice(0, 5), // Top 5 matches
    flagged,
    riskLevel,
  };
}

// Quick plagiarism check against a single comparison text
export function quickPlagiarismCheck(
  submissionText: string,
  comparisonText: string
): number {
  return Math.round(calculateSimilarity(submissionText, comparisonText));
}
