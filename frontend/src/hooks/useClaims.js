import { useCallback, useEffect, useRef, useState } from 'react';
import { getStats, listClaims } from '../api.js';

export default function useClaims({ status, department, q }) {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    // Filters can change faster than responses arrive; only the newest request may update state.
    const requestId = ++latestRequest.current;
    const isLatest = () => requestId === latestRequest.current;

    setLoading(true);
    try {
      const [nextClaims, nextStats] = await Promise.all([
        listClaims({ status, department, q }),
        getStats(),
      ]);
      if (!isLatest()) return;
      setClaims(nextClaims);
      setStats(nextStats);
      setError('');
    } catch (err) {
      if (isLatest()) setError(err.message);
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [status, department, q]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { claims, stats, loading, error, reload };
}
