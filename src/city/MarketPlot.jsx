// Market district (P3B-07): an open market of wooden stalls under colourful tarps, one stall per service the owner
// offers (marketContent, owner content only; no prices). 4 draw calls: the stalls (one merged mesh), their bulbs, the
// sign panels (one canvas atlas) and the people (sellers behind the counters, shoppers in the aisles: one
// InstancedMesh). Market hours follow Buea time: closed at night (no sellers, no shoppers), fewer shoppers in the rain.
// Clicking a stall opens its service panel; clicking a shopper gets one of the owner's Pidgin call-outs. Stalls and
// shoppers are hit-tested in market.js, not on the meshes. The "Market" button is the keyboard way in.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, mixHex } from '../lib/palette.js';
import { createRandom } from '../lib/random.js';
import { bueaMinutes } from '../lib/traffic.js';
import { outfit } from '../lib/figures.js';
import { canHover, isClick } from '../lib/picking.js';
import {
    createShoppers, marketDensity, marketSign, marketStalls, maxShoppers, pickMarket, pokeShopper, shopperPose, STALL, stepShoppers,
} from '../lib/market.js';
import { MAX_STALLS } from '../lib/marketContent.js';
import { blob, box, mergeParts, panel, panelGeometry } from './propGeometry.js';
import { buildFigureGeometry, createFigureMaterial } from './figureGeometry.js';
import useCityStore from '../store/useCityStore.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const MAX_STEP = 0.1;
const RAIN_FEWER = 0.5; // full rain keeps half the shoppers away
const SHOPPER_ID = 100; // hit instanceIds: stalls 0…17, shoppers from 100
const WOOD = '#7A5434';
const DARK_WOOD = '#4E3522';
const SIGN_BOARD = mixHex(COLORS.basalt, COLORS.ash, 0.5);
// Plain tarp colours from the palette (no cultural motifs, ADR-009); neighbours never share one.
const TARPS = [COLORS.indigo, COLORS.ember, COLORS.window, COLORS.fakoGreen, COLORS.sky, '#B8476B', '#2E6F5E'];
const GOODS = [COLORS.paper, COLORS.sky, COLORS.ember, COLORS.window, COLORS.mist, '#5C8FB0', '#8C7A5B', COLORS.basalt];
const LAMP_OFF = new THREE.Color(mixHex(COLORS.ash, COLORS.mist, 0.35));
const LAMP_ON = new THREE.Color(COLORS.window);
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';
const noRaycast = () => null;

// Sign atlas: a 640 × 128 tile per stall (two columns), then the MARKET sign.
const TILE = { w: 640, h: 128 };
const SIGN_TILE = MAX_STALLS;
const ATLAS = { width: TILE.w * 2, height: TILE.h * Math.ceil((MAX_STALLS + 1) / 2) };
const tileRect = (i) => ({ x: (i % 2) * TILE.w, y: Math.floor(i / 2) * TILE.h, w: TILE.w, h: TILE.h });
const tileUvs = (i) => {
    const { x, y, w, h } = tileRect(i);
    const [u0, u1] = [x / ATLAS.width, (x + w) / ATLAS.width];
    const [v0, v1] = [1 - (y + h) / ATLAS.height, 1 - y / ATLAS.height];
    return [u0, v0, u1, v0, u1, v1, u0, v1];
};

// Front poles 1.0 tall, back ones 0.85: the tarp slopes back so the rain runs off behind the stall.
const ROOF = { front: 1, back: 0.85, poleZ: 0.5 };
const TILT = Math.atan((ROOF.front - ROOF.back) / (ROOF.poleZ * 2));

const stallKit = (index) => {
    const tarp = TARPS[(index * 3) % TARPS.length];
    const random = createRandom(`goods:${index}`);
    const goods = (y, z, spots) => spots.map((x) => {
        const [w, h, d] = [0.12 + random() * 0.08, 0.06 + random() * 0.08, 0.1 + random() * 0.05];
        return box([w, h, d], [x, y + h / 2, z], GOODS[Math.floor(random() * GOODS.length)]);
    });
    const halfW = STALL.width / 2 - 0.04;
    return {
        solid: [
            ...[-1, 1].flatMap((sx) => [
                box([0.06, ROOF.front, 0.06], [sx * halfW, ROOF.front / 2, ROOF.poleZ], WOOD),
                box([0.06, ROOF.back, 0.06], [sx * halfW, ROOF.back / 2, -ROOF.poleZ], WOOD),
            ]),
            box([STALL.width + 0.2, 0.03, STALL.depth + 0.25], [0, (ROOF.front + ROOF.back) / 2 + 0.01, 0], tarp, [-TILT, 0, 0]),
            box([STALL.width + 0.2, 0.1, 0.02], [0, ROOF.front - 0.02, STALL.depth / 2 + 0.13], mixHex(tarp, COLORS.basalt, 0.25)),
            // The sign stands on the tarp's front edge, above the seller's head.
            box([STALL.width, 0.34, 0.04], [0, ROOF.front + 0.2, STALL.depth / 2 + 0.11], SIGN_BOARD),
            box([STALL.width - 0.1, 0.26, 0.3], [0, 0.13, 0.3], WOOD),
            box([STALL.width - 0.04, 0.025, 0.34], [0, 0.272, 0.3], mixHex(tarp, COLORS.paper, 0.55)),
            box([STALL.width - 0.1, 0.36, 0.16], [0, 0.18, -0.45], DARK_WOOD),
            ...goods(0.285, 0.3, [-0.5, -0.05, 0.45]),
            ...goods(0.36, -0.45, [-0.45, 0.05, 0.5]),
        ],
        // A string of bulbs just in front of the tarp's edge, so they show from above at dusk (under it they didn't).
        lights: [-0.5, 0, 0.5].map((x) => blob([0.09, 0.09, 0.09], [x, ROOF.front - 0.11, STALL.depth / 2 + 0.17], COLORS.window)),
        panels: [panel(index, STALL.width - 0.08, 0.27, [0, ROOF.front + 0.2, STALL.depth / 2 + 0.131])],
    };
};

// MARKET: a board on two posts, readable from Career Road.
const signKit = () => ({
    solid: [
        ...[-0.9, 0.9].map((x) => box([0.08, 1.75, 0.08], [x, 0.875, -0.04], WOOD)),
        box([2.1, 0.5, 0.06], [0, 1.5, 0], SIGN_BOARD),
    ],
    panels: [panel(SIGN_TILE, 2, 0.4, [0, 1.5, 0.031]), panel(SIGN_TILE, 2, 0.4, [0, 1.5, -0.031], true)],
});

const buildMarketGeometry = (stalls, sign) => {
    const solid = [];
    const lights = [];
    const panels = [];
    const place = (spot, kit) => {
        const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(spot.x, 0, spot.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.rotationY),
            new THREE.Vector3(1, 1, 1),
        );
        for (const part of kit.solid) solid.push({ part, matrix });
        for (const part of kit.lights ?? []) lights.push({ part, matrix });
        for (const item of kit.panels ?? []) panels.push({ panel: item, matrix });
    };
    stalls.forEach((stall) => place(stall, stallKit(stall.index)));
    place(sign, signKit());
    return { solid: mergeParts(solid), lights: mergeParts(lights), panels: panelGeometry(panels, tileUvs) };
};

const fitText = (g, text, x, y, maxWidth, size, weight) => {
    let px = size;
    do g.font = `${weight} ${px}px system-ui, sans-serif`; while (g.measureText(text).width > maxWidth && (px -= 2) > 14);
    g.fillText(text, x, y);
};

// Hand-painted look: a paper board with the service name and a stripe in the stall's tarp colour.
const createAtlas = (stalls) => {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS.width;
    canvas.height = ATLAS.height;
    const g = canvas.getContext('2d');
    g.textAlign = 'center';
    stalls.forEach((stall) => {
        const { x, y, w, h } = tileRect(stall.index);
        g.fillStyle = COLORS.paper;
        g.fillRect(x, y, w, h);
        g.fillStyle = TARPS[(stall.index * 3) % TARPS.length];
        g.fillRect(x, y + h - 16, w, 16);
        g.fillStyle = COLORS.basalt;
        fitText(g, stall.name, x + w / 2, y + 76, w - 40, 64, 800);
    });
    const { x, y, w, h } = tileRect(SIGN_TILE);
    g.fillStyle = COLORS.ember;
    g.fillRect(x, y, w, h);
    g.fillStyle = COLORS.paper;
    fitText(g, 'MARKET', x + w / 2, y + 94, w - 40, 96, 800);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
};

const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

/**
 * @param {{ plot: object, market: ReturnType<import('../lib/marketContent.js').marketContent>, lighting: object,
 *   offsetMs?: number, at?: number | null, share?: number, onOpen: (index: number) => void, onHover: (on: boolean) => void }} props
 *   share = fraction of the shoppers for this device (phones 0.5)
 */
const MarketPlot = ({ plot, market, lighting, offsetMs = 0, at = null, share = 1, onOpen, onHover }) => {
    const reducedMotion = useReducedMotion();
    const stalls = useMemo(() => marketStalls(plot, market.stalls.length), [plot, market.stalls.length]);
    const sign = useMemo(() => marketSign(plot), [plot]);
    const geometry = useMemo(() => buildMarketGeometry(stalls, sign), [stalls, sign]);
    const texture = useMemo(() => createAtlas(market.stalls), [market.stalls]);
    const state = useMemo(() => createShoppers(stalls, { count: Math.max(1, Math.round(maxShoppers(stalls) * share)) }), [stalls, share]);
    const capacity = stalls.length + state.shoppers.length;
    const figureMaterial = useMemo(() => createFigureMaterial(), []);
    const figureGeometry = useMemo(() => buildFigureGeometry('person', capacity), [capacity]);
    const lampMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: LAMP_OFF.clone(), toneMapped: false }), []);
    const panelMaterial = useRef(null);
    const people = useRef(null);
    const hitTarget = useRef(null);
    const calls = useRef(0);
    const [hovered, setHovered] = useState(null); // stall index under the pointer

    useEffect(() => () => {
        geometry.solid?.dispose();
        geometry.lights?.dispose();
        geometry.panels.dispose();
    }, [geometry]);
    useEffect(() => () => texture.dispose(), [texture]);
    useEffect(() => () => figureGeometry.dispose(), [figureGeometry]);
    useEffect(() => () => { figureMaterial.dispose(); lampMaterial.dispose(); }, [figureMaterial, lampMaterial]);

    // Clothes never change: sellers first, then the shoppers.
    useLayoutEffect(() => {
        const mesh = people.current;
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
        const lower = mesh.geometry.attributes.aLower;
        const ids = [...stalls.map((s) => `seller-${s.index}`), ...state.shoppers.map((s) => `market-${s.id}`)];
        ids.forEach((id, i) => {
            const o = outfit(id);
            mesh.setColorAt(i, color.set(o.top));
            color.set(o.lower);
            lower.setXYZ(i, color.r, color.g, color.b);
        });
        mesh.instanceColor.needsUpdate = true;
        lower.needsUpdate = true;
    }, [capacity, stalls, state]);

    useFrame(({ clock }, delta) => {
        const density = marketDensity(bueaMinutes(at ?? Date.now() + offsetMs));
        const open = density > 0;
        const target = Math.round(state.shoppers.length * density * (1 - RAIN_FEWER * (lighting.rain ?? 0)));
        if (reducedMotion) state.shoppers.forEach((s, i) => { s.scale = i < target ? 1 : 0; });
        else stepShoppers(state, Math.min(delta, MAX_STEP), { target });

        lampMaterial.color.lerpColors(LAMP_OFF, LAMP_ON, open ? lighting.lamps : 0);
        if (panelMaterial.current) panelMaterial.current.emissiveIntensity = 0.15 + 0.45 * lighting.windows;

        const mesh = people.current;
        const gait = mesh.geometry.attributes.aGait;
        let n = 0;
        const put = (x, z, rotationY, s, phase, stride) => {
            position.set(x, 0, z);
            quaternion.setFromAxisAngle(up, rotationY);
            scale.setScalar(Math.max(s, 1e-3));
            mesh.setMatrixAt(n, matrix.compose(position, quaternion, scale));
            gait.setXYZ(n, phase, stride, 0);
            n++;
        };
        // Sellers look about now and then (still with reduced motion). Hidden slots keep their colour index.
        for (const stall of stalls) {
            const look = reducedMotion ? 0 : 0.35 * Math.sin(clock.elapsedTime * 0.3 + stall.index * 1.7);
            put(stall.seller.x, stall.seller.z, look, open ? 1 : 0, 0, 0);
        }
        for (const s of state.shoppers) {
            const pose = shopperPose(s);
            put(pose.x, pose.z, pose.rotationY, pose.scale, pose.phase, reducedMotion ? 0 : pose.stride);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        gait.needsUpdate = true;
    });

    const raycast = (raycaster, intersects) => {
        const hit = pickMarket(state, raycaster.ray);
        if (!hit) return;
        intersects.push({
            distance: hit.distance, point: raycaster.ray.at(hit.distance, new THREE.Vector3()), object: hitTarget.current,
            instanceId: hit.kind === 'stall' ? hit.item.index : SHOPPER_ID + state.shoppers.indexOf(hit.item),
        });
    };
    const onClick = (e) => {
        e.stopPropagation();
        if (!isClick(e.delta)) return;
        if (e.instanceId < SHOPPER_ID) {
            onOpen(e.instanceId);
            return;
        }
        const shopper = state.shoppers[e.instanceId - SHOPPER_ID];
        if (!shopper || !market.calls.length) return;
        pokeShopper(shopper);
        const line = market.calls[calls.current++ % market.calls.length];
        useCityStore.getState().say(line, () => [shopper.x, 0.7, shopper.z]);
    };
    const onMove = (e) => {
        e.stopPropagation();
        if (!canHover(e.pointerType)) return;
        onHover(true);
        setHovered(e.instanceId < SHOPPER_ID ? e.instanceId : null);
    };
    const onOut = () => {
        onHover(false);
        setHovered(null);
    };
    const shown = stalls[hovered];

    return (
        <group>
            <group ref={hitTarget} raycast={raycast} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} />
            {geometry.solid && (
                <mesh geometry={geometry.solid} castShadow receiveShadow raycast={noRaycast}>
                    <meshStandardMaterial vertexColors flatShading roughness={0.85} />
                </mesh>
            )}
            {geometry.lights && <mesh geometry={geometry.lights} material={lampMaterial} raycast={noRaycast} />}
            <mesh geometry={geometry.panels} raycast={noRaycast}>
                <meshStandardMaterial ref={panelMaterial} map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.15} roughness={0.8} />
            </mesh>
            <instancedMesh
                key={`market-people-${capacity}`}
                ref={people}
                args={[figureGeometry, figureMaterial, capacity]}
                frustumCulled={false}
                raycast={noRaycast}
                receiveShadow
            />
            {shown && (
                <Html position={[shown.x, STALL.height + 0.35, shown.z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
                    <p aria-hidden="true" className="whitespace-nowrap border border-white/30 bg-black/75 px-2 py-1 font-mono text-xs text-white">
                        {market.stalls[shown.index].name}
                    </p>
                </Html>
            )}
            <Html position={[sign.x, 0.4, sign.z + 0.6]} center zIndexRange={[8, 0]}>
                <button type="button" onClick={() => onOpen(0)} className={BUTTON_CLASS}>Market</button>
            </Html>
        </group>
    );
};

export default MarketPlot;
