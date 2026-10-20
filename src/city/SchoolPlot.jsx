// School district (P3-10): a two-storey school on the NE plot (3 draw calls), turned a little towards Career Road.
// The front is drawn once: windows (lit with the city at night), a door and a chalkboard with the venue.
// The building or its "Lessons" button opens SchoolPanel. Content: schoolContent (owner content only).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, mixHex } from '../lib/palette.js';

const SIZE = { width: 10, height: 4.5, depth: 5, roof: 1.8 };
const BODY_GEOMETRY = new THREE.BoxGeometry(SIZE.width, SIZE.height, SIZE.depth).translate(0, SIZE.height / 2, 0);
const FRONT_GEOMETRY = new THREE.PlaneGeometry(SIZE.width, SIZE.height).translate(0, SIZE.height / 2, SIZE.depth / 2 + 0.01);
const ROOF_GEOMETRY = (() => {
    const w = SIZE.width / 2 + 0.3;
    const shape = new THREE.Shape([new THREE.Vector2(-w, 0), new THREE.Vector2(w, 0), new THREE.Vector2(0, SIZE.roof)]);
    const depth = SIZE.depth + 0.6;
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, SIZE.height, -depth / 2);
})();
const FACING = -Math.PI / 10;
const WALL = mixHex(COLORS.paper, COLORS.ash, 0.35);
const BOARD = mixHex(COLORS.fakoGreen, COLORS.basalt, 0.45);
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';

// Canvas 1024 × 460 ↔ the 10 × 4.5 front. Windows in two rows either side of the board and door.
const WINDOWS = [50, 160, 270, 684, 794, 904].flatMap((x) => [70, 260].map((y) => ({ x, y, w: 70, h: 90 })));

const canvasTexture = (paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 460;
    paint(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

const frontTextures = (board) => ({
    map: canvasTexture((g) => {
        g.fillStyle = WALL;
        g.fillRect(0, 0, 1024, 460);
        g.fillStyle = mixHex(COLORS.basalt, COLORS.sky, 0.25);
        for (const w of WINDOWS) g.fillRect(w.x, w.y, w.w, w.h);
        g.fillStyle = '#5A4632';
        g.fillRect(382, 30, 260, 180); // board frame
        g.fillStyle = BOARD;
        g.fillRect(394, 42, 236, 156);
        g.fillStyle = COLORS.paper;
        g.textAlign = 'center';
        g.font = '600 46px system-ui, sans-serif';
        g.fillText('Teaching', 512, 110);
        if (board) {
            g.font = '30px ui-monospace, monospace';
            g.fillText(board, 512, 160);
        }
        g.fillStyle = COLORS.indigo;
        g.fillRect(452, 270, 120, 190); // door
        g.fillStyle = COLORS.window;
        g.fillRect(552, 360, 8, 8);
    }),
    emissive: canvasTexture((g) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 1024, 460);
        g.fillStyle = COLORS.window;
        for (const w of WINDOWS) g.fillRect(w.x, w.y, w.w, w.h);
    }),
});

/** @param {{ plot: object, school: ReturnType<import('../lib/schoolContent.js').schoolContent>, lighting: object, onOpen: () => void, onHover: (on: boolean) => void }} props */
const SchoolPlot = ({ plot, school, lighting, onOpen, onHover }) => {
    const textures = useMemo(() => frontTextures(school.board), [school.board]);
    useEffect(() => () => { textures.map.dispose(); textures.emissive.dispose(); }, [textures]);
    const front = useRef(null);

    useFrame(() => { front.current.emissiveIntensity = lighting.windows; });

    const open = (event) => {
        event.stopPropagation();
        onOpen();
    };
    const hover = (on) => (event) => {
        event.stopPropagation();
        onHover(on);
    };

    return (
        <group position={[plot.x, 0, plot.z]} rotation-y={FACING}>
            <group onClick={open} onPointerOver={hover(true)} onPointerOut={hover(false)}>
                <mesh geometry={BODY_GEOMETRY} castShadow receiveShadow>
                    <meshStandardMaterial color={WALL} roughness={0.9} />
                </mesh>
                <mesh geometry={FRONT_GEOMETRY} receiveShadow>
                    <meshStandardMaterial ref={front} map={textures.map} emissiveMap={textures.emissive} emissive="#ffffff" emissiveIntensity={0} roughness={0.85} />
                </mesh>
                <mesh geometry={ROOF_GEOMETRY} castShadow>
                    <meshStandardMaterial color={mixHex(COLORS.ember, COLORS.basalt, 0.45)} roughness={0.8} />
                </mesh>
            </group>
            <Html position={[0, 0.5, SIZE.depth / 2 + 0.6]} center zIndexRange={[8, 0]}>
                <button type="button" onClick={open} className={BUTTON_CLASS}>Lessons</button>
            </Html>
        </group>
    );
};

export default SchoolPlot;
