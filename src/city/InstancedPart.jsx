// One InstancedMesh (one draw call) for a list of { position, rotationY?, scale?, color? } items.
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

const dummy = new THREE.Object3D();
const color = new THREE.Color();

const InstancedPart = ({ items, geometry, children, ...props }) => {
    const ref = useRef(null);

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) return;
        items.forEach((item, i) => {
            dummy.position.set(...item.position);
            dummy.rotation.set(0, item.rotationY ?? 0, 0);
            dummy.scale.set(...(item.scale ?? [1, 1, 1]));
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            if (item.color) mesh.setColorAt(i, color.set(item.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [items]);

    if (items.length === 0) return null;
    return (
        <instancedMesh key={items.length} ref={ref} args={[geometry, undefined, items.length]} {...props}>
            {children}
        </instancedMesh>
    );
};

export default InstancedPart;
