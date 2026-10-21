import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import useReducedMotion from "../hooks/useReducedMotion.js";

// Neon glow that trails the mouse pointer. Skipped on touch screens and with reduced motion.
const finePointer = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const CursorGlow = () => {
    const reducedMotion = useReducedMotion();
    const root = useRef(null);
    const core = useRef(null);
    const halo = useRef(null);
    const enabled = finePointer && !reducedMotion;

    useGSAP(() => {
        if (!enabled) return;
        gsap.set([core.current, halo.current], { xPercent: -50, yPercent: -50, x: -200, y: -200 });

        const coreX = gsap.quickTo(core.current, "x", { duration: 1, ease: "power3.out" });
        const coreY = gsap.quickTo(core.current, "y", { duration: 1, ease: "power3.out" });
        const haloX = gsap.quickTo(halo.current, "x", { duration: 1.4, ease: "power3.out" });
        const haloY = gsap.quickTo(halo.current, "y", { duration: 1.4, ease: "power3.out" });
        let visible = false;

        const show = (on) => {
            if (visible === on) return;
            visible = on;
            gsap.to(root.current, { autoAlpha: on ? 1 : 0, duration: on ? 0.6 : 1, ease: "power2.out", overwrite: true });
        };

        const onMove = (event) => {
            if (!visible) {
                // Start at the pointer instead of sweeping in from the corner.
                gsap.set([core.current, halo.current], { x: event.clientX, y: event.clientY });
            }
            coreX(event.clientX);
            coreY(event.clientY);
            haloX(event.clientX);
            haloY(event.clientY);
            show(true);
        };
        const onLeave = () => show(false);

        window.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
        return () => {
            window.removeEventListener("pointermove", onMove);
            document.documentElement.removeEventListener("pointerleave", onLeave);
        };
    }, { dependencies: [enabled], scope: root });

    if (!enabled) return null;

    return (
        <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] invisible opacity-0 mix-blend-screen">
            <div
                ref={halo}
                className="absolute left-0 top-0 size-72 rounded-full will-change-transform"
                style={{ background: "radial-gradient(circle, rgba(76,155,232,0.22) 0%, rgba(43,58,140,0.12) 40%, transparent 70%)" }}
            />
            <div
                ref={core}
                className="absolute left-0 top-0 size-6 rounded-full border border-sky/80 will-change-transform"
                style={{
                    background: "radial-gradient(circle, rgba(217,236,255,0.9) 0%, rgba(76,155,232,0.6) 45%, transparent 75%)",
                    boxShadow: "0 0 8px 2px rgba(76,155,232,0.9), 0 0 24px 6px rgba(76,155,232,0.55), 0 0 60px 16px rgba(43,58,140,0.4)",
                }}
            />
        </div>
    );
};

export default CursorGlow;
