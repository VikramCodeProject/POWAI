// Plagiarism detection service
// Uses semantic chunk-based similarity to detect paraphrased plagiarism

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

interface SemanticChunk {
  index: number;
  text: string;
  concepts: string[];
  freq: Map<string, number>;
}

const CHUNK_WORD_TARGET = 130;
const CHUNK_OVERLAP = 35;
const PAIR_CANDIDATES = 10;
const MIN_TEXT_LENGTH = 20;
const MIN_CONCEPT_TOKENS = 18;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
  'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'this', 'those', 'these',
  'you', 'your', 'our', 'they', 'them', 'their', 'or', 'if', 'not', 'but', 'than', 'then', 'can',
  'could', 'would', 'should', 'into', 'about', 'after', 'before', 'while', 'also', 'such', 'very',
  'more', 'most', 'some', 'any', 'all', 'each', 'other', 'which', 'what', 'when', 'where', 'how',
]);

const CONCEPT_MAP: Record<string, string> = {
  algorithm: 'logic',
  method: 'logic',
  approach: 'logic',
  technique: 'logic',
  student: 'learner',
  learners: 'learner',
  pupil: 'learner',
  solution: 'answer',
  solve: 'answer',
  solved: 'answer',
  answers: 'answer',
  analyze: 'evaluate',
  analysis: 'evaluate',
  evaluated: 'evaluate',
  assessment: 'evaluate',
  plagiarized: 'plagiarism',
  copied: 'plagiarism',
  copying: 'plagiarism',
  duplicate: 'plagiarism',
  duplicated: 'plagiarism',
  semantic: 'meaning',
  meaningfully: 'meaning',
  meaning: 'meaning',
  text: 'content',
  paragraph: 'content',
  essay: 'content',
  code: 'content',
  program: 'content',
  explain: 'describe',
  explained: 'describe',
  describing: 'describe',
};

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function stemToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('ly') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 4) return token.slice(0, -1);
  return token;
}

function toConcept(token: string): string {
  const base = stemToken(token);
  return CONCEPT_MAP[base] || base;
}

function tokenizeConcepts(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map(toConcept);
}

function buildFrequencyMap(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

function cosineFromFrequency(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [, value] of a) normA += value * value;
  for (const [, value] of b) normB += value * value;

  for (const [key, value] of a) {
    const other = b.get(key) || 0;
    dot += value * other;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function bigramDice(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length < 2 || tokensB.length < 2) return 0;

  const toBigrams = (tokens: string[]) => {
    const set = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      set.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return set;
  };

  const a = toBigrams(tokensA);
  const b = toBigrams(tokensB);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

function semanticSimilarity(textA: string, textB: string): number {
  const tokensA = tokenizeConcepts(textA);
  const tokensB = tokenizeConcepts(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const conceptCosine = cosineFromFrequency(buildFrequencyMap(tokensA), buildFrequencyMap(tokensB));
  const sequenceDice = bigramDice(tokensA, tokensB);

  // Blend concept overlap and sequence clues to catch paraphrasing with preserved idea flow.
  return conceptCosine * 0.78 + sequenceDice * 0.22;
}

function informationDensity(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
}

function lengthBalanceFactor(lengthA: number, lengthB: number): number {
  if (lengthA <= 0 || lengthB <= 0) return 0;
  const ratio = Math.min(lengthA, lengthB) / Math.max(lengthA, lengthB);
  if (ratio >= 0.75) return 1;
  if (ratio >= 0.5) return 0.93;
  if (ratio >= 0.3) return 0.82;
  return 0.7;
}

function chunkText(text: string): SemanticChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: SemanticChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < words.length) {
    const end = Math.min(words.length, start + CHUNK_WORD_TARGET);
    const chunkTextValue = words.slice(start, end).join(' ');
    chunks.push({
      index,
      text: chunkTextValue,
      concepts: tokenizeConcepts(chunkTextValue),
      freq: buildFrequencyMap(tokenizeConcepts(chunkTextValue)),
    });
    if (end === words.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
    index += 1;
  }

  return chunks;
}

function scoreChunkPair(a: SemanticChunk, b: SemanticChunk): number {
  if (a.concepts.length < 6 || b.concepts.length < 6) return 0;
  const conceptCosine = cosineFromFrequency(a.freq, b.freq);
  const sequenceDice = bigramDice(a.concepts, b.concepts);
  return conceptCosine * 0.78 + sequenceDice * 0.22;
}

function topChunkPairs(currentChunks: SemanticChunk[], otherChunks: SemanticChunk[]): Array<{
  currentIndex: number;
  otherIndex: number;
  score: number;
}> {
  const pairs: Array<{ currentIndex: number; otherIndex: number; score: number }> = [];

  for (const current of currentChunks) {
    for (const other of otherChunks) {
      const score = scoreChunkPair(current, other);
      if (score > 0.2) {
        pairs.push({ currentIndex: current.index, otherIndex: other.index, score });
      }
    }
  }

  return pairs.sort((a, b) => b.score - a.score).slice(0, PAIR_CANDIDATES);
}

function aggregateDocumentSimilarity(currentChunks: SemanticChunk[], pairScores: Array<{
  currentIndex: number;
  otherIndex: number;
  score: number;
}>, otherChunks: SemanticChunk[]): { similarity: number; matchedExcerpts: string[] } {
  if (currentChunks.length === 0 || pairScores.length === 0) {
    return { similarity: 0, matchedExcerpts: [] };
  }

  const bestByChunk = new Map<number, number>();
  for (const pair of pairScores) {
    const existing = bestByChunk.get(pair.currentIndex) || 0;
    if (pair.score > existing) bestByChunk.set(pair.currentIndex, pair.score);
  }

  const suspiciousThreshold = 0.62;
  const suspiciousChunkIndexes = [...bestByChunk.entries()]
    .filter(([, score]) => score >= suspiciousThreshold)
    .map(([index]) => index)
    .sort((a, b) => a - b);

  let longestStreak = 0;
  let currentStreak = 0;
  let previous = -2;
  for (const idx of suspiciousChunkIndexes) {
    if (idx === previous + 1) currentStreak += 1;
    else currentStreak = 1;
    previous = idx;
    if (currentStreak > longestStreak) longestStreak = currentStreak;
  }

  const maxPair = pairScores[0]?.score || 0;
  const coverage = suspiciousChunkIndexes.length / currentChunks.length;
  const streakRatio = longestStreak / Math.max(1, currentChunks.length);

  const combined = Math.min(1, maxPair * 0.55 + coverage * 0.35 + streakRatio * 0.1);

  const matchedExcerpts = pairScores.slice(0, 4).map((pair) => {
    const current = currentChunks[pair.currentIndex];
    const other = otherChunks[pair.otherIndex];
    if (!current || !other) return '';
    const currentSnippet = current.text.length > 70 ? `${current.text.slice(0, 67)}...` : current.text;
    const otherSnippet = other.text.length > 70 ? `${other.text.slice(0, 67)}...` : other.text;
    return `[${Math.round(pair.score * 100)}%] "${currentSnippet}" ~= "${otherSnippet}"`;
  }).filter(Boolean);

  return {
    similarity: combined * 100,
    matchedExcerpts,
  };
}

// Determine risk level based on similarity score
function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
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
  const matches: PlagiarismResult['matches'] = [];
  let maxSimilarity = 0;
  const currentChunks = chunkText(currentText);
  const currentConcepts = tokenizeConcepts(currentText);

  if (currentConcepts.length < MIN_CONCEPT_TOKENS) {
    return {
      score: 0,
      matches: [],
      flagged: false,
      riskLevel: 'low',
    };
  }

  for (const other of otherSubmissions) {
    if (other.id === currentSubmissionId) continue; // Skip self
    if (!other.content || other.content.trim().length < MIN_TEXT_LENGTH) continue; // Skip empty

    const otherChunks = chunkText(other.content);
    if (otherChunks.length === 0 || currentChunks.length === 0) continue;

    const otherConcepts = tokenizeConcepts(other.content);
    if (otherConcepts.length < MIN_CONCEPT_TOKENS) continue;

    const candidates = topChunkPairs(currentChunks, otherChunks);
    const semanticDoc = aggregateDocumentSimilarity(currentChunks, candidates, otherChunks);
    const directDocSimilarity = semanticSimilarity(currentText, other.content) * 100;
    const balance = lengthBalanceFactor(currentConcepts.length, otherConcepts.length);

    let similarity = (Math.max(semanticDoc.similarity, directDocSimilarity * 0.85)) * balance;

    const currentDensity = informationDensity(currentConcepts);
    const otherDensity = informationDensity(otherConcepts);
    if (Math.min(currentDensity, otherDensity) < 0.32) {
      similarity *= 0.8;
    }

    if (similarity > 30) {
      matches.push({
        submissionId: other.id,
        studentName: other.studentName,
        similarity: Math.round(similarity),
        matchedText: semanticDoc.matchedExcerpts.slice(0, 5),
      });
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
  }

  // Sort by similarity score (descending)
  matches.sort((a, b) => b.similarity - a.similarity);

  const riskLevel = getRiskLevel(maxSimilarity);
  const flagged = riskLevel === 'high' || (matches.length > 2 && maxSimilarity > 52);

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
  const semantic = semanticSimilarity(submissionText, comparisonText) * 100;
  return Math.round(semantic);
}
