// Status line over the city (P2-05): "It's 23:40 in Buea · light rain · Ojong is probably shipping something".
// The time comes from this device's clock corrected by the server's (`offsetMs`), so it ticks every minute and still
// shows when /api/buea is down. Only this component re-renders on the tick.
import { useEffect, useState } from 'react';
import { bueaClock, msToNextMinute, statusLine } from '../lib/dayNight.js';

/**
 * @param {{ offsetMs?: number, at?: number | null, weather?: { label?: string | null } | null }} props
 *   at: a fixed time (epoch ms) from the dev preview; weather: /api/buea weather (no label = not shown)
 */
const StatusLine = ({ offsetMs = 0, at = null, weather = null }) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (at != null) return undefined;
        let id;
        const schedule = () => {
            id = setTimeout(() => {
                setNow(Date.now());
                schedule();
            }, msToNextMinute(Date.now() + offsetMs) + 50);
        };
        schedule();
        return () => clearTimeout(id);
    }, [at, offsetMs]);

    return (
        <p className="pointer-events-none absolute left-4 top-4 z-10 max-w-[min(90vw,42rem)] rounded border border-mist/15 bg-black/35 px-3 py-2 font-mono text-[11px] leading-relaxed text-mist/90 backdrop-blur-[2px]">
            {statusLine({ localTime: bueaClock(at ?? now + offsetMs), weather })}
        </p>
    );
};

export default StatusLine;
