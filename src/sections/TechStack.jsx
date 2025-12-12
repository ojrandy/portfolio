import TitleHeader  from "../components/TitleHeader.jsx";
import {techStackIcons, techStackImgs} from "../constants/index.js";
import TechIcon from "../components/Models/TechLogos/TechIcon.jsx";
import {useGSAP} from "@gsap/react";
import {gsap} from 'gsap'

const TechStack = () => {
    // Animating the TechIcons using GSAP
    useGSAP(() => {
        gsap.fromTo(".tech-card", {
            y: 50,
            opacity: 0,
        }, {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power2.inOut",
            stagger: 0.2,
            scrollTrigger: {
                trigger: "#skills",
                start: "top center",
                scrub: true,
            },
        })
    })
    return (
        <div id="skills" className="flex-center section-padding" >
            <div className="w-full h-full md:px-10 px-5">
                <TitleHeader
                    title="My Prefered Tech Stacks"
                    sub= "💻What i bring to the Table 📈 "
                />
                {/* The Grid Section */}
                <div className="tech-grid">
                    {techStackIcons.map((icon) =>(
                        <div key={icon.name} className="tech-card-content card-border overflow-hidden group xl:rounded-full rounded-lg ">
                           <div className="tech-card-animated-bg" />
                            {/* This container will contain the 3d model */}
                            <div className="tech-card-content">
                                <div className="tech-icon-wrapper">
                                    <TechIcon model={icon} />
                                </div>

                                <div className="padding-x w-full">
                                    <p>{icon.name}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Adding images instead of glb models */}
                    {/* 
                        techStackImgs.map((icon) =>(
                            <div key={icon.name} className="tech-card-content card-border overflow-hidden group xl:rounded-full rounded-lg ">
                                <div className="tech-card-animated-bg" />
                                
                                <div className="tech-card-content">
                                    <div className="tech-icon-wrapper">
                                        <img src={icon.imgPath} alt={icon.name} />
                                    </div>

                                    <div className="padding-x w-full">
                                        <p>{icon.name}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    */}

                </div>
            </div>

        </div>
    )
}
export default TechStack