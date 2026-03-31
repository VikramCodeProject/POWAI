import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import Tesseract from 'tesseract.js';
import { RandomForestRegression } from 'ml-random-forest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse: (buffer: Buffer) => Promise<{ text?: string }> = require('pdf-parse');

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) console.warn('⚠️  GROQ_API_KEY not set — AI analysis will fail');
else console.log('✅ Groq API Key loaded successfully');
const GROQ_MODEL = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';
const FALLBACK_MODELS = ['mixtral-8x7b-32768', 'llama-2-70b-chat'];

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export interface AnalysisResult {
  overall_score: number;
  ai_probability: number;
  topic_relevance: number;
  content_quality: number;
  writing_consistency: number;
  extracted_text?: string;
  analysis_confidence?: number;
  label?: 'genuine' | 'review' | 'suspicious';
  flags: string[];
  summary: string;
  ai_indicators?: string;
  quality_assessment?: string;
}

type FeatureVector = [
  entropyNorm: number,
  sizeNorm: number,
  formatNorm: number,
  handwritingSimilarity: number,
  textSimilarity: number,
  ocrConfidence: number,
  textLengthNorm: number,
];

let rfModel: RandomForestRegression | null = null;

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function toLabel(score: number): 'genuine' | 'review' | 'suspicious' {
  if (score >= 80) return 'genuine';
  if (score >= 50) return 'review';
  return 'suspicious';
}

function tokenizeText(input: string): string[] {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 4000);
}

function cosineSimilarity(a: string, b: string): number {
  const ta = tokenizeText(a);
  const tb = tokenizeText(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  for (const t of ta) fa.set(t, (fa.get(t) || 0) + 1);
  for (const t of tb) fb.set(t, (fb.get(t) || 0) + 1);

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (const [, v] of fa) na += v * v;
  for (const [, v] of fb) nb += v * v;
  for (const [k, v] of fa) {
    const w = fb.get(k) || 0;
    dot += v * w;
  }

  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

function shannonEntropy(fileBuffer: Buffer): number {
  const sample = fileBuffer.subarray(0, Math.min(fileBuffer.length, 64 * 1024));
  if (sample.length === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < sample.length; i++) freq[sample[i]]++;

  let entropy = 0;
  for (let i = 0; i < freq.length; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / sample.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function trainRandomForest(): RandomForestRegression {
  const rand = seededRandom(42);
  const features: FeatureVector[] = [];
  const targets: number[] = [];

  const sample = (base: number, spread: number) => clamp01(base + (rand() - 0.5) * spread);

  for (let i = 0; i < 90; i++) {
    const fv: FeatureVector = [
      sample(0.72, 0.2),
      sample(0.58, 0.25),
      sample(0.93, 0.1),
      sample(0.62, 0.3),
      sample(0.68, 0.3),
      sample(0.76, 0.2),
      sample(0.72, 0.25),
    ];
    features.push(fv);
    targets.push(clampScore(82 + rand() * 14));
  }

  for (let i = 0; i < 85; i++) {
    const fv: FeatureVector = [
      sample(0.55, 0.35),
      sample(0.48, 0.35),
      sample(0.82, 0.25),
      sample(0.45, 0.35),
      sample(0.42, 0.35),
      sample(0.56, 0.35),
      sample(0.5, 0.35),
    ];
    features.push(fv);
    targets.push(clampScore(53 + rand() * 22));
  }

  for (let i = 0; i < 85; i++) {
    const fv: FeatureVector = [
      sample(0.28, 0.3),
      sample(0.2, 0.3),
      sample(0.56, 0.35),
      sample(0.28, 0.25),
      sample(0.18, 0.25),
      sample(0.32, 0.25),
      sample(0.22, 0.25),
    ];
    features.push(fv);
    targets.push(clampScore(18 + rand() * 28));
  }

  const model = new RandomForestRegression({
    nEstimators: 55,
    maxFeatures: 0.8,
    replacement: true,
    seed: 42,
    useSampleBagging: true,
  });
  model.train(features, targets);
  return model;
}

function getRandomForest(): RandomForestRegression {
  if (!rfModel) rfModel = trainRandomForest();
  return rfModel;
}

async function extractTextSignals(fileBuffer: Buffer, mimeType: string): Promise<{
  text: string;
  ocrConfidence: number;
  handwritingSimilarity: number;
  engine: string;
}> {
  if (mimeType === 'application/pdf') {
    try {
      const parsed = await pdfParse(fileBuffer);
      const text = (parsed.text || '').trim();
      const richText = text.length > 120;
      return {
        text,
        ocrConfidence: richText ? 0.78 : 0.52,
        handwritingSimilarity: richText ? 0.46 : 0.38,
        engine: 'pdf-parse',
      };
    } catch {
      return { text: '', ocrConfidence: 0.34, handwritingSimilarity: 0.3, engine: 'pdf-parse-failed' };
    }
  }

  if (mimeType.startsWith('image/')) {
    try {
      const out = await Tesseract.recognize(fileBuffer, 'eng');
      const text = (out.data.text || '').trim();
      const words = out.data.words || [];
      const confidences = words
        .map((w) => Number(w.confidence))
        .filter((v) => Number.isFinite(v) && v >= 0 && v <= 100);
      const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : Number(out.data.confidence || 0);
      const variance = confidences.length
        ? confidences.reduce((sum, v) => sum + (v - avgConf) * (v - avgConf), 0) / confidences.length
        : 0;
      const stdDev = Math.sqrt(Math.max(0, variance));

      // Handwriting tends to produce lower OCR confidence and higher variance than printed text.
      const handwritingSimilarity = clamp01((1 - avgConf / 100) * 0.7 + Math.min(1, stdDev / 35) * 0.3);

      return {
        text,
        ocrConfidence: clamp01(avgConf / 100),
        handwritingSimilarity,
        engine: 'tesseract',
      };
    } catch {
      return { text: '', ocrConfidence: 0.32, handwritingSimilarity: 0.28, engine: 'tesseract-failed' };
    }
  }

  return { text: '', ocrConfidence: 0.25, handwritingSimilarity: 0.2, engine: 'unsupported' };
}

function legacyHeuristicAnalysis(
  fileBuffer: Buffer,
  mimeType: string,
  assignmentInstructions: string
): AnalysisResult {
  const bytes = fileBuffer.length;
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isSupported = isPdf || isImage;
  const instructionLen = (assignmentInstructions || '').trim().length;

  const entropy = shannonEntropy(fileBuffer);
  const sizeKb = bytes / 1024;
  const entropyScore = clampScore((entropy / 8) * 100);
  const sizeEvidence =
    sizeKb < 25 ? 20 :
    sizeKb < 60 ? 35 :
    sizeKb < 180 ? 58 :
    sizeKb < 850 ? 74 :
    sizeKb < 2400 ? 62 : 40;
  const formatEvidence = isPdf ? 74 : isImage ? 64 : 25;
  const instructionEvidence = instructionLen > 0 ? 66 : 44;

  const evidenceStrength = clampScore(
    sizeEvidence * 0.34 + entropyScore * 0.36 + formatEvidence * 0.2 + instructionEvidence * 0.1
  );

  const suspicionSignals = clampScore(
    (sizeKb < 25 ? 48 : sizeKb < 60 ? 24 : 8) +
    (entropy < 4.2 ? 42 : entropy < 5.1 ? 24 : 6) +
    (!isSupported ? 50 : 0) +
    (instructionLen === 0 ? 10 : 0)
  );

  const aiProbability = clampScore(18 + suspicionSignals * 0.72 - evidenceStrength * 0.22);
  const topicRelevance = clampScore(40 + instructionEvidence * 0.6 + (isPdf ? 8 : 0) - (sizeKb < 25 ? 10 : 0));
  const contentQuality = clampScore(28 + sizeEvidence * 0.45 + entropyScore * 0.28 + (isPdf ? 8 : 4));
  const writingConsistency = clampScore(30 + entropyScore * 0.42 + (isImage ? 10 : 16));

  const confidence = clampScore(24 + evidenceStrength * 0.7 - (sizeKb < 25 ? 12 : 0) - (!isSupported ? 14 : 0));

  let overallScore = clampScore(
    46 +
    topicRelevance * 0.2 +
    contentQuality * 0.2 +
    writingConsistency * 0.22 -
    aiProbability * 0.34
  );
  overallScore = Math.min(overallScore, 92);
  if (confidence < 55) overallScore = Math.min(overallScore, 78);
  if (aiProbability > 70) overallScore = Math.min(overallScore, 68);
  if (sizeKb < 25) overallScore = Math.min(overallScore, 64);

  const flags: string[] = [];
  if (sizeKb < 25) flags.push('Very small file size; authenticity evidence is weak.');
  if (entropy < 4.2) flags.push('Low document complexity signature detected.');
  if (!isSupported) flags.push('Unexpected file format for this assignment.');
  if (confidence < 55) flags.push('Low confidence estimate; manual review is strongly recommended.');
  if (aiProbability > 65) flags.push(`Elevated AI-likelihood estimate (${aiProbability}%).`);
  flags.push('ML fallback unavailable; heuristic fallback used.');

  const label = toLabel(overallScore);
  const summary = `Fallback heuristic estimator produced a provisional authenticity score. Label is ${label}; teacher review is recommended for final grading.`;

  return {
    overall_score: overallScore,
    ai_probability: aiProbability,
    topic_relevance: topicRelevance,
    content_quality: contentQuality,
    writing_consistency: writingConsistency,
    analysis_confidence: confidence,
    label,
    flags,
    summary,
  };
}

function textHeuristicAnalysis(
  text: string,
  assignmentInstructions: string
): AnalysisResult {
  const normalizedText = (text || '').trim();
  const normalizedInstructions = (assignmentInstructions || '').trim();

  const words = tokenizeText(normalizedText);
  const uniqueWords = new Set(words);
  const wordCount = words.length;
  const uniqueRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  const similarity = cosineSimilarity(normalizedText, normalizedInstructions);

  const repeatedPenalty = clampScore((1 - uniqueRatio) * 100);
  const lengthScore = clampScore(Math.min(1, wordCount / 180) * 100);

  const topicRelevance = clampScore(
    normalizedInstructions.length > 0
      ? similarity * 100
      : Math.min(70, 25 + lengthScore * 0.6)
  );
  const contentQuality = clampScore(lengthScore * 0.75 + uniqueRatio * 25 - repeatedPenalty * 0.15);
  const writingConsistency = clampScore(35 + uniqueRatio * 45 + Math.min(20, wordCount / 15));

  let overallScore = clampScore(topicRelevance * 0.75 + contentQuality * 0.2 + writingConsistency * 0.05);
  const aiProbability = clampScore(65 - topicRelevance * 0.45 - contentQuality * 0.2 + repeatedPenalty * 0.25);

  // Hard caps ensure random/off-topic text cannot receive passing scores.
  if (topicRelevance < 10) overallScore = Math.min(overallScore, 12);
  else if (topicRelevance < 25) overallScore = Math.min(overallScore, 28);
  else if (topicRelevance < 40) overallScore = Math.min(overallScore, 45);

  if (contentQuality < 20) overallScore = Math.min(overallScore, 35);
  if (wordCount < 35) overallScore = Math.min(overallScore, 30);

  const confidence = clampScore(42 + Math.min(38, wordCount / 8) + (normalizedInstructions ? 10 : 0));
  const flags: string[] = [];

  if (topicRelevance < 25) flags.push('Very low relevance to assignment instructions.');
  if (wordCount < 35) flags.push('Response is too short for reliable demonstration of understanding.');
  if (uniqueRatio < 0.35) flags.push('High repetition detected; content appears low-substance.');
  if (aiProbability > 65) flags.push(`Elevated AI-likelihood estimate (${aiProbability}%).`);
  flags.push('Heuristic text fallback used due AI provider unavailability.');

  const label = toLabel(overallScore);
  const summary = `Text-only fallback analysis estimated ${label}. Relevance was ${topicRelevance}%, quality ${contentQuality}%, and score caps were applied for low alignment/low substance responses.`;

  return {
    overall_score: overallScore,
    ai_probability: aiProbability,
    topic_relevance: topicRelevance,
    content_quality: contentQuality,
    writing_consistency: writingConsistency,
    analysis_confidence: confidence,
    label,
    flags,
    summary,
  };
}

export class AIServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'AI_SERVICE_ERROR') {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function mapGroqError(err: any): AIServiceError {
  const status = typeof err?.status === 'number' ? err.status : undefined;
  const rawMessage = String(err?.message || 'AI analysis failed');

  if (status === 429 || /quota|rate.?limit|Too Many Requests/i.test(rawMessage)) {
    return new AIServiceError(
      `Groq API quota/rate limit reached. Check your API key and request limits.`,
      429,
      'AI_QUOTA_EXCEEDED'
    );
  }

  if (status === 401 || status === 403 || /API key|permission|unauthorized|forbidden/i.test(rawMessage)) {
    return new AIServiceError(
      'Groq API key is invalid or missing required permissions.',
      401,
      'AI_AUTH_ERROR'
    );
  }

  if (status === 404 || /model|not found|not supported|unsupported/i.test(rawMessage)) {
    return new AIServiceError(
      'Configured Groq model is unavailable. Set GROQ_MODEL to a supported model.',
      400,
      'AI_MODEL_UNAVAILABLE'
    );
  }

  if (rawMessage.includes('Failed to parse AI response')) {
    return new AIServiceError('AI provider returned an invalid response format. Please retry.', 502, 'AI_BAD_RESPONSE');
  }

  const shortReason = rawMessage.split('\n')[0].slice(0, 180);
  return new AIServiceError(
    `AI analysis request failed${status ? ` (status ${status})` : ''}: ${shortReason}`,
    502,
    'AI_REQUEST_FAILED'
  );
}

function getModelCandidates(): string[] {
  const custom = GROQ_MODEL.trim();
  const all = [custom, ...FALLBACK_MODELS];
  return Array.from(new Set(all.filter(Boolean)));
}

async function generateWithFallback(input: string | any): Promise<any> {
  if (!groq) {
    console.warn('⚠️  Groq API not configured, using heuristic fallback');
    throw new AIServiceError('Groq API not configured on server.', 500, 'AI_NOT_CONFIGURED');
  }

  const models = getModelCandidates();
  let lastError: any;

  for (const modelName of models) {
    try {
      console.log(`📡 Attempting Groq API call with model: ${modelName}`);
      const result = await groq.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: typeof input === 'string' ? input : JSON.stringify(input),
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
      console.log('✅ Groq API call successful');
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️  Groq API error with ${modelName}:`, err?.message);
      const msg = String(err?.message || '');
      const shouldTryNext = /model|not found|not supported|unsupported|404/i.test(msg);
      if (!shouldTryNext) break;
    }
  }

  console.error('❌ All Groq API attempts failed, falling back to heuristic analysis');
  throw mapGroqError(lastError);
}

const ANALYSIS_PROMPT = `You are an academic integrity analyzer for the POWAI platform. A student submitted content for an assignment. Analyze it thoroughly.

ASSIGNMENT INSTRUCTIONS:
---
{INSTRUCTIONS}
---

Evaluate the submission and respond ONLY with valid JSON (no markdown, no code fences):
{
  "ai_probability": <0-100, likelihood of AI-generated content>,
  "topic_relevance": <0-100, relevance to assignment objectives>,
  "content_quality": <0-100, depth and technical quality of work>,
  "writing_consistency": <0-100, consistency of writing style throughout>,
  "overall_score": <0-100, overall authenticity/effort score>,
  "flags": [<array of specific detected concerns, max 5>],
  "summary": "<2-3 sentence detailed analysis explaining the scores>",
  "ai_indicators": "<brief explanation of AI detection reasoning>",
  "quality_assessment": "<brief explanation of content quality evaluation>"
}

Scoring Guide:
- 80-100: Appears genuine with natural patterns
- 50-79: Mixed signals; manual review recommended
- 0-49: High likelihood of AI generation or plagiarism

When evaluating:
1. Look for generic phrases common in AI outputs
2. Check for inconsistencies in technical depth
3. Assess originality markers and unique insights
4. Consider vocabulary diversity and complexity
5. Note any suspiciously polished writing`;

export async function analyzeSubmission(
  fileBuffer: Buffer,
  mimeType: string,
  assignmentInstructions: string
): Promise<AnalysisResult> {
  try {
    const bytes = fileBuffer.length;
    const sizeKb = bytes / 1024;
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isSupported = isPdf || isImage;

    const entropy = shannonEntropy(fileBuffer);
    const entropyNorm = clamp01(entropy / 8);
    const sizeNorm = clamp01(Math.log1p(sizeKb) / Math.log1p(15 * 1024));
    const formatNorm = isPdf ? 1 : isImage ? 0.86 : 0.25;

    const extracted = await extractTextSignals(fileBuffer, mimeType);
    const textSimilarity = cosineSimilarity(extracted.text, assignmentInstructions || '');
    const textLengthNorm = clamp01(Math.log1p(extracted.text.length) / Math.log1p(6000));

    const featureVector: FeatureVector = [
      entropyNorm,
      sizeNorm,
      formatNorm,
      clamp01(extracted.handwritingSimilarity),
      textSimilarity,
      clamp01(extracted.ocrConfidence),
      textLengthNorm,
    ];

    const model = getRandomForest();
    const predicted = model.predict([featureVector]);
    const rawScore = Array.isArray(predicted) ? Number(predicted[0]) : Number(predicted);
    let overallScore = clampScore(rawScore);

    const suspiciousness =
      (1 - textSimilarity) * 0.34 +
      (1 - entropyNorm) * 0.22 +
      (1 - extracted.ocrConfidence) * 0.18 +
      (sizeKb < 25 ? 0.16 : 0.04) +
      (!isSupported ? 0.2 : 0);

    const aiProbability = clampScore(12 + suspiciousness * 100 * 0.95 + (100 - overallScore) * 0.24);
    const topicRelevance = clampScore(22 + textSimilarity * 58 + (assignmentInstructions.trim().length ? 10 : 0));
    const contentQuality = clampScore(26 + sizeNorm * 28 + entropyNorm * 22 + textLengthNorm * 24);
    const writingConsistency = clampScore(28 + extracted.ocrConfidence * 34 + extracted.handwritingSimilarity * 22 + entropyNorm * 16);
    const confidence = clampScore(35 + extracted.ocrConfidence * 32 + textLengthNorm * 20 + (isSupported ? 8 : -8));

    if (confidence < 50) overallScore = Math.min(overallScore, 76);
    if (aiProbability > 70) overallScore = Math.min(overallScore, 68);
    if (sizeKb < 25) overallScore = Math.min(overallScore, 64);
    overallScore = Math.min(overallScore, 95);

    const label = toLabel(overallScore);
    const flags: string[] = [];
    if (sizeKb < 25) flags.push('Very small file size; authenticity evidence is limited.');
    if (entropy < 4.2) flags.push('Low entropy detected; document complexity may be weak.');
    if (textSimilarity < 0.18 && assignmentInstructions.trim().length > 0) flags.push('Low similarity to assignment keywords.');
    if (extracted.ocrConfidence < 0.45) flags.push('OCR confidence is low; output should be manually reviewed.');
    if (aiProbability > 65) flags.push(`Elevated AI-likelihood estimate (${aiProbability}%).`);
    if (!isSupported) flags.push('Unsupported format, model confidence reduced.');

    const summary = `Fallback ML pipeline (${extracted.engine} OCR + Random Forest) produced a ${label} result from entropy, size, format, handwriting similarity, and text similarity features. Confidence is ${confidence >= 75 ? 'high' : confidence >= 55 ? 'moderate' : 'low'} and should be validated by teacher review.`;

    return {
      overall_score: overallScore,
      ai_probability: aiProbability,
      topic_relevance: topicRelevance,
      content_quality: contentQuality,
      writing_consistency: writingConsistency,
      extracted_text: extracted.text ? extracted.text.slice(0, 20000) : '',
      analysis_confidence: confidence,
      label,
      flags,
      summary,
    };
  } catch (err) {
    console.error('ML fallback pipeline failed, using heuristic fallback:', err);
    return legacyHeuristicAnalysis(fileBuffer, mimeType, assignmentInstructions);
  }
}

export async function analyzeText(
  text: string,
  assignmentInstructions: string
): Promise<AnalysisResult> {
  try {
    const prompt = ANALYSIS_PROMPT.replace('{INSTRUCTIONS}', assignmentInstructions || 'No specific instructions provided.')
      + `\n\nSTUDENT SUBMISSION TEXT:\n---\n${text}\n---`;

    const result = await generateWithFallback(prompt);
    const responseText = (result.choices?.[0]?.message?.content || '').trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw mapGroqError(new Error('Failed to parse AI response'));

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      throw mapGroqError(new Error('Failed to parse AI response'));
    }
    analysis.overall_score = Math.max(0, Math.min(100, analysis.overall_score));
    analysis.ai_probability = Math.max(0, Math.min(100, analysis.ai_probability));
    analysis.topic_relevance = Math.max(0, Math.min(100, analysis.topic_relevance));
    analysis.content_quality = Math.max(0, Math.min(100, analysis.content_quality));
    analysis.writing_consistency = Math.max(0, Math.min(100, analysis.writing_consistency));

    const relevanceWeighted = Math.round(
      analysis.topic_relevance * 0.75 +
      analysis.content_quality * 0.2 +
      analysis.writing_consistency * 0.05
    );
    let calibratedScore = Math.min(analysis.overall_score, relevanceWeighted);

    // Guardrails: low relevance cannot end with a passing/high score.
    if (analysis.topic_relevance < 10) calibratedScore = Math.min(calibratedScore, 12);
    else if (analysis.topic_relevance < 25) calibratedScore = Math.min(calibratedScore, 30);
    else if (analysis.topic_relevance < 40) calibratedScore = Math.min(calibratedScore, 45);
    if (analysis.content_quality < 20) calibratedScore = Math.min(calibratedScore, 38);

    analysis.overall_score = clampScore(calibratedScore);

    if (analysis.topic_relevance < 25 && !analysis.flags?.includes('Very low relevance to assignment instructions.')) {
      analysis.flags = [...(analysis.flags || []), 'Very low relevance to assignment instructions.'];
    }

    return analysis;
  } catch (err: any) {
    console.error('Groq API analysis failed:', err?.message);
    console.log('⚠️  Falling back to heuristic analysis for text submission...');
    return textHeuristicAnalysis(text, assignmentInstructions);
  }
}
