import React, { useState } from 'react';

/** Converte texto digitado ("1.234,5", "12,5", "12.5") em número; vazio ou inválido = 0. */
export function parseTypedNumber(text: string): number {
  const trimmed = String(text ?? '').trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** O texto representa zero ("0", "00", "0,00")? Vazio não conta. */
export const isZeroText = (text: string) =>
  String(text ?? '').trim() !== '' &&
  /^[0.,\s]+$/.test(String(text)) &&
  parseTypedNumber(text) === 0;

/**
 * Para campos cujo estado já é texto: ao clicar num campo com zero, o zero some
 * para o usuário digitar direto; se sair sem digitar, o zero volta.
 */
export function zeroClearingHandlers(
  value: string,
  setValue: (next: string) => void,
  emptyValue = '0'
) {
  return {
    onFocus: () => {
      if (isZeroText(value)) setValue('');
    },
    onBlur: () => {
      if (String(value ?? '').trim() === '') setValue(emptyValue);
    },
  };
}

type NumericInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Casas decimais ao mostrar (fora da digitação). Sem valor: mostra como está. */
  decimals?: number;
};

/**
 * Campo numérico para estado numérico: aceita vírgula, não perde "0," durante a
 * digitação, e o zero some ao clicar (volta ao sair sem digitar).
 */
export function NumericInput({
  value,
  onValueChange,
  decimals,
  onFocus,
  onBlur,
  ...rest
}: NumericInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const number = Number(value) || 0;
  const shown =
    draft ?? (decimals === undefined ? String(number) : number.toFixed(decimals)).replace('.', ',');
  return (
    <input
      type="text"
      inputMode="decimal"
      {...rest}
      value={shown}
      onFocus={(event) => {
        setDraft(number === 0 ? '' : shown);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        if (!/^-?[\d.,]*$/.test(text)) return;
        setDraft(text);
        onValueChange(parseTypedNumber(text));
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
