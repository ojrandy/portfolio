// Vehicles (P3B-02): one InstancedMesh per type present, so at most one draw call per type for any number of vehicles.
// `vehicles` = [{ type, x, z, rotationY?, seed? | color? }]; rotationY 0 faces +z. Parked only: Traffic.jsx moves them.
import { useEffect, useMemo } from 'react';
import { pickVariant, VEHICLE_IDS } from '../lib/vehicles.js';
import { createVehicleMaterials, disposeVehicleMaterials, vehicleGeometries, vehicleMaterialFor } from './vehicleGeometry.js';
import Part from './InstancedPart.jsx';

/** @param {{ vehicles: { type: string, x: number, z: number, rotationY?: number, seed?: string|number, color?: string }[] }} props */
const Vehicles = ({ vehicles }) => {
    const geometries = vehicleGeometries();
    const materials = useMemo(() => createVehicleMaterials(), []);
    const byType = useMemo(() => {
        const out = Object.fromEntries(VEHICLE_IDS.map((id) => [id, []]));
        for (const v of vehicles) {
            out[v.type].push({
                position: [v.x, 0, v.z],
                rotationY: v.rotationY ?? 0,
                color: v.color ?? pickVariant(v.type, v.seed ?? out[v.type].length),
            });
        }
        return out;
    }, [vehicles]);

    useEffect(() => () => disposeVehicleMaterials(materials), [materials]);

    return (
        <group>
            {VEHICLE_IDS.map((id) => (
                <Part key={id} items={byType[id]} geometry={geometries[id]} material={vehicleMaterialFor(materials, id)} castShadow />
            ))}
        </group>
    );
};

export default Vehicles;
