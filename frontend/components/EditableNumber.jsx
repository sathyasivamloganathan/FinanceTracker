'use client';

import { useState, useEffect, useRef } from 'react';

// A number input that stays in sync with an external value (e.g. after a
// server round-trip updates it) while still letting you type freely without
// the cursor jumping — and reliably commits on blur/Enter. The previous
// pattern (uncontrolled `defaultValue` + `onBlur`) could silently show a
// stale number if the save failed or the row re-rendered.
export default function EditableNumber({ value, onCommit, className, step = '0.01' }) {
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
