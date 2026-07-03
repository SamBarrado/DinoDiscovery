import { useEffect, useRef, useState } from 'react';
import { isValidEmail } from '../../shared/validateEmail';

interface EmailGateModalProps {
  onConfirm: (email: string) => void;
  onCancel: () => void;
}

const TITLE_ID = 'email-gate-title';

// Selector for elements a focus trap should cycle between — deliberately
// scoped to the handful of interactive element types this modal actually
// contains (input + buttons), not a generic "everything focusable" query.
const FOCUSABLE_SELECTOR = 'input, button, a[href], [tabindex]:not([tabindex="-1"])';

export function EmailGateModal({ onConfirm, onCancel }: EmailGateModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus moves into the dialog on mount (the email input, the modal's
  // primary control) and is restored to whatever triggered the modal on
  // unmount — without this a keyboard/screen-reader user's focus silently
  // stays on (or vanishes from) whatever was behind the modal while it's
  // open, and jumps to the top of the document when it closes rather than
  // back to the triggering button.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    emailInputRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Manual focus-trap: without this, Tab/Shift+Tab from the dialog's
      // first/last element would escape into the background page content
      // that's still present in the DOM (just visually covered), letting a
      // keyboard user tab out of the modal while it's supposedly modal.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  function handleConfirm() {
    if (!isValidEmail(email)) {
      setError('Por favor, escribe un correo válido.');
      return;
    }
    setError('');
    onConfirm(email);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="bg-bg border border-brand p-6 max-w-sm w-full my-auto max-h-[90vh] overflow-y-auto"
      >
        <h3 id={TITLE_ID} className="font-display2 font-semibold text-xl text-cream mb-2 uppercase tracking-wide">¡Casi listo!</h3>
        <p className="text-sage mb-4">
          Escribe tu email para descargar la carta de descubrimiento.
        </p>
        <label htmlFor="gate-email" className="block font-semibold mb-1 text-cream">
          Email
        </label>
        <input
          ref={emailInputRef}
          id="gate-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'gate-email-error' : undefined}
          className="w-full px-3 py-2 bg-surface2 border border-brand/20 text-cream focus:outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand-light"
        />
        {error && (
          <p id="gate-email-error" role="alert" className="text-red-400 mt-1 text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 min-h-[44px] border border-moss text-sage font-semibold rounded-[999px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 min-h-[44px] bg-[#d1187f] text-white font-display2 font-semibold uppercase tracking-wide rounded-[999px]"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
