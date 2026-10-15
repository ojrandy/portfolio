import { lazy, Suspense } from "react";
import Hero from "./sections/Hero.jsx";
import ShowcaseSection from "./sections/ShowcaseSection.jsx";
import NavBar from "./components/NavBar.jsx";
import LogoSection from "./sections/LogoSection.jsx";
import FeatureCards from "./sections/FeatureCards.jsx";
import ExperienceSection from "./sections/ExperienceSection.jsx";
import TechStack from "./sections/TechStack.jsx";
import Testimonial from "./sections/Testimonial.jsx";
import Contact from "./sections/Contact.jsx";
import Footer from "./sections/Footer.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";

// Dev-only building preview (/?city); compiled out of production builds.
const CityPreview = import.meta.env.DEV ? lazy(() => import("./city/CityPreview.jsx")) : null;
const showCityPreview = CityPreview && new URLSearchParams(window.location.search).has("city");

const App = () => {
    if (showCityPreview) {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <CityPreview />
            </Suspense>
        );
    }

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
           <Footer />
       </>
    )
}
export default App
