import { useState } from 'react';
import { initialQuality } from '../lib/quality.js';

/** What the browser says about the device (any value may be missing). */
export const deviceInfo = () => ({
    cores: navigator.hardwareConcurrency || undefined,
    memoryGb: navigator.deviceMemory,
    touch: window.matchMedia('(pointer: coarse)').matches,
});

/** First-guess quality level for this device ('low' | 'medium' | 'high'); P5-02 reuses it for the mode switch. */
const useDeviceTier = () => useState(() => initialQuality(deviceInfo()))[0];

export default useDeviceTier;
