import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClaim, deleteClaim, getStats, listClaims, updateClaimStatus } from './api.js';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => fetchMock.mock.calls.at(-1);

describe('listClaims', () => {
  it('requests all claims when no filters are set', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1 }]));

    await expect(listClaims({})).resolves.toEqual([{ id: 1 }]);
    expect(lastCall()[0]).toBe('/api/claims');
    expect(lastCall()[1].method).toBe('GET');
  });

  it('builds the query string from the active filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listClaims({ status: 'PENDING', department: 'SALES', q: 'cab ride' });
    expect(lastCall()[0]).toBe('/api/claims?status=PENDING&department=SALES&q=cab+ride');
  });

  it('skips empty filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listClaims({ status: '', department: 'HR', q: '' });
    expect(lastCall()[0]).toBe('/api/claims?department=HR');
  });
});

describe('getStats', () => {
  it('reads the stats endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ total_claims: 4 }));

    await expect(getStats()).resolves.toEqual({ total_claims: 4 });
    expect(lastCall()[0]).toBe('/api/claims/stats');
  });
});

describe('createClaim', () => {
  it('posts the claim as JSON', async () => {
    const claim = { title: 'Hotel stay', amount: 7350 };
    fetchMock.mockResolvedValue(jsonResponse({ id: 6, ...claim }, 201));

    await expect(createClaim(claim)).resolves.toEqual({ id: 6, ...claim });
    const [path, options] = lastCall();
    expect(path).toBe('/api/claims');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual(claim);
  });
});

describe('updateClaimStatus', () => {
  it('sends only the status when there is no comment', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, status: 'APPROVED' }));

    await updateClaimStatus(3, 'APPROVED');
    const [path, options] = lastCall();
    expect(path).toBe('/api/claims/3/status');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ status: 'APPROVED' });
  });

  it('includes the reviewer comment when given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, status: 'REJECTED' }));

    await updateClaimStatus(3, 'REJECTED', 'Receipt missing');
    expect(JSON.parse(lastCall()[1].body)).toEqual({
      status: 'REJECTED',
      reviewer_comment: 'Receipt missing',
    });
  });
});

describe('deleteClaim', () => {
  it('resolves to null on 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteClaim(5)).resolves.toBeNull();
    expect(lastCall()[0]).toBe('/api/claims/5');
    expect(lastCall()[1].method).toBe('DELETE');
  });
});

describe('error handling', () => {
  it('joins FastAPI validation errors as "field: message"', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          detail: [
            { loc: ['body', 'amount'], msg: 'Input should be greater than 0' },
            { loc: ['body', 'expense_date'], msg: 'Date cannot be in the future' },
          ],
        },
        422,
      ),
    );

    await expect(createClaim({})).rejects.toThrow(
      'amount: Input should be greater than 0; expense_date: Date cannot be in the future',
    );
  });

  it('uses the bare message when a validation error has no field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: [{ loc: ['body'], msg: 'Field required' }] }, 422),
    );

    await expect(createClaim({})).rejects.toThrow(/^Field required$/);
  });

  it('surfaces a string detail such as a 409 conflict', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'Cannot move claim from PENDING to REIMBURSED' }, 409),
    );

    await expect(updateClaimStatus(1, 'REIMBURSED')).rejects.toThrow(
      'Cannot move claim from PENDING to REIMBURSED',
    );
  });

  it('reports a non-JSON 502 from the proxy as backend unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    await expect(getStats()).rejects.toThrow('Backend unavailable (HTTP 502)');
  });

  it('falls back to the status code when the JSON body has no detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));

    await expect(getStats()).rejects.toThrow('Request failed (HTTP 500)');
  });

  it('reports network failures without leaking the fetch error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listClaims({})).rejects.toThrow('Cannot reach the ExpenseFlow API.');
  });
});
