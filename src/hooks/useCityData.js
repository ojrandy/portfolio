import { useCallback, useEffect, useState } from 'react';
import { parseCityResponse } from '../lib/cityData.js';

/** Fetches /api/city once (again on `retry`). `fetchedAt` is the "now" used by the building rules. */
const useCityData = () => {
    const [state, setState] = useState({ status: 'loading', data: null, fetchedAt: null, error: null });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/city', { signal: controller.signal, headers: { Accept: 'application/json' } })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json) => setState({ status: 'ready', data: parseCityResponse(json), fetchedAt: Date.now(), error: null }))
            .catch((error) => {
                if (error.name !== 'AbortError') setState({ status: 'error', data: null, fetchedAt: null, error });
            });
        return () => controller.abort();
    }, [attempt]);

    const retry = useCallback(() => {
        setState({ status: 'loading', data: null, fetchedAt: null, error: null });
        setAttempt((n) => n + 1);
    }, []);
    return { ...state, retry };
};

export default useCityData;
