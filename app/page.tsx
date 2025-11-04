'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import MainContent from '@/components/MainContent';
import Features from '@/components/Features';
import Demo from '@/components/Demo';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <MainContent />
      <Features />
      <Demo />
      <Footer />
    </>
  );
}
