import { playClickSound } from '../sound';
import { triggerHaptic, HAPTIC_TAP } from '../haptics';
import { ATTRIBUTE_MEDALLION_PATHS } from '../data/cardTheme';

interface AttributeGroupProps<T extends string> {
  label: string;
  description?: string;
  options: T[];
  selected: T | null;
  onSelect: (value: T) => void;
}

export function AttributeGroup<T extends string>({
  label,
  description,
  options,
  selected,
  onSelect,
}: AttributeGroupProps<T>) {
  return (
    <div className="mb-6">
      {/* Each wizard step fully replaces the previous one in the DOM (App.tsx
          renders exactly one at a time), so it's the only heading on screen
          at any given moment — h1 here, not h3, so screen-reader users
          landing mid-wizard get a real top-level heading instead of a
          heading hierarchy that skips straight from nothing to h3. */}
      <h1 className="font-display2 font-semibold text-2xl sm:text-3xl text-cream mb-3 sm:mb-4 uppercase tracking-wide text-center">
        {label}
      </h1>
      {description && (
        <p className="text-cream/90 text-sm text-center mb-3 sm:mb-4 italic">{description}</p>
      )}
      <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              playClickSound();
              triggerHaptic(HAPTIC_TAP);
              onSelect(option);
            }}
            aria-pressed={selected === option}
            aria-label={option}
            className={`flex flex-col items-stretch overflow-hidden w-[108px] sm:w-[132px] min-h-[44px] border rounded-2xl transition-colors ${
              selected === option
                ? 'bg-brand/[0.12] border-brand shadow-[0_0_20px_rgba(236,26,143,0.3)]'
                : 'bg-brand/5 border-brand/20 hover:border-brand/50'
            }`}
          >
            <img
              src={ATTRIBUTE_MEDALLION_PATHS[option] ?? ''}
              alt=""
              aria-hidden="true"
              className="w-full h-[108px] sm:h-[132px] object-contain pointer-events-none"
            />
            <span className="flex-1 flex items-center justify-center px-1.5 py-2 font-display2 font-semibold text-cream uppercase tracking-wide text-xs sm:text-sm text-center leading-tight">
              {option}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
