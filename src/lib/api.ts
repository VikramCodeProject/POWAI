const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('powai-token');

const parseApiResponse = async (res: Response): Promise<any> => {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  if (!raw) return {};

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return { error: 'Server returned invalid JSON response.' };
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) localStorage.setItem('powai-token', token);
  else localStorage.removeItem('powai-token');
};

export const getAuthToken = () => authToken;

const apiFetch = async (path: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await parseApiResponse(res);

  // Global auth guard: auto-redirect on expired/missing token
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setAuthToken(null);
    localStorage.removeItem('powai-storage');
    window.location.href = '/auth';
    throw new Error('Session expired. Redirecting to login...');
  }

  if (!res.ok) throw new Error(data.error || data.message || `API request failed (${res.status})`);
  return data;
};

// Auth
export const apiRegister = (body: { name: string; email: string; password: string; role: string }) =>
  apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) });

export const apiLogin = (body: { email: string; password: string; role: string }) =>
  apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const apiGetMe = () => apiFetch('/auth/me');

// Assignments
export const apiGetAssignments = () => apiFetch('/assignments');

export const apiCreateAssignment = (body: any) =>
  apiFetch('/assignments', { method: 'POST', body: JSON.stringify(body) });

export const apiDeleteAssignment = (id: string) =>
  apiFetch(`/assignments/${id}`, { method: 'DELETE' });

export const apiValidateCode = (code: string) => apiFetch(`/assignments/code/${code}`);

// Submissions
export const apiGetSubmissions = () => apiFetch('/submissions');

export const apiGetSubmission = (id: string) => apiFetch(`/submissions/${id}`);

export const apiCreateSubmission = (body: any) =>
  apiFetch('/submissions', { method: 'POST', body: JSON.stringify(body) });

export const apiUpdateSubmissionScore = (id: string, score: number) =>
  apiFetch(`/submissions/${id}/score`, { method: 'PUT', body: JSON.stringify({ score }) });

// AI Analysis
export const apiAnalyzeFile = async (file: File, instructions: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('instructions', instructions);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/analyze/file', { method: 'POST', headers, body: formData });
  const data = await parseApiResponse(res);
  if (!res.ok) throw new Error(data.error || data.message || `Analysis failed (${res.status})`);
  return data;
};

export const apiAnalyzeText = (text: string, instructions: string) =>
  apiFetch('/analyze/text', { method: 'POST', body: JSON.stringify({ text, instructions }) });

export const apiCheckPlagiarism = (body: { text: string; assignmentId: string; submissionId: string }) =>
  apiFetch('/analyze/plagiarism', { method: 'POST', body: JSON.stringify(body) });

// Submission Access Control
export const apiCheckSubmissionAccess = (assignmentId: string) =>
  apiFetch(`/assignments/check-access/${assignmentId}`, { method: 'POST' });

export const apiCanStudentSubmit = async (assignmentId: string): Promise<{ canAccess: boolean; existingSubmissionId?: string; message: string }> => {
  try {
    const result = await apiCheckSubmissionAccess(assignmentId);
    return {
      canAccess: true,
      message: result.message || 'You can proceed with submission',
    };
  } catch (error: any) {
    // Check if it's a 403 (already submitted)
    if (error.message && error.message.includes('Already submitted')) {
      return {
        canAccess: false,
        message: 'You have already submitted this assignment. You can only submit once.',
        existingSubmissionId: undefined,
      };
    }
    return {
      canAccess: false,
      message: error.message || 'Unable to check submission access',
    };
  }
};
