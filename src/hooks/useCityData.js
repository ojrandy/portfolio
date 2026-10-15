import { useEffect, useState } from 'react';
import { parseCityResponse } from '../lib/cityData.js';

/** Fetches /api/city once. `fetchedAt` is the "now" used by the building rules. */
const useCityData = () => {
    const [state, setState] = useState({ status: 'loading', data: null, fetchedAt: null, error: null });

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
    }, []);

    return state;
};

export default useCityData;
