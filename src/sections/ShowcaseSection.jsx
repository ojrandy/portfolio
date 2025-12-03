import React, {useRef} from 'react'
import gsap from 'gsap'
import {useGSAP} from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);


const ShowcaseSection = () => {

    const sectionRef = useRef(null);
    const project1Ref = useRef(null);
    const project2Ref = useRef(null);
    const project3Ref = useRef(null);

    useGSAP(() => {

        {/* Styling individual Cards */}
        const projects = [project1Ref.current, project2Ref.current, project3Ref.current];

        projects.forEach((card, index) => {
            gsap.fromTo(
                card,{
                    y: 50, opacity: 0,
                },
                {
                    y:0, opacity: 1,
                    duration: 1,
                    delay: 0.3 * (index + 1),
                    scrollTrigger: {
                        trigger: card,
                        start: "top bottom-=100",
                        end: "bottom 80%",
                        scrub: true
                    },
                    ease: "power2.inOut",
                }
            )
        })

        gsap.fromTo(
            sectionRef.current,
            {y: 50, opacity: 0},
            {y: 0, opacity: 1, duration: 1, ease: "power2.inOut",
                scrollTrigger: {trigger: sectionRef.current, start: "top 80%", end: "bottom 80%", scrub: true}}
        )
    }, [])
    {/* The dependency array controls when the effect runs and prevent rendering*/}

    return (
        <section id="work" ref={sectionRef} className="app-showcase">
            <div className="w-full">
                <div className="showcaselayout">
                    {/* Left */}
                    <div className="first-project-wrapper" ref={project1Ref}>
                        <div className="image-wrapper">
                            <img src="/images/project1.png" alt=" Project Image " />
                        </div>
                        <div className="text-content">
                            <h2>
                                On Deman rides made simple with Powerful User-friendly app called Ryde
                            </h2>
                            <p className="text-white-50 nd:text-xl">
                                An App available on Google Play store. Its build with React Native, Expo Tailwind Css for Styling
                                and Firebase for Backend.
                            </p>
                        </div>
                    </div>
                    {/* Right */}
                    <div className="project-list-wrapper overflow-hidden">
                        {/* Projects */}
                        <div className="project" ref={project2Ref}>
                            <div className="image-wrapper bg-[#ffefdb]">
                                <img src="/images/project2.png" alt=" Project Image " />
                            </div>
                            <h2>
                                Library Management System
                            </h2>
                        </div> {/* Projects */}
                        <div className="project" ref={project3Ref}>
                            <div className="image-wrapper bg-[#ffe7eb]">
                                <img src="/images/project3.png" alt=" YC Directory " />
                            </div>
                            <h2>
                                A Startup Showcase
                            </h2>
                        </div>

                    </div>

                </div>
            </div>
        </section>
    )
}
export default ShowcaseSection
