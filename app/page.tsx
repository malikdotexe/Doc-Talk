'use client';

import { useState } from "react";
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import MainContent from '@/components/MainContent';
import Features from '@/components/Features';
import Demo from '@/components/Demo';
import Footer from '@/components/Footer';

export default function Home() {
  const [useOCR, setUseOCR] = useState(false);

  return (
    <>
      <Header />
      <Hero useOCR={useOCR} setUseOCR={setUseOCR} />
      <MainContent useOCR={useOCR} />
      <Features />
      <Demo />
      <Footer />
    </>
  );
}
