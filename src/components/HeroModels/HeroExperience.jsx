import React from 'react'
import {Canvas} from "@react-three/fiber";
import {OrbitControls} from "@react-three/drei";
import {useMediaQuery} from "react-responsive";
import {Room} from "./Room.jsx";
import HeroLights from "./HeroLights.jsx";
import Particles from "./Particles.jsx";

const HeroExperience = () => {
    {/* Check if user is on Tablet */}
    const isTablet = useMediaQuery({query: '(max-width: 1024px)'});
    const isMobile = useMediaQuery({query: '(max-width: 768px)'});
    return (
        <Canvas camera={{ position: [0, 0, 15], fov: 45}}>
            {/* Using Orbit controls to access the 3d features */}
            <OrbitControls
                enablePan={false}
                enableZoom={!isTablet}
                maxDistance={20}
                minDistance={5}
                minPolarAngle={Math.PI / 5}
                maxPolarAngle={Math.PI / 2}
            />
            <HeroLights />
            <Particles />

            <group
            scale={isMobile? 0.7 : 1}
            position={[0, -3.7, 0]}
            >
                <Room />
            </group>
        </Canvas>
    )
}
export default HeroExperience
