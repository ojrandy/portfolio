import { lazy, Suspense } from "react";
import Hero from "./sections/Hero.jsx";
import ShowcaseSection from "./sections/ShowcaseSection.jsx";
import NavBar from "./components/NavBar.jsx";
import LogoSection from "./sections/LogoSection.jsx";
import ExperienceSection from "./sections/ExperienceSection.jsx";
import TechStack from "./sections/TechStack.jsx";
import Contact from "./sections/Contact.jsx";
import Footer from "./sections/Footer.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import CursorGlow from "./components/CursorGlow.jsx";
import GuideLauncher from "./components/Guide/GuideLauncher.jsx";

// The one-page site has no project panels yet (P5-02), so chips are labels; "contact" scrolls to the form.
const scrollToContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

// The 3D city on /?city (unlinked, noindex) until P5-02's mode router. Dev adds the HUD.
const City = import.meta.env.DEV
    ? lazy(() => import("./city/CityPreview.jsx"))
    : lazy(() => import("./city/CityExperience.jsx"));
const showCity = new URLSearchParams(window.location.search).has("city");

const App = () => {
    if (showCity) {
        return (
            <>
                <CursorGlow />
                <Suspense fallback={<LoadingScreen />}>
                    <City />
                </Suspense>
            </>
        );
    }

    return (
       <>
           <CursorGlow />
           <NavBar />
           <Hero />
           <ShowcaseSection />
           <LogoSection />
           <ExperienceSection />
           <TechStack />
           <Contact />
           <Footer />
           <GuideLauncher corner="bottom" className="fixed bottom-4 right-4" onContact={scrollToContact} />
       </>
    )
}
export default App
