import { useEffect, useState } from 'react';

const REFRESH_MS = 15 * 60 * 1000; // matches the server's weather cache

/**
 * Fetches /api/buea on mount and every 15 min. `offsetMs` = Buea server clock − this device's clock, so a
 * wrong device clock doesn't change Buea's time. Until (or unless) it answers, offsetMs is 0 and data is null.
 */
const useBuea = () => {
    const [state, setState] = useState({ data: null, offsetMs: 0 });

    useEffect(() => {
        let controller;
        const load = () => {
            controller?.abort();
            controller = new AbortController();
            const sent = Date.now();
            fetch('/api/buea', { signal: controller.signal, headers: { Accept: 'application/json' } })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((json) => {
                    const now = Date.parse(json?.now);
                    if (!Number.isFinite(now)) return;
                    const received = Date.now();
                    setState({ data: json, offsetMs: Math.round(now - (sent + received) / 2) });
                })
                .catch(() => {}); // keep the device clock; the sky is computed in the browser either way
        };
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => {
            clearInterval(id);
            controller?.abort();
        };
    }, []);

    return state;
};

export default useBuea;
