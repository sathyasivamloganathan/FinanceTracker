'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivacy } from '@/lib/PrivacyContext';

// A number input that stays in sync with an external value (e.g. after a
// server round-trip updates it) while still letting you type freely without
// the cursor jumping — and reliably commits on blur/Enter.
//
// When privacy mode is on, this renders as a masked, non-editable field
// instead — editing while a value is hidden would either show the real
// number while typing (defeating the point) or require awkward blind
// editing, so it just asks you to reveal amounts first via the eye toggle.
export default function EditableNumber({ value, onCommit, className, step = '0.01', maskable = true }) {
  const { hidden } = usePrivacy();
  const [local, setLocal] = useState(String(value ?? ''));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(String(value ?? ''));
  }, [value]);

  function commit() {
    focused.current = false;
    const num = Number(local);
    if (!Number.isNaN(num) && num !== Number(value)) {
      onCommit(num);
    } else {
      setLocal(String(value ?? ''));
    }
  }

  if (maskable && hidden) {
    return (
      <span
        className={`${className} inline-flex items-center justify-end bg-stone-50 text-inkMuted cursor-not-allowed select-none`}
        title="Hidden — tap the eye icon in the top bar to reveal and edit"
      >
        ••••••
      </span>
    );
  }

  return (
    <input
      type="number"
      step={step}
      className={className}
      value={local}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
