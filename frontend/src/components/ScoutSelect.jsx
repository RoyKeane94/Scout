import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Scout-styled custom dropdown. Replaces native select for consistent styling.
 * Uses Portal to render dropdown at body level so it always stays on top.
 */
export default function ScoutSelect({ value, onChange, options = [], placeholder = 'Please select…', className = '', children, renderOptions, getLabel }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && !e.target.closest('.scout-select-dropdown-portal')) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open && triggerRef.current) {
      const updatePos = () => {
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
      };
      updatePos();
      window.addEventListener('scroll', updatePos, true);
      window.addEventListener('resize', updatePos);
      return () => {
        window.removeEventListener('scroll', updatePos, true);
        window.removeEventListener('resize', updatePos);
      };
    }
  }, [open]);

  const displayLabel = getLabel ? getLabel(value) : (options.find((o) => String(o.value) === String(value))?.label ?? value ?? '');
  const isPlaceholder = value === '' || value == null || (!displayLabel && !getLabel);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className={`scout-select ${open ? 'scout-select-open' : ''} ${className}`} ref={triggerRef}>
      <button
        type="button"
        className={`scout-select-trigger ${isPlaceholder ? 'placeholder' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="scout-select-value">{isPlaceholder ? placeholder : displayLabel}</span>
        <span className="scout-select-chevron" aria-hidden>▼</span>
      </button>
      {open && createPortal(
        <div
          className="scout-select-dropdown scout-select-dropdown-portal"
          role="listbox"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 2147483647,
          }}
        >
          {renderOptions ? renderOptions({ onSelect: handleSelect }) : children || options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={String(value) === String(opt.value)}
              className={`scout-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
