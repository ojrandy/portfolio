// Street props and billboards (P3B-05): trees, palms, benches, taxi/bus stops, call boxes, the fuel station and three
// billboards (3 draw calls: the props, their lamps, the text panels). Real content only on the boards: featured
// projects (one at a time, every 8 s; clicking opens it), GitHub numbers and Buea's weather, each with its source.
// Lamps glow with the street lamps; the panels glow a little at night, like the Career Road signs.
// Reduced motion: the featured board doesn't turn over.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { streetProps } from '../lib/streetProps.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { TAXI_YELLOW } from '../lib/vehicles.js';
import { ATLAS, buildPropGeometry, FEATURED_TILES, setQuadTile, TILES } from './propGeometry.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const ROTATE_SECONDS = 8;
const BOARD = mixHex(COLORS.indigo, COLORS.basalt, 0.35);
const LAMP_OFF = new THREE.Color(mixHex(COLORS.ash, COLORS.mist, 0.35));
const LAMP_ON = new THREE.Color(COLORS.window);
const noRaycast = () => null;

const fitText = (g, text, x, y, maxWidth, size, weight, family = 'system-ui, sans-serif') => {
    let px = size;
    do g.font = `${weight} ${px}px ${family}`; while (g.measureText(text).width > maxWidth && (px -= 2) > 14);
    g.fillText(text, x, y);
};

// A billboard face: caption, headline, detail and a source line, in the Career Road board style.
const paintBoard = (g, tile, { caption, headline, detail, source }) => {
    const { x, y, w, h } = tile;
    g.fillStyle = BOARD;
    g.fillRect(x, y, w, h);
    g.strokeStyle = mixHex(COLORS.mist, BOARD, 0.5);
    g.lineWidth = 8;
    g.strokeRect(x + 14, y + 14, w - 28, h - 28);
    g.textAlign = 'left';
    const left = x + 60;
    const max = w - 120;
    g.fillStyle = COLORS.window;
    fitText(g, caption, left, y + 108, max, 54, 700, 'ui-monospace, monospace');
    g.fillStyle = COLORS.paper;
    if (headline) fitText(g, headline, left, y + 250, max, 116, 700);
    g.fillStyle = COLORS.mist;
    if (detail) fitText(g, detail, left, y + 360, max, 76, 500);
    g.fillStyle = mixHex(COLORS.mist, BOARD, 0.3);
    if (source) fitText(g, source, left, y + h - 64, max, 44, 500, 'ui-monospace, monospace');
};

const paintSign = (g, tile, text, background, ink, lines = [text]) => {
    const { x, y, w, h } = tile;
    g.fillStyle = background;
    g.fillRect(x, y, w, h);
    g.fillStyle = ink;
    g.textAlign = 'center';
    lines.forEach((line, i) => fitText(g, line, x + w / 2, y + (h * (i + 0.72)) / lines.length, w - 40, h / lines.length * 0.7, 800));
};

const repaint = (atlas, tile, content) => {
    paintBoard(atlas.g, tile, content);
    atlas.texture.needsUpdate = true;
};

const featuredContent = (project) => (project
    ? { caption: 'FEATURED PROJECT', headline: project.name, detail: project.stack, source: project.site ? `${project.site} · click to open` : 'Click to open' }
    : { caption: 'OJ CITY', headline: 'Buea, Cameroon', detail: null, source: null });

const createAtlas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS.width;
    canvas.height = ATLAS.height;
    const g = canvas.getContext('2d');
    paintSign(g, TILES.stop, null, TAXI_YELLOW, COLORS.indigo, ['TAXI', 'BUS']);
    paintSign(g, TILES.callbox, 'CALL BOX', COLORS.paper, COLORS.indigo);
    paintSign(g, TILES.fuel, 'FUEL', COLORS.ember, COLORS.paper);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { g, texture };
};

/**
 * @param {{ layout: object, roles: number, lighting: object, featured: { slug, name, stack, site }[], github: object | null,
 *   weather: object | null, onOpenProject: (slug: string) => void, onHover: (on: boolean) => void }} props
 */
const StreetProps = ({ layout, roles, lighting, featured, github, weather, onOpenProject, onHover }) => {
    const reducedMotion = useReducedMotion();
    const placed = useMemo(() => streetProps(layout, { roles }), [layout, roles]);
    const geometry = useMemo(() => buildPropGeometry(placed), [placed]);
    const atlas = useMemo(() => createAtlas(), []);
    const lampMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: LAMP_OFF.clone(), toneMapped: false }), []);
    const panelMaterial = useRef(null);
    const shown = useRef({ index: 0, since: 0 });

    useEffect(() => () => {
        geometry.solid?.dispose();
        geometry.lights?.dispose();
        geometry.panels?.geometry.dispose();
    }, [geometry]);
    useEffect(() => () => { atlas.texture.dispose(); lampMaterial.dispose(); }, [atlas, lampMaterial]);

    // Repaint a board only when its content changes (a full texture upload). The featured board has a face per project
    // and turns over every ROTATE_SECONDS by switching its UVs.
    const shownFeatured = useMemo(() => featured.slice(0, FEATURED_TILES.length), [featured]);
    const featuredQuad = geometry.panels?.tiles.indexOf(FEATURED_TILES[0]) ?? -1;
    useEffect(() => {
        repaint(atlas, TILES.github, github ? { caption: 'ON GITHUB', ...github } : { caption: 'ON GITHUB', headline: 'Numbers loading', source: 'Source: GitHub API' });
    }, [atlas, github]);
    useEffect(() => {
        repaint(atlas, TILES.weather, weather ? { caption: 'WEATHER', ...weather } : { caption: 'WEATHER', headline: 'Buea, Cameroon', source: 'Source: Open-Meteo' });
    }, [atlas, weather]);
    useEffect(() => {
        shown.current = { index: 0, since: 0 };
        const faces = shownFeatured.length ? shownFeatured : [null];
        faces.forEach((project, i) => repaint(atlas, TILES[FEATURED_TILES[i]], featuredContent(project)));
        if (featuredQuad >= 0) setQuadTile(geometry.panels.geometry, featuredQuad, FEATURED_TILES[0]);
    }, [atlas, shownFeatured, geometry, featuredQuad]);

    useFrame(({ clock }) => {
        lampMaterial.color.lerpColors(LAMP_OFF, LAMP_ON, lighting.lamps);
        if (panelMaterial.current) panelMaterial.current.emissiveIntensity = 0.15 + 0.45 * lighting.windows;
        const state = shown.current;
        if (shownFeatured.length < 2 || featuredQuad < 0 || reducedMotion) return;
        if (state.since === 0) state.since = clock.elapsedTime;
        if (clock.elapsedTime - state.since < ROTATE_SECONDS) return;
        state.index = (state.index + 1) % shownFeatured.length;
        state.since = clock.elapsedTime;
        setQuadTile(geometry.panels.geometry, featuredQuad, FEATURED_TILES[state.index]);
    });

    const onFeatured = (event) => Math.floor(event.faceIndex / 2) === featuredQuad;
    const current = () => shownFeatured[shown.current.index];

    return (
        <group>
            {geometry.solid && (
                <mesh geometry={geometry.solid} castShadow receiveShadow raycast={noRaycast}>
                    <meshStandardMaterial vertexColors flatShading roughness={0.85} />
                </mesh>
            )}
            {geometry.lights && <mesh geometry={geometry.lights} material={lampMaterial} raycast={noRaycast} />}
            {geometry.panels && (
                <mesh
                    name="street-panels"
                    geometry={geometry.panels.geometry}
                    onClick={(event) => {
                        if (!onFeatured(event) || !current()) return;
                        event.stopPropagation();
                        onOpenProject(current().slug);
                    }}
                    onPointerMove={(event) => onHover(onFeatured(event) && Boolean(current()))}
                    onPointerOut={() => onHover(false)}
                >
                    <meshStandardMaterial ref={panelMaterial} map={atlas.texture} emissiveMap={atlas.texture} emissive="#ffffff" emissiveIntensity={0.15} roughness={0.8} />
                </mesh>
            )}
        </group>
    );
};

export default StreetProps;
