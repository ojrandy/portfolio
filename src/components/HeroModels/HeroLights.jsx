import * as THREE from "three";

const HeroLights = () => (
    <>
        {/* lamp's light on the wall*/}
        <spotLight
            position={[2, 8, 8]}
            angle={0.15}
            penumbra={0.5}
            intensity={100}
            color="#dedefe"
        />  {/* lamp's light on the Chair*/}
            <spotLight
            position={[2, 10, 1]}
            angle={0.15}
            penumbra={0.8}
            intensity={50}
            color="#fedefe"
        />
        {/* bluish overhead lamp */}
        <spotLight
            position={[4, 5, 4]}
            angle={0.3}
            penumbra={0.5}
            intensity={40}
            color="#4cc9f0"
        />
        {/* purplish side fill */}
        <spotLight
            position={[-3, 5, 5]}
            angle={0.4}
            penumbra={1}
            intensity={60}
            color="#9d4edd"
        />
        {/* area light for soft moody fill */}
        <primitive
            object={new THREE.RectAreaLight("#a259ff", 8, 3, 2)}
            position={[1, 3, 4]}
            rotation={[-Math.PI / 4, Math.PI / 4, 0]}
            intensity={15}
        />
        {/* subtle point light for atmospheric tone */}
        <pointLight position={[0, 1, 0]} intensity={10} color="#7209b7" />
        <pointLight position={[1, 2, -2]} intensity={10} color="#0d00a4" />

    </>
);

export default HeroLights;