// City kit budget (ART-02): what `npm run art:build` / `npm run art:check` enforce on public/models/city-kit.glb.
// Numbers from docs/design_system.md "City art" → Budgets.

export const ART_BUDGET = {
    lod0Triangles: 1500,
    lod1Triangles: 300,
    kitBytes: 600 * 1024,
};

export const LOD1_SUFFIX = '_LOD1';
export const REQUIRED_ATTRIBUTES = ['POSITION', 'NORMAL', 'COLOR_0', '_TINT', '_AO'];
const NAME = /^[a-z][a-z0-9_]*$/;

const primitiveTriangles = (prim) => {
    if (prim.getMode() !== 4) return 0; // TRIANGLES only; the exporter never writes strips or fans
    const indices = prim.getIndices();
    return Math.floor((indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()) / 3);
};

/** One row per mesh node of a gltf-transform Document: name, triangles, attributes present on every primitive. */
export const summarizeKit = (doc) =>
    doc.getRoot().listNodes()
        .filter((node) => node.getMesh())
        .map((node) => {
            const prims = node.getMesh().listPrimitives();
            const attributes = REQUIRED_ATTRIBUTES.filter((name) => prims.every((p) => p.getAttribute(name)));
            return {
                name: node.getName(),
                triangles: prims.reduce((sum, p) => sum + primitiveTriangles(p), 0),
                attributes,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

/** Every budget or format problem in the kit, as readable lines. Empty = pass. */
export const checkKit = ({ pieces, bytes }, budget = ART_BUDGET) => {
    const problems = [];
    if (pieces.length === 0) problems.push('the kit has no pieces');
    if (bytes > budget.kitBytes) problems.push(`kit file is ${(bytes / 1024).toFixed(1)} KB, budget ${(budget.kitBytes / 1024).toFixed(0)} KB`);

    const names = new Set(pieces.map((p) => p.name));
    for (const piece of pieces) {
        const isLod1 = piece.name.endsWith(LOD1_SUFFIX);
        const base = isLod1 ? piece.name.slice(0, -LOD1_SUFFIX.length) : piece.name;
        if (!NAME.test(base)) problems.push(`${piece.name}: name must be lower_snake_case`);
        const limit = isLod1 ? budget.lod1Triangles : budget.lod0Triangles;
        if (piece.triangles > limit) problems.push(`${piece.name}: ${piece.triangles} triangles, budget ${limit}`);
        const missing = REQUIRED_ATTRIBUTES.filter((a) => !piece.attributes.includes(a));
        if (missing.length) problems.push(`${piece.name}: missing ${missing.join(', ')}`);
        if (isLod1 && !names.has(base)) problems.push(`${piece.name}: no LOD0 piece "${base}"`);
        if (!isLod1 && !names.has(base + LOD1_SUFFIX)) problems.push(`${piece.name}: no "${base}${LOD1_SUFFIX}"`);
    }
    return problems;
};
