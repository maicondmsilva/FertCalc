import React, { useEffect, useState } from 'react';
import { formatPriceInput, parsePriceInput } from './priceListEditorModel';

interface PriceInputProps {
  value: number;
  symbol: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  highlightEmpty?: boolean;
  label: string;
}

/** Campo de preço no formato brasileiro: digita livre e formata ao sair do campo. */
export function PriceInput({
  value,
  symbol,
  onChange,
  disabled,
  highlightEmpty,
  label,
}: PriceInputProps) {
  const [text, setText] = useState(formatPriceInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatPriceInput(value));
  }, [value, focused]);

  const empty = !(Number(value) > 0);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="text-xs font-bold text-stone-400">{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={text}
        disabled={disabled}
        placeholder="0,00"
        onFocus={(event) => {
          setFocused(true);
          event.target.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parsePriceInput(event.target.value));
        }}
        onBlur={() => {
          setFocused(false);
          setText(formatPriceInput(parsePriceInput(text)));
        }}
        className={`h-9 w-28 rounded-lg sm:w-32 border px-2.5 text-right font-mono text-[14px] font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-500 ${
          highlightEmpty && empty
            ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
            : 'border-stone-300 bg-white'
        }`}
      />
    </div>
  );
}
