// Easter-egg triggers that aren't a click in the scene (P3-09): the cheat code, a visit after dark in Buea, and
// opening three different projects. The Fako knocks are wired in Fako.jsx, the hub in ArcadePlot.
import { useEffect, useRef } from 'react';
import { EXPLORER_PROJECTS, KONAMI, isNightInBuea, sequenceMatcher } from '../lib/arcadeEggs.js';
import useArcadeStore from '../store/useArcadeStore.js';
import useCityStore from '../store/useCityStore.js';

const NIGHT_CHECK_MS = 60000;

const isTyping = (target) => target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** @param {{ active: boolean, offsetMs: number }} options  active: the city has drawn its first frame */
const useEasterEggs = ({ active, offsetMs }) => {
    // A ref, so the 15-minute clock refresh doesn't restart the effect (and reset the projects opened so far).
    const offset = useRef(offsetMs);
    useEffect(() => { offset.current = offsetMs; }, [offsetMs]);

    useEffect(() => {
        if (!active) return undefined;
        const { find, flashMarquee } = useArcadeStore.getState();

        const match = sequenceMatcher(KONAMI);
        const onKeyDown = (event) => {
            if (event.repeat || isTyping(event.target) || !match(event.key)) return;
            find('konami');
            flashMarquee();
        };
        window.addEventListener('keydown', onKeyDown);

        const checkNight = () => isNightInBuea(Date.now() + offset.current) && find('night');
        checkNight();
        const night = window.setInterval(checkNight, NIGHT_CHECK_MS);

        const opened = new Set();
        const unsubscribe = useCityStore.subscribe(({ openSlug }) => {
            if (!openSlug) return;
            opened.add(openSlug);
            if (opened.size >= EXPLORER_PROJECTS) find('explorer');
        });

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.clearInterval(night);
            unsubscribe();
        };
    }, [active]);
};

export default useEasterEggs;
