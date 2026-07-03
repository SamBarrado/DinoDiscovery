import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { GenerateDinoResponse, DinoAttributes } from '../../shared/types';
import { Card } from './Card';
import { CARD_BACK_PATH } from '../data/cardTheme';

interface CardSceneProps {
  discovererName: string;
  result: GenerateDinoResponse;
  attrs: DinoAttributes;
}

// The flip trigger used to be a button rendered by CardScene itself, but the
// result-screen button layout (see ResultScreen.tsx) groups "Girar carta"
// alongside "Detectar otra especie" in a single row below the card, which
// requires the button to be a sibling of CardScene, not a child of it. This
// handle exposes the spin behavior (whose animation state lives here, tied to
// the card's own flip/tilt/facing machinery) so ResultScreen can trigger it.
export interface CardSceneHandle {
  spin: () => void;
}

export function clampTilt(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  maxDeg: number
): { rotateX: number; rotateY: number } {
  const px = (clientX - rect.left) / rect.width - 0.5;
  const py = (clientY - rect.top) / rect.height - 0.5;
  const rotateY = Math.max(-maxDeg, Math.min(maxDeg, px * maxDeg * 2)) || 0;
  const rotateX = Math.max(-maxDeg, Math.min(maxDeg, -py * maxDeg * 2)) || 0;
  return { rotateX, rotateY };
}

// Card.tsx is built at a fixed 420px design width (its internal 3-layer
// stacking — frame / dino / text overlay — is positioned with literal px
// math that isn't worth making fluid). Rather than touch that, this scales
// the whole thing down uniformly to fit narrower viewports: a CSS
// transform:scale() applies identically to all three absolutely-positioned
// sibling layers, so they never drift out of alignment with each other.
export function computeFitScale(availableWidth: number, naturalWidth: number): number {
  if (naturalWidth <= 0 || availableWidth <= 0) return 1;
  return Math.min(1, availableWidth / naturalWidth);
}

const CARD_NATURAL_WIDTH = 420;

// The dino's cutout layer pops past the framed box's top/bottom edges
// (scale-110 + drop-shadow), but Card.tsx's own box height doesn't grow to
// account for it (it's an absolutely-positioned sibling). Reserve extra
// space below the scaled card so that overflow never visually collides with
// the buttons rendered after CardScene in ResultScreen.
const DINO_OVERFLOW_BUFFER_PX = 16;

const MAX_TILT_DEG = 15;
const FLIP_DURATION_MS = 800;
const SPIN_DURATION_MS = 1400;
const DRAG_SENSITIVITY_DEG_PER_PX = 0.6;
const DRAG_SNAP_TRANSITION = '320ms ease-out';
const TILT_ACTIVE_TRANSITION = '80ms linear';
const TILT_RESET_TRANSITION = '400ms ease-out';
const FLIP_TRANSITION = `transform ${FLIP_DURATION_MS}ms ease-out`;
const SPIN_TRANSITION = `transform ${SPIN_DURATION_MS}ms ease-in-out`;
const NO_TRANSITION = 'none';

export const CardScene = forwardRef<CardSceneHandle, CardSceneProps>(function CardScene(
  { discovererName, result, attrs },
  ref
) {
  const [hasFlippedIn, setHasFlippedIn] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [transition, setTransition] = useState(FLIP_TRANSITION);
  const [spinDeg, setSpinDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  // Some WebKit/iOS Safari versions fail to honor backface-visibility:hidden
  // inside a 3D-transformed, filtered subtree (the dino's drop-shadow layer
  // triggers it) and render both faces blended together mid-flip. As a
  // browser-agnostic fallback, explicitly hide whichever face isn't the one
  // currently facing the viewer via visibility, timed to the midpoint of
  // each rotation — independent of whatever backface-visibility does.
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const facingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragBaseSpinRef = useRef(0);

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);

  if (!hasFlippedIn) {
    // Triggers the flip-in transition on the first paint after mount.
    requestAnimationFrame(() => setHasFlippedIn(true));
  }

  useEffect(() => {
    if (!hasFlippedIn) return;
    facingTimeoutRef.current = setTimeout(() => setFacing('front'), FLIP_DURATION_MS / 2);
    return () => {
      if (facingTimeoutRef.current !== null) {
        clearTimeout(facingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFlippedIn]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current !== null) {
        clearTimeout(spinTimeoutRef.current);
      }
      if (facingTimeoutRef.current !== null) {
        clearTimeout(facingTimeoutRef.current);
      }
    };
  }, []);

  // useLayoutEffect (not useEffect) so the fit-scale is measured and applied
  // before the browser paints — otherwise the card briefly renders at its
  // full unscaled 420px width on first paint, visibly overflowing/off-center
  // for a frame before snapping down to the correct scale.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    function update() {
      if (!outer || !inner) return;
      setScale(computeFitScale(outer.offsetWidth, CARD_NATURAL_WIDTH));
      setNaturalHeight(inner.offsetHeight);
    }

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(outer);
    resizeObserver.observe(inner);
    return () => resizeObserver.disconnect();
  }, []);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (isSpinning) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = clampTilt(event.clientX, event.clientY, rect, MAX_TILT_DEG);
    setTransition(TILT_ACTIVE_TRANSITION);
    setTilt(next);
  }

  function handleMouseLeave() {
    if (isSpinning) return;
    setTransition(TILT_RESET_TRANSITION);
    setTilt({ rotateX: 0, rotateY: 0 });
  }

  // Drag-to-rotate: the card follows the finger horizontally while dragging
  // (no CSS transition — `spinDeg` is updated directly per touchmove, so the
  // rendered rotation always matches the live drag position 1:1, with no
  // easing lag) and snaps to the nearest face (front/back) on release.
  //
  // Vertical movement is deliberately NOT read into a tilt on touch anymore
  // (it was, briefly — see below) — `.card-perspective` now sets
  // `touch-action: pan-y` instead of `none` (see index.css), so the browser
  // handles any vertical component of the drag as a native page scroll.
  // This is an accessibility fix, not a style choice: the scaled-up card
  // fills nearly the full viewport width on mobile, and `touch-action: none`
  // meant a touch starting almost anywhere on screen fully claimed the
  // gesture for the card, leaving only a sliver of screen (in practice,
  // wherever a scrollbar happened to render) as the one place that still
  // scrolled the page — a real WCAG 2.5.1 problem, not just an inconvenience,
  // since reaching the buttons below the card required finding that sliver.
  // Reading deltaY into rotateX here would fight the browser's own native
  // scroll (both would react to the same vertical drag), so vertical tilt is
  // simply not driven by touch at all now; the desktop mouse-hover tilt
  // (handleMouseMove) is untouched and still uses this same rotateX state.
  //
  // The pivot stays at the card's default center (no custom transform-origin
  // here) — an earlier version anchored it to wherever the touch started,
  // to make dragging feel like grabbing the card at that spot, but an
  // off-center pivot combined with 3D perspective visibly translates the
  // whole element toward whichever edge was touched (worse near the
  // corners), which read as broken rather than "grabbed". Reverted on
  // explicit feedback; don't reintroduce without a way to keep the element
  // visually centered despite the off-center pivot.
  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (isSpinning) return;
    const touch = event.touches[0];
    if (!touch) return;
    dragStartXRef.current = touch.clientX;
    dragBaseSpinRef.current = spinDeg;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (isSpinning || dragStartXRef.current === null) return;
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - dragStartXRef.current;
    const nextSpin = dragBaseSpinRef.current + deltaX * DRAG_SENSITIVITY_DEG_PER_PX;

    setTransition(NO_TRANSITION);
    setSpinDeg(nextSpin);
    const totalDeg = baseFlipDeg + nextSpin;
    const mod = ((totalDeg % 360) + 360) % 360;
    setFacing(mod > 90 && mod < 270 ? 'back' : 'front');
  }

  function handleTouchEnd() {
    if (isSpinning) return;
    if (dragStartXRef.current !== null) {
      dragStartXRef.current = null;
      setSpinDeg((current) => {
        const totalDeg = baseFlipDeg + current;
        const snapped = Math.round(totalDeg / 180) * 180;
        const mod = ((snapped % 360) + 360) % 360;
        setFacing(mod === 180 ? 'back' : 'front');
        return snapped - baseFlipDeg;
      });
      setTransition(DRAG_SNAP_TRANSITION);
      setTilt({ rotateX: 0, rotateY: 0 });
      return;
    }
    setTransition(TILT_RESET_TRANSITION);
    setTilt({ rotateX: 0, rotateY: 0 });
  }

  function handleSpinClick() {
    dragStartXRef.current = null;
    if (spinTimeoutRef.current !== null) {
      clearTimeout(spinTimeoutRef.current);
    }
    if (facingTimeoutRef.current !== null) {
      clearTimeout(facingTimeoutRef.current);
    }
    // A full +360 spin always ends up visually identical to where it
    // started, whichever face that was (the card may already be resting on
    // its back from a drag-flip) — so the facing sequence and the end-state
    // reset must both be relative to the *current* facing, never hardcoded
    // to 'front'/0. Hardcoding either was the cause of a visible jump-cut
    // (the card appearing to vanish for a frame) whenever the spin was
    // triggered from the back face.
    const startFacing = facing;
    setIsSpinning(true);
    setHasFlippedIn(true);
    setTransition(SPIN_TRANSITION);
    setTilt({ rotateX: 0, rotateY: 0 });
    setSpinDeg((current) => current + 360);
    facingTimeoutRef.current = setTimeout(() => {
      setFacing(startFacing === 'front' ? 'back' : 'front');
      facingTimeoutRef.current = setTimeout(() => {
        facingTimeoutRef.current = null;
        setFacing(startFacing);
      }, SPIN_DURATION_MS * 0.55);
    }, SPIN_DURATION_MS * 0.2);
    spinTimeoutRef.current = setTimeout(() => {
      spinTimeoutRef.current = null;
      setIsSpinning(false);
      setTransition(TILT_RESET_TRANSITION);
      setSpinDeg((current) => current - 360);
      setTilt({ rotateX: 0, rotateY: 0 });
      setFacing(startFacing);
    }, SPIN_DURATION_MS);
  }

  useImperativeHandle(ref, () => ({ spin: handleSpinClick }));

  const baseFlipDeg = hasFlippedIn ? 0 : 180;
  const totalRotateY = baseFlipDeg + tilt.rotateY + spinDeg;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        ref={outerRef}
        className="relative w-full overflow-visible"
        style={{
          height: naturalHeight ? (naturalHeight + DINO_OVERFLOW_BUFFER_PX) * scale : undefined,
        }}
      >
        <div
          ref={innerRef}
          className="absolute left-1/2 top-0 card-scene-wrapper"
          style={{
            width: CARD_NATURAL_WIDTH,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          <div
            className="card-perspective"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div
              ref={flipperRef}
              className="card-flipper"
              style={{
                transform: `rotateX(${tilt.rotateX}deg) rotateY(${totalRotateY}deg)`,
                transition,
              }}
            >
              <div className="card-face" style={{ visibility: facing === 'front' ? 'visible' : 'hidden' }}>
                <Card
                  discovererName={discovererName}
                  result={result}
                  attrs={attrs}
                  // Temporarily disabled (not removed) — the user wants the
                  // on-screen watermark deterrent paused until the
                  // downloaded-card rendering is confirmed pixel-perfect
                  // against the on-screen version. Card.tsx's `watermark`
                  // prop/implementation is untouched; re-add `watermark`
                  // here (a bare boolean prop) once that's resolved.
                  foilTilt={{
                    // Driven by the card's actual total rotation (not just
                    // live hover/drag tilt) so the foil visibly shifts as
                    // the card is spun/flipped, not only while a mouse
                    // happens to be hovering it. `sin` gives a smooth,
                    // naturally bounded -1..1 value that cycles as the card
                    // rotates all the way around, and is 0 at rest facing
                    // the viewer head-on (0°/360°) so it doesn't fight the
                    // resting position baked into Card.tsx's own gradient
                    // offset. Using `tilt.rotateY` here (an earlier version
                    // did) was a bug: that field is only ever set by desktop
                    // mouse hover, never by touch drag, so on an actual
                    // phone — the primary way anyone interacts with this
                    // card — the foil never reacted to rotation at all.
                    x: Math.sin((totalRotateY * Math.PI) / 180),
                    y: -tilt.rotateX / MAX_TILT_DEG,
                  }}
                />
              </div>
              <div
                className="card-face card-face-back"
                style={{ visibility: facing === 'back' ? 'visible' : 'hidden' }}
              >
                <img
                  src={CARD_BACK_PATH}
                  alt="Dino Discovery"
                  className="w-full h-full object-cover rounded-[28px] border-[20px] border-[#0a0a0a]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
