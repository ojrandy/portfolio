// Speech bubble over whatever was just clicked (P3B-06): a honk, a bleat, the crossing button. Plain DOM via drei
// <Html> on a group moved every frame, so it rides along with a moving vehicle. Screen readers get the same text from
// the live region in CityExperience.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import useCityStore from '../store/useCityStore.js';

const SpeechBubble = () => {
    const bubble = useCityStore((s) => s.bubble);
    const group = useRef(null);

    useFrame(() => {
        // A vehicle that drove off the map leaves the bubble where it was (it goes in a moment anyway).
        const at = bubble?.at?.();
        if (group.current && at) group.current.position.set(...at);
    });

    if (!bubble) return null;
    return (
        <group ref={group} position={bubble.at?.() ?? [0, -100, 0]}>
            <Html key={bubble.key} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
                <p aria-hidden="true" className="whitespace-nowrap rounded-full bg-paper px-3 py-1 font-mono text-xs font-semibold text-basalt">
                    {bubble.text}
                </p>
            </Html>
        </group>
    );
};

export default SpeechBubble;
