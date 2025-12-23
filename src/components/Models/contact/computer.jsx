import { useGLTF } from "@react-three/drei";

export function Computer(props) {
    const { nodes, materials } = useGLTF(
        "/models/computer-optimized-transformed.glb"
    );

    // To optimise this model for the web, we use gltfjsx but transforned the model to the web for best optimization
    return (
        <group {...props} dispose={null}>
            <group position={[-4.005, 67.549, 58.539]}>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Cube000_ComputerDesk_0001_1.geometry}
                    material={materials["ComputerDesk.001"]}
                />
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Cube000_ComputerDesk_0001_2.geometry}
                    material={materials["FloppyDisk.001"]}
                />
            </group>
        </group>
    );
}

useGLTF.preload("/models/computer-optimized-transformed.glb");

export default Computer;