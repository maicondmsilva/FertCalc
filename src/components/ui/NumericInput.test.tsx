import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { NumericInput, isZeroText, parseTypedNumber, zeroClearingHandlers } from './NumericInput';

function Harness({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumericInput aria-label="campo" value={value} onValueChange={setValue} />
      <output>{value}</output>
    </>
  );
}

describe('NumericInput', () => {
  it('o zero some ao clicar e volta se sair sem digitar', () => {
    render(<Harness />);
    const input = screen.getByLabelText('campo') as HTMLInputElement;
    expect(input.value).toBe('0');
    act(() => input.focus());
    expect(input.value).toBe('');
    act(() => input.blur());
    expect(input.value).toBe('0');
  });

  it('não perde a vírgula durante a digitação', () => {
    render(<Harness />);
    const input = screen.getByLabelText('campo') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '0,' } });
    expect(input.value).toBe('0,');
    fireEvent.change(input, { target: { value: '0,5' } });
    expect(screen.getByRole('status').textContent).toBe('0.5');
    act(() => input.blur());
    expect(input.value).toBe('0,5');
  });

  it('valor diferente de zero continua no campo ao clicar', () => {
    render(<Harness initial={12.5} />);
    const input = screen.getByLabelText('campo') as HTMLInputElement;
    act(() => input.focus());
    expect(input.value).toBe('12,5');
  });

  it('auxiliares para campos de texto', () => {
    expect(isZeroText('0')).toBe(true);
    expect(isZeroText('00')).toBe(true);
    expect(isZeroText('0,00')).toBe(true);
    expect(isZeroText('')).toBe(false);
    expect(isZeroText('0,5')).toBe(false);
    expect(parseTypedNumber('1.234,5')).toBe(1234.5);
    let value = '0';
    const handlers = zeroClearingHandlers(value, (next) => (value = next));
    handlers.onFocus();
    expect(value).toBe('');
    zeroClearingHandlers(value, (next) => (value = next)).onBlur();
    expect(value).toBe('0');
  });
});
