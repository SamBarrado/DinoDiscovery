import { useEffect, useRef } from 'react';
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

export function ResultScreen({ result, attrs, discovererName, onDownloadClick, onRestart }: ResultScreenProps) {
  const cardSceneRef = useRef<CardSceneHandle>(null);

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
        <CardScene ref={cardSceneRef} discovererName={discovererName} result={result} attrs={attrs} />
        {/* Two-tier button hierarchy: the download CTA gets its own
            full-width row so it's unmissable as the primary action, while
            the secondary actions (flip, restart) sit in a fixed 2-column
            grid below, icon-on-top/label-below — a grid rather than the old
            flex-wrap row, so the layout is identical (not reflow-dependent)
            from a narrow phone up through desktop. Chosen over a sticky
            bottom bar / an on-card FAB because both of those would overlap
            the card itself while scrolling past it (a tall dino's cutout can
            pop past the frame edge); this option always renders fully below
            the card. `max-w-[420px] mx-auto` matches CardScene's own natural
            width so this row is never wider than the card above it — before
            this it inherited the outer `max-w-xl` (576px) wrapper, visibly
            overhanging the card on any viewport wider than ~420px. */}
        <div className="mt-3 flex flex-col gap-2 max-w-[420px] mx-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_TAP);
              onDownloadClick();
            }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-white font-display2 font-semibold uppercase tracking-wide rounded-[999px] bg-[#d1187f] hover:shadow-[6px_6px_0_0_#f5e6c8] transition-shadow"
          >
            <span aria-hidden="true">⬇</span> Descargar carta
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(HAPTIC_TAP);
                cardSceneRef.current?.spin();
              }}
              className="flex flex-col items-center justify-center gap-1 min-h-[52px] px-4 py-2 text-brand-light font-display2 font-semibold uppercase text-sm tracking-wide rounded-2xl border border-brand/40 hover:border-brand transition-colors"
            >
              <span aria-hidden="true" className="text-lg leading-none">⟳</span>
              Girar
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(HAPTIC_TAP);
                onRestart();
              }}
              className="flex flex-col items-center justify-center gap-1 min-h-[52px] px-4 py-2 text-brand-light font-display2 font-semibold uppercase text-sm tracking-wide rounded-2xl border border-brand/40 hover:border-brand transition-colors"
            >
              <span aria-hidden="true" className="text-lg leading-none">↻</span>
              Otra especie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
