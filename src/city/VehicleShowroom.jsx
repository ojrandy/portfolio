// Dev-only vehicle showroom (P3B-02): /?city&vehicles in `npm run dev`. Every type parked on the main road, driving
// on the right: one row eastbound, one westbound with other colours. Sedans also line Career Road in every colour.
import { useMemo } from 'react';
import Vehicles from './Vehicles.jsx';
import { VEHICLE_IDS, VEHICLE_TYPES } from '../lib/vehicles.js';

const GAP = 0.6;

const VehicleShowroom = ({ layout }) => {
    const vehicles = useMemo(() => {
        const main = layout.roads.find((r) => r.kind === 'main');
        const career = layout.roads.find((r) => r.kind === 'career');
        const lane = main.depth / 4;
        const out = [];
        let x = career.x + career.width / 2 + 1;
        for (const id of VEHICLE_IDS) {
            const { length } = VEHICLE_TYPES[id];
            out.push({ type: id, x: x + length / 2, z: main.z + lane, rotationY: Math.PI / 2, seed: 'east' });
            out.push({ type: id, x: -(x + length / 2), z: main.z - lane, rotationY: -Math.PI / 2, seed: 'west' });
            x += length + GAP;
        }
        VEHICLE_TYPES.sedan.variants.forEach((color, i) => {
            out.push({ type: 'sedan', x: career.x + career.width / 4, z: main.z + main.depth / 2 + 3 + i * 1.6, rotationY: Math.PI, color });
        });
        return out;
    }, [layout]);

    return <Vehicles vehicles={vehicles} />;
};

export default VehicleShowroom;
