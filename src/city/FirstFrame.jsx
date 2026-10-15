import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Calls onDrawn once the frame after mount runs, i.e. once the scene it sits in has been drawn (shaders compiled).
const FirstFrame = ({ onDrawn }) => {
    const frames = useRef(0);
    useFrame(() => {
        if (++frames.current === 2) onDrawn();
    });
    return null;
};

export default FirstFrame;
