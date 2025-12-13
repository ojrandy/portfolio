import Hero from "./sections/Hero.jsx";
import ShowcaseSection from "./sections/ShowcaseSection.jsx";
import NavBar from "./components/NavBar.jsx";
import LogoSection from "./sections/LogoSection.jsx";
import FeatureCards from "./sections/FeatureCards.jsx";
import ExperienceSection from "./sections/ExperienceSection.jsx";
import TechStack from "./sections/TechStack.jsx";
import Testimonial from "./sections/Testimonial.jsx";
import Contact from "./sections/Contact.jsx";

const App = () => {
    return (
       <>
           <NavBar />
           <Hero />
           <ShowcaseSection />
           <LogoSection />
           <FeatureCards />
           <ExperienceSection />
           <TechStack />
           <Testimonial />
           <Contact />
       </>
    )
}
export default App
