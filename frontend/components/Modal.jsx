'use client';

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-[#1C243066] flex items-center justify-center z-50 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl p-6 md:p-7 w-full max-w-[520px] max-h-[88vh] overflow-auto relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-inkMuted text-lg bg-transparent border-none cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>
        <h3 className="font-display text-[19px] font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }) {
  return <div className="flex justify-end gap-2.5 mt-4">{children}</div>;
}
