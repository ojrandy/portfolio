// Floating label above a building's roof: name + stack (P1-06). Plain DOM via drei <Html>: no font, no draw call.
// aria-hidden: screen readers get the building name from the live region and the project list instead.
import { Html } from '@react-three/drei';
import { labelText } from '../lib/projectSummary.js';

const ABOVE_ROOF = 1.4;

const BuildingLabel = ({ lot, project }) => {
    const { name, stack } = labelText(project);
    const { building: b } = lot;

    return (
        <Html position={[lot.x, b.height + ABOVE_ROOF, lot.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div
                aria-hidden="true"
                className="whitespace-nowrap rounded-md border-l-2 bg-basalt/85 px-3 py-1.5 text-mist shadow-lg backdrop-blur-sm"
                style={{ borderColor: b.accentColor }}
            >
                <p className="text-sm font-semibold leading-tight">{name}</p>
                {stack && <p className="font-mono text-[11px] leading-tight text-mist/75">{stack}</p>}
            </div>
        </Html>
    );
};

export default BuildingLabel;
