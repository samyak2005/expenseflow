import { useCallback, useEffect, useState } from 'react';

export default function useToast(duration = 3500) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);

  const notify = useCallback((text, type = 'success') => setToast({ text, type }), []);

  return [toast, notify];
}
