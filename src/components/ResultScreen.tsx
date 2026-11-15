import { useEffect, useRef, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type { GenerateDinoResponse, DinoAttributes } from '../../shared/types';
import { CardScene, type CardSceneHandle } from './CardScene';
import { calculateRarity } from '../utils/speciesHash';
import { triggerHaptic, HAPTIC_TAP, RARITY_HAPTIC_PATTERNS } from '../haptics';

interface ResultScreenProps {
  result: GenerateDinoResponse;
  attrs: DinoAttributes;
  discovererName: string;
  onDownloadClick: () => void;
  onRestart: () => void;
}

// Shared by the three dock segments below. `rounded-[999px]`, not
// `rounded-full` — this project's Tailwind theme resolves `rounded-full` to 4px.
const DOCK_BUTTON_BASE =
  'min-h-[56px] px-1 flex flex-col items-center justify-center gap-[3px] rounded-[999px] font-display2 font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1a0f]';

// Inline stroke icons (Lucide shapes) rather than glyphs — the old ⟳/↻ pair
// for "Girar"/"Otra especie" were nearly indistinguishable. Decorative only
// (aria-hidden); each button carries its own accessible name.
function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

function FlipIcon() {
  return (
    <IconBase>
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v2M12 14v2M12 8v2M12 2v2" />
    </IconBase>
  );
}

function DownloadIcon() {
  return (
    <IconBase>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </IconBase>
  );
}

function SparklesIcon() {
  return (
    <IconBase>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </IconBase>
  );
}

export function ResultScreen({ result, attrs, discovererName, onDownloadClick, onRestart }: ResultScreenProps) {
  const cardSceneRef = useRef<CardSceneHandle>(null);
  // Not used to drive any visual change — the card's own flip animation is
  // entirely CSS/imperative (see CardScene.tsx). This exists purely so the
  // "Girar" button can carry an aria-label describing which face is
  // currently showing, since the 3D tilt/flip interaction itself has no
  // keyboard or screen-reader-native equivalent otherwise.
  const [cardFacing, setCardFacing] = useState<'front' | 'back'>('back');

  useEffect(() => {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    // Tiered by rarity (see RARITY_HAPTIC_PATTERNS in haptics.ts) so a
    // legendary reveal physically feels like a bigger deal than a common
    // one — Android only, iOS Safari has no Vibration API and no-ops here.
    triggerHaptic(RARITY_HAPTIC_PATTERNS[calculateRarity(attrs)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extra top/bottom padding (was pt-4/pb-8) is a deliberate scroll-comfort
  // buffer, not just spacing taste: even with vertical touch drags now
  // scrolling the page instead of tilting the card (touch-action: pan-y in
  // index.css), a tall card can still fill nearly the entire viewport on
  // short phones, leaving little visible non-card chrome to rest a thumb
  // on. This padding guarantees a bit of always-scrollable page space
  // above/below the card regardless of viewport height, as a
  // belt-and-suspenders complement to the pan-y fix — not a replacement for
  // it, and deliberately no on-screen hint copy since scrolling now works
  // from anywhere, including directly on the card.
  return (
    <div className="min-h-screen flex items-start justify-center pt-6 pb-16 px-4">
      <div className="max-w-xl w-full text-center">
        {/* Visually hidden but a real h1 — the only heading rendered on
            this screen before the Card's own h2 (dino name) further down,
            so this establishes the page's top-level heading without
            changing the visual design. */}
        <h1 role="status" aria-live="polite" className="sr-only">
          ¡Nueva especie descubierta! {result.commonName}, {result.scientificName}.
        </h1>
        <CardScene
          ref={cardSceneRef}
          discovererName={discovererName}
          result={result}
          attrs={attrs}
          onFacingChange={setCardFacing}
        />
        {/* Single-row "dock": one pill with three segments (flip | download |
            new species), icon on top / short label below, the download
            segment filled magenta as the primary action. Replaced a
            two-tier layout (full-width download + 2-col secondary grid)
            whose ⟳/↻ icons were near-identical. Still always renders fully
            below the card — a sticky bar / on-card FAB was rejected earlier
            because both can overlap the card (a tall dino's cutout can pop
            past the frame edge). Visible labels are shorter than the
            accessible names ("Descargar" vs aria-label "Descargar carta")
            so they fit one row at 343px; each aria-label still contains its
            visible text. `max-w-[420px] mx-auto` matches CardScene's natural
            width so the dock is never wider than the card above it. */}
        <div
          role="group"
          aria-label="Acciones de la carta"
          className="mt-3 max-w-[420px] mx-auto grid grid-cols-[1fr_1.3fr_1fr] gap-0.5 p-1 rounded-[999px] bg-white/5 border border-brand/35 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_TAP);
              cardSceneRef.current?.spin();
            }}
            aria-label={
              cardFacing === 'front'
                ? 'Girar carta para ver el reverso'
                : 'Girar carta para ver el anverso'
            }
            className={`${DOCK_BUTTON_BASE} text-brand-light hover:bg-brand/15`}
          >
            <FlipIcon />
            Girar
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_TAP);
              onDownloadClick();
            }}
            aria-label="Descargar carta"
            className={`${DOCK_BUTTON_BASE} text-white bg-[#d1187f] shadow-[0_4px_14px_rgba(209,24,127,0.45)] hover:bg-[#e01c8a]`}
          >
            <DownloadIcon />
            Descargar
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_TAP);
              onRestart();
            }}
            aria-label="Otra especie"
            className={`${DOCK_BUTTON_BASE} text-brand-light hover:bg-brand/15`}
          >
            <SparklesIcon />
            Otra especie
          </button>
        </div>
      </div>
    </div>
  );
}
