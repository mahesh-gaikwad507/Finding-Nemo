import { useEffect, useMemo } from 'react';
import './OceanBackground.css';

/**
 * OceanBackground — Ultra-classy animated deep underwater scene with
 * swimming fish (Nemo the Clownfish, Dory the Blue Tang, Crush the Sea Turtle,
 * bioluminescent Jellyfish, and deep manta ray), rising bubbles, and caustic sunlight rays.
 */
export default function OceanBackground() {
  // Generate random bubble positions
  const bubbles = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: `${(i * 5.6 + Math.random() * 4).toFixed(1)}%`,
      size: `${Math.floor(10 + Math.random() * 22)}px`,
      duration: `${(10 + Math.random() * 14).toFixed(1)}s`,
      delay: `${(Math.random() * 8).toFixed(1)}s`,
      wobble: `${(2 + Math.random() * 3).toFixed(1)}s`,
    }));
  }, []);

  return (
    <div className="ocean-bg-container" aria-hidden="true">
      {/* Surface Light Caustics */}
      <div className="ocean-caustics-layer" />
      <div className="ocean-god-rays" />

      {/* Floating Bubbles */}
      <div className="ocean-bubbles-layer">
        {bubbles.map((b) => (
          <span
            key={b.id}
            className="ocean-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}, ${b.wobble}`,
              animationDelay: `${b.delay}, 0s`,
            }}
          />
        ))}
      </div>

      {/* Swimming Aquatic Creatures */}
      <div className="aquatic-life-layer">
        {/* Clownfish 1 (Nemo) - Mid layer, swimming left to right */}
        <div className="creature-wrapper nemo-swim-1">
          <svg className="fish-svg nemo-fish" viewBox="0 0 100 65" width="85" height="55">
            <defs>
              <linearGradient id="nemoOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff7b25" />
                <stop offset="60%" stopColor="#ff4d00" />
                <stop offset="100%" stopColor="#c92a00" />
              </linearGradient>
              <filter id="glowNemo" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ff6b00" floodOpacity="0.4" />
              </filter>
            </defs>
            {/* Tail Fin */}
            <path className="fish-tail" d="M22,32 C8,18 4,12 8,32 C4,52 8,46 22,32 Z" fill="url(#nemoOrange)" />
            <path d="M12,22 C14,26 14,38 12,42" stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.9" />
            <path d="M8,18 C10,24 10,40 8,46" stroke="#111" strokeWidth="1.5" fill="none" />
            
            {/* Dorsal Fin */}
            <path d="M42,20 C52,6 64,8 70,22 Z" fill="#ff5a00" stroke="#111" strokeWidth="1.2" />
            <path d="M50,11 C58,12 66,16 68,22" stroke="#fff" strokeWidth="1.8" fill="none" />

            {/* Main Body */}
            <path
              d="M20,32 C26,14 65,12 84,32 C65,52 26,50 20,32 Z"
              fill="url(#nemoOrange)"
              filter="url(#glowNemo)"
            />

            {/* White Stripes */}
            {/* Stripe 1 (Head) */}
            <path d="M68,17 C73,22 73,42 68,47 C65,45 65,19 68,17 Z" fill="#ffffff" stroke="#111" strokeWidth="1" />
            {/* Stripe 2 (Middle) with black contour */}
            <path d="M48,16 C53,23 53,41 48,48 C44,46 44,18 48,16 Z" fill="#ffffff" stroke="#111" strokeWidth="1" />

            {/* Eye */}
            <circle cx="78" cy="28" r="5" fill="#ffffff" />
            <circle cx="79.5" cy="28" r="2.8" fill="#111827" />
            <circle cx="80.5" cy="27" r="1" fill="#ffffff" />

            {/* Pectoral Fin (Undulating) */}
            <path className="pectoral-fin" d="M54,34 C62,35 66,44 58,45 C54,44 52,38 54,34 Z" fill="#ff7b25" stroke="#111" strokeWidth="1" />
          </svg>
        </div>

        {/* Blue Tang (Dory) - Upper mid layer, swimming right to left */}
        <div className="creature-wrapper dory-swim-1">
          <svg className="fish-svg dory-fish" viewBox="0 0 110 70" width="90" height="58">
            <defs>
              <linearGradient id="doryBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="50%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="doryYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            {/* Yellow Tail */}
            <path className="fish-tail-alt" d="M85,35 C100,16 104,18 96,35 C104,52 100,54 85,35 Z" fill="url(#doryYellow)" />
            {/* Body */}
            <path
              d="M90,35 C82,14 42,12 22,35 C42,58 82,56 90,35 Z"
              fill="url(#doryBlue)"
            />
            {/* Black Pattern */}
            <path
              d="M78,35 C70,22 45,22 34,35 C45,42 70,42 78,35 Z"
              fill="#090d16"
              opacity="0.9"
            />
            {/* Yellow fin highlight */}
            <path d="M52,36 C42,39 38,46 44,48 C50,47 54,42 52,36 Z" fill="url(#doryYellow)" />
            {/* Eye */}
            <circle cx="30" cy="30" r="5" fill="#f8fafc" />
            <circle cx="28.5" cy="30" r="2.8" fill="#818cf8" />
            <circle cx="28" cy="30" r="1.6" fill="#090d16" />
            <circle cx="27.5" cy="29" r="0.8" fill="#fff" />
          </svg>
        </div>

        {/* Sea Turtle (Crush) - Upper deep current, gliding slowly */}
        <div className="creature-wrapper turtle-swim">
          <svg className="turtle-svg" viewBox="0 0 130 90" width="115" height="80">
            <defs>
              <linearGradient id="turtleShell" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="60%" stopColor="#047857" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
            {/* Front Flippers */}
            <path className="turtle-flipper front-flipper" d="M75,32 C95,12 118,10 114,24 C104,36 85,42 75,32 Z" fill="#10b981" />
            <path className="turtle-flipper back-flipper" d="M75,58 C95,78 118,80 114,66 C104,54 85,48 75,58 Z" fill="#059669" />
            
            {/* Rear flippers */}
            <path d="M30,35 C18,25 14,30 22,40 Z" fill="#047857" />
            <path d="M30,55 C18,65 14,60 22,50 Z" fill="#047857" />

            {/* Head */}
            <ellipse cx="108" cy="45" rx="12" ry="8" fill="#10b981" />
            <circle cx="112" cy="43" r="2.2" fill="#064e3b" />

            {/* Shell (Carapace) */}
            <ellipse cx="55" cy="45" rx="34" ry="24" fill="url(#turtleShell)" stroke="#34d399" strokeWidth="1.8" />
            {/* Hexagonal shell scutes */}
            <polygon points="55,32 65,37 65,49 55,54 45,49 45,37" fill="none" stroke="#6ee7b7" strokeWidth="1.2" opacity="0.6" />
            <polygon points="72,36 80,40 80,48 72,52 66,48 66,40" fill="none" stroke="#6ee7b7" strokeWidth="1" opacity="0.5" />
            <polygon points="38,36 44,40 44,48 38,52 30,48 30,40" fill="none" stroke="#6ee7b7" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Bioluminescent Jellyfish - Pulsing and floating upward */}
        <div className="creature-wrapper jellyfish-pulse jellyfish-1">
          <svg className="jellyfish-svg" viewBox="0 0 70 120" width="55" height="95">
            <defs>
              <linearGradient id="jellyGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 240, 255, 0.85)" />
                <stop offset="60%" stopColor="rgba(168, 85, 247, 0.6)" />
                <stop offset="100%" stopColor="rgba(0, 240, 255, 0.15)" />
              </linearGradient>
            </defs>
            {/* Bell Umbrella */}
            <path
              className="jelly-bell"
              d="M10,40 C10,12 60,12 60,40 C52,44 45,38 35,42 C25,38 18,44 10,40 Z"
              fill="url(#jellyGlow)"
            />
            {/* Inner glow organ */}
            <ellipse cx="35" cy="30" rx="14" ry="10" fill="rgba(255,255,255,0.4)" filter="blur(2px)" />
            {/* Tentacles */}
            <path className="tentacle t1" d="M22,42 Q18,65 24,90 Q20,105 23,115" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" fill="none" />
            <path className="tentacle t2" d="M30,43 Q35,70 28,95 Q33,110 30,120" stroke="rgba(216,180,254,0.8)" strokeWidth="1.8" fill="none" />
            <path className="tentacle t3" d="M40,43 Q36,72 42,94 Q38,108 41,118" stroke="rgba(216,180,254,0.8)" strokeWidth="1.8" fill="none" />
            <path className="tentacle t4" d="M48,42 Q52,65 46,90 Q50,105 47,115" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" fill="none" />
          </svg>
        </div>

        {/* Second smaller Jellyfish */}
        <div className="creature-wrapper jellyfish-pulse jellyfish-2">
          <svg className="jellyfish-svg" viewBox="0 0 70 120" width="40" height="70">
            <use href="#jellyGlow" />
            <path
              className="jelly-bell"
              d="M12,38 C12,14 58,14 58,38 C50,42 43,36 35,40 C27,36 20,42 12,38 Z"
              fill="url(#jellyGlow)"
            />
            <ellipse cx="35" cy="28" rx="12" ry="8" fill="rgba(255,255,255,0.3)" />
            <path className="tentacle t1" d="M25,40 Q22,60 27,85 Q24,100 26,110" stroke="rgba(0,240,255,0.6)" strokeWidth="1.2" fill="none" />
            <path className="tentacle t2" d="M35,40 Q38,65 33,90 Q37,105 35,115" stroke="rgba(244,114,182,0.7)" strokeWidth="1.5" fill="none" />
            <path className="tentacle t3" d="M45,40 Q48,60 43,85 Q46,100 44,110" stroke="rgba(0,240,255,0.6)" strokeWidth="1.2" fill="none" />
          </svg>
        </div>

        {/* Deep Silhouette Manta Ray */}
        <div className="creature-wrapper manta-glide">
          <svg className="manta-svg" viewBox="0 0 160 100" width="140" height="88">
            <path
              d="M80,20 C110,32 155,55 145,62 C125,60 105,52 90,62 C86,75 84,95 83,98 C82,98 80,75 76,62 C61,52 41,60 21,62 C11,55 56,32 80,20 Z"
              fill="rgba(0, 240, 255, 0.08)"
            />
          </svg>
        </div>
      </div>

      {/* Sea Floor Bioluminescent Reef Silhouettes & Corals */}
      <div className="ocean-floor-reef" />
    </div>
  );
}
