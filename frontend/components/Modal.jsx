'use client';

import { useEffect, useRef, useId } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Accessible dialog: role/aria-modal, Escape to close, focus moved in on open,
// Tab trapped inside, focus restored on close. Clicking the dark backdrop does
// NOT close it — that used to throw away half-filled forms.
export default function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  const titleId = useId();
  // Parents pass a new inline onClose on every render (every keystroke). Keep it
  // in a ref so the effect below runs ONLY when the dialog opens/closes —
  // otherwise it re-ran on each keystroke and moved focus to the first field.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const items = () => (node ? [...node.querySelectorAll(FOCUSABLE)] : []);
    const first = items().find((el) => el.getAttribute('aria-label') !== 'Close') || items()[0];
    (first || node)?.focus();

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const a = list[0]; const z = list[list.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[#1C243066] dark:bg-black/70 flex items-center justify-center z-50 p-5">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-7 w-full max-w-[520px] max-h-[88vh] overflow-auto relative shadow-2xl dark:shadow-black/50 focus:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-5 text-inkMuted dark:text-gray-400 text-lg bg-transparent border-none cursor-pointer hover:text-ink dark:hover:text-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
        <h3 id={titleId} className="font-display text-[19px] font-semibold mb-4 dark:text-gray-100">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }) {
  return <div className="flex justify-end gap-2.5 mt-4">{children}</div>;
}
