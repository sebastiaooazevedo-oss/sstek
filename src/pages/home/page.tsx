import SiteNavbar from "@/components/feature/SiteNavbar";
import SiteFooter from "@/components/feature/SiteFooter";
import Hero from "./components/Hero";
import StatsBand from "./components/StatsBand";
import Features from "./components/Features";
import Segments from "./components/Segments";
import HowItWorks from "./components/HowItWorks";
import Profiles from "./components/Profiles";
import QrSection from "./components/QrSection";
import Evaluations from "./components/Evaluations";
import Plans from "./components/Plans";
import Testimonials from "./components/Testimonials";
import Faq from "./components/Faq";
import CtaFinal from "./components/CtaFinal";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-background-50">
      <SiteNavbar />
      <main>
        <Hero />
        <StatsBand />
        <Features />
        <Segments />
        <HowItWorks />
        <Profiles />
        <QrSection />
        <Evaluations />
        <Plans />
        <Testimonials />
        <Faq />
        <CtaFinal />
      </main>
      <SiteFooter />
    </div>
  );
}