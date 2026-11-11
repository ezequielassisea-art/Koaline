import React, { useEffect, useState, useRef } from 'react';
import { Settings } from 'lucide-react';

const fonts = [
  'font-[Outfit]',
  'font-[Dancing_Script]',
  'font-[Space_Grotesk]',
  'font-[DM_Serif_Display]',
  'font-[Inter]',
  'font-[Poppins]',
  'font-[JetBrains_Mono]',
];

const phrases = [
  'Conectando jogadores...',
  'Preparando o lobby...',
  'Construindo novas arenas...',
  'A próxima geração dos chats gamer está chegando...',
];

export const MaintenancePage: React.FC = () => {
  const [logoStyles, setLogoStyles] = useState<{ font: string; weight: string }[]>(
    Array.from({ length: 8 }, () => ({ font: fonts[0], weight: 'font-extrabold' }))
  );
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [phraseOpacity, setPhraseOpacity] = useState(1);

  // Logo animation - change font for each letter every 650ms
  useEffect(() => {
    const interval = setInterval(() => {
      setLogoStyles((prev) =>
        prev.map(() => ({
          font: fonts[Math.floor(Math.random() * fonts.length)],
          weight: Math.random() > 0.5 ? 'font-extrabold' : 'font-bold',
        }))
      );
    }, 650);
    return () => clearInterval(interval);
  }, []);

  // Phrase rotation every 3 seconds with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseOpacity(0);
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
        setPhraseOpacity(1);
      }, 500);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const logoLetters = ['K', 'o', 'a', 'l', 'i', 'n', 'e', '!'];

  return (
    <div className="fixed inset-0 flex items-center justify-center min-h-screen w-full overflow-hidden">
      {/* Video Background - Extreme Blur */}
      <video
        className="fixed inset-0 w-full h-full object-cover -z-20 blur-3xl"
        autoPlay
        loop
        muted
        playsInline
        src="/large.mp4"
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          e.currentTarget.play();
        }}
        style={{ filter: 'blur(24px)' }}
      />
      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-[#0f172a]/70 -z-10" />

      {/* Center Card - Dark Glassmorphism */}
      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
          {/* Animated Logo - White text with blue exclamation */}
          <div className="flex justify-center gap-0.5 mb-8" style={{ fontSize: 'clamp(2.5rem, 7vw, 4rem)' }}>
            {logoLetters.map((letter, index) => (
              <span
                key={index}
                className={`${logoStyles[index].font} ${logoStyles[index].weight} text-5xl tracking-tight ${
                  letter === '!' ? 'text-blue-500' : 'text-white'
                }`}
              >
                {letter}
              </span>
            ))}
          </div>

          {/* Spinning Gear Icon - Centered, White */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-6 mx-auto">
            <Settings
              className="w-8 h-8 text-white animate-spin"
              style={{ animationDuration: '3s' }}
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">Em Manutenção</h1>

          {/* Subtitle - Gray-200 for contrast */}
          <p className="text-gray-200 text-base leading-relaxed mb-8">
            Estamos trabalhando nos bastidores para melhorar sua experiência.
          </p>

          {/* Animated Phrases - Blue-400, font-semibold */}
          <div
            className="h-8 transition-opacity duration-500 ease-in-out"
            style={{ opacity: phraseOpacity }}
          >
            <p className="text-blue-400 font-semibold text-sm">{phrases[currentPhraseIndex]}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-300 text-sm">
          <p>Koaline • Volte mais tarde</p>
        </div>
      </div>
    </div>
  );
};