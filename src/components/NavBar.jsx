import React, {useEffect, useState} from 'react'
import {navLinks} from "../constants/index.js";

const NavBar = () => {

    {/* state to know where the user is to set a background */}
    const [scrolled, setScrolled] = useState(false);

    {/* Check if user has scrolled atleast 10px */}
    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 10;
            setScrolled(true)
        }

        window.addEventListener("scroll", handleScroll);

        { /* clean up function */}
        return () => window.removeEventListener("scroll", handleScroll);

    }, []);

    return (
        < header className={`navbar ${scrolled ? 'scrolled' : 'not-scrolled'}`}>
            <div className="inner">
                <a className="logo" href="#hero">
                    OJ | TECH
                </a>

                <nav className="desktop">
                    <ul>
                        {/* This is to loop through the navLinks array */}
                        {navLinks.map(({link, name}) => (
                            <li key={name}>
                                <a href={link}>
                                    <span> {name}</span>
                                    <span className="underline" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* This is to ensure the contact btn is good in mobile devices */}
                    <a href="#contact" className="contact-btn group">
                        <div className="inner">
                            <span>Contact Me</span>
                        </div>
                    </a>

            </div>
        </header>
    )
}
export default NavBar
