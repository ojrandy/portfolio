// Cinema district (P3-08): a platform with a framed screen, from owner content only (cinemaReel):
// - a local reel plays on the screen as a muted, looping video texture (paused with reduced motion and while the
//   player is open); the screen or "Play reel" opens CinemaModal;
// - otherwise the screen shows a drawn "Video work" card and opens the owner's channel in a new tab (nothing is
//   loaded from the channel, so the CSP is unchanged).
// Without either, CityExperience doesn't mount this and the plot keeps its placeholder block.
import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../lib/palette.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const PLATFORM_GEOMETRY = new THREE.BoxGeometry(5.6, 3.2, 5.6);
const FRAME_GEOMETRY = new THREE.BoxGeometry(6.25, 3.65, 0.3);
const SCREEN_GEOMETRY = new THREE.PlaneGeometry(5.9, 3.3);
const CONTROL_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';

const useVideoTexture = (src, playing) => {
    const video = useMemo(() => {
        if (!src) return null;
        const element = document.createElement('video');
        element.src = src;
        element.loop = true;
        element.muted = true;
        element.playsInline = true;
        element.preload = 'auto';
        return element;
    }, [src]);
    const texture = useMemo(() => {
        if (!video) return null;
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        return videoTexture;
    }, [video]);

    useEffect(() => {
        if (!video) return undefined;
        video.load();
        return () => {
            video.pause();
            video.removeAttribute('src');
            video.load();
            texture.dispose();
        };
    }, [video, texture]);

    useEffect(() => {
        if (!video) return;
        if (playing) video.play().catch(() => {});
        else video.pause();
    }, [video, playing]);

    return texture;
};

// The channel card, drawn once: a play mark, "Video work" and the channel address.
const channelCard = (href) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const g = canvas.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 1024, 576);
    bg.addColorStop(0, COLORS.basalt);
    bg.addColorStop(1, COLORS.indigo);
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 576);
    g.fillStyle = COLORS.ember;
    g.beginPath();
    g.arc(512, 230, 92, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.moveTo(482, 180);
    g.lineTo(482, 280);
    g.lineTo(568, 230);
    g.closePath();
    g.fill();
    g.textAlign = 'center';
    g.font = '600 64px system-ui, sans-serif';
    g.fillText('Video work', 512, 418);
    const url = new URL(href);
    g.fillStyle = COLORS.mist;
    g.font = '32px ui-monospace, monospace';
    g.fillText(`${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`, 512, 478);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

/** @param {{ plot: object, reel: ReturnType<import('../lib/cinemaReel.js').cinemaReel>, paused: boolean, onOpen: () => void, onHover: (on: boolean) => void }} props */
const CinemaPlot = ({ plot, reel, paused, onOpen, onHover }) => {
    const reducedMotion = useReducedMotion();
    const isFile = reel.kind === 'file';
    const videoTexture = useVideoTexture(isFile ? reel.src : null, isFile && !paused && !reducedMotion);
    const cardTexture = useMemo(() => (isFile ? null : channelCard(reel.href)), [isFile, reel.href]);
    useEffect(() => () => cardTexture?.dispose(), [cardTexture]);

    const open = (event) => {
        event.stopPropagation();
        if (isFile) onOpen();
        else window.open(reel.href, '_blank', 'noopener,noreferrer');
    };

    return (
        <group position={[plot.x, 0, plot.z]}>
            <mesh geometry={PLATFORM_GEOMETRY} position={[0, 1.6, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#292B33" roughness={0.8} />
            </mesh>
            <mesh geometry={FRAME_GEOMETRY} position={[0, 5.05, 2.75]} castShadow>
                <meshStandardMaterial color="#111216" metalness={0.35} roughness={0.45} />
            </mesh>
            <mesh
                geometry={SCREEN_GEOMETRY}
                position={[0, 5.05, 2.91]}
                onClick={open}
                onPointerOver={(event) => { event.stopPropagation(); onHover(true); }}
                onPointerOut={(event) => { event.stopPropagation(); onHover(false); }}
            >
                <meshBasicMaterial map={videoTexture ?? cardTexture} toneMapped={false} />
            </mesh>
            <Html position={[0, isFile ? 5.05 : 2.95, 2.94]} center zIndexRange={[8, 0]}>
                {isFile ? (
                    <button type="button" onClick={open} className={CONTROL_CLASS}>Play reel</button>
                ) : (
                    <a href={reel.href} target="_blank" rel="noopener noreferrer" className={CONTROL_CLASS}>
                        Watch on YouTube <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
                    </a>
                )}
            </Html>
        </group>
    );
};

/** Player for the reel: modal dialog, Escape or Close shuts it, Tab stays inside, focus goes back where it was. */
export const CinemaModal = ({ reel, onClose }) => {
    const dialog = useRef(null);
    const closeButton = useRef(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const previousFocus = document.activeElement;
        closeButton.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key !== 'Tab' || !dialog.current) return;
            const focusable = [...dialog.current.querySelectorAll('button, video[controls]')];
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
            {/* A div, not <section>: the template forces every section to 100dvw (overflows on phones). */}
            <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cinema-title"
                className="w-full max-w-5xl border border-mist/20 bg-basalt p-4 text-mist sm:p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 id="cinema-title" className="text-sm font-semibold">{reel.title}</h2>
                    <button
                        ref={closeButton}
                        type="button"
                        onClick={onClose}
                        className="border border-mist/25 px-3 py-1.5 text-sm hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                    >
                        Close
                    </button>
                </div>
                <video
                    className="aspect-video w-full bg-black object-contain"
                    src={reel.src}
                    controls
                    autoPlay={!reducedMotion}
                    muted
                    playsInline
                    preload="metadata"
                />
            </div>
        </div>
    );
};

export default CinemaPlot;
