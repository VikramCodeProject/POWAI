// Submission access control service
// Manages student submission restrictions (one-time submission per assignment)

interface SubmissionAccessResult {
  canAccess: boolean;
  message: string;
  existingSubmissionId?: string;
}

/**
 * Check if a student can submit to an assignment
 * - Students can only submit once per assignment
 * - Returns false if they've already submitted
 */
export async function checkStudentSubmissionAccess(
  assignmentId: string,
  studentEmail: string
): Promise<SubmissionAccessResult> {
  try {
    const response = await fetch(`/api/assignments/check-access/${assignmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        canAccess: false,
        message: error.message || 'Unable to verify submission access',
        existingSubmissionId: error.existingSubmissionId,
      };
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to check submission access:', err);
    return {
      canAccess: false,
      message: 'Failed to verify submission access',
    };
  }
}

/**
 * Prevent duplicate submission attempts
 * Should be called before initiating submission
 */
export function enforceOneTimeSubmission(hasExistingSubmission: boolean): boolean {
  if (hasExistingSubmission) {
    console.log('⛔ One-time submission limit reached');
    return false;
  }
  return true;
}
