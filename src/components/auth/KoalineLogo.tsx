import React, { useEffect, useState } from 'react';

const LETTERS = ['K', 'o', 'a', 'l', 'i', 'n', 'e'];
const FONTS = ['Inter, sans-serif', 'Georgia, serif', 'Trebuchet MS, sans-serif', 'Courier New, monospace', 'Arial Black, sans-serif'];

export const KoalineLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [fonts, setFonts] = useState<string[]>(() => LETTERS.map(() => FONTS[0]));
  useEffect(() => {
    const timer = window.setInterval(() => setFonts(LETTERS.map(() => FONTS[Math.floor(Math.random() * FONTS.length)])), 650);
    return () => window.clearInterval(timer);
  }, []);
  return <div className={`koaline-logo ${className}`.trim()} aria-label="Koaline!">
    {LETTERS.map((letter, index) => <span key={`${letter}-${index}`} aria-hidden="true" style={{ fontFamily: fonts[index] }}>{letter}</span>)}
    <span className="koaline-logo-exclamation" aria-hidden="true">!</span>
  </div>;
};

