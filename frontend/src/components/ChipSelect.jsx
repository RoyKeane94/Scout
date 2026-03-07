import { useState } from 'react';

export default function ChipSelect({ options, value = [], onChange, label }) {
  const toggle = (opt) => {
    const next = value.includes(opt)
      ? value.filter((v) => v !== opt)
      : [...value, opt];
    onChange(next);
  };

  return (
    <div className="chip-select">
      {label && <label className="chip-label">{label}</label>}
      <div className="chip-list">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`chip ${value.includes(opt) ? 'chip-active' : ''}`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
