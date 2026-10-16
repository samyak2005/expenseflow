function formatValidationIssue({ loc, msg }) {
  const field = Array.isArray(loc) ? loc[loc.length - 1] : '';
  return field && field !== 'body' ? `${field}: ${msg}` : msg;
}

function readErrorMessage(body, status) {
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map(formatValidationIssue).join('; ');
  }
  return `Request failed (HTTP ${status})`;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the ExpenseFlow API.');
  }

  if (response.status === 204) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    // A non-JSON error body comes from the proxy (e.g. a 502 while the backend restarts).
    throw new Error(
      data
        ? readErrorMessage(data, response.status)
        : `Backend unavailable (HTTP ${response.status})`,
    );
  }
  return data;
}

export function listClaims({ status, department, q }) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (department) params.set('department', department);
  if (q) params.set('q', q);
  const query = params.toString();
  return request(query ? `/api/claims?${query}` : '/api/claims');
}

export const getStats = () => request('/api/claims/stats');

export const createClaim = (claim) => request('/api/claims', { method: 'POST', body: claim });

export const updateClaimStatus = (id, status, reviewerComment) =>
  request(`/api/claims/${id}/status`, {
    method: 'PATCH',
    body: reviewerComment ? { status, reviewer_comment: reviewerComment } : { status },
  });

export const deleteClaim = (id) => request(`/api/claims/${id}`, { method: 'DELETE' });
