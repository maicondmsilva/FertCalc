import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Address } from '../../types';
import { formatCEP, lookupCEP } from '../../utils/formatters';
import { Field, fieldClass } from '../products/catalogUi';

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

/**
 * Campos de endereço com busca do CEP. Só aplica a resposta do CEP que ainda
 * estiver no campo (digitar rápido não troca o endereço por um CEP antigo).
 */
export default function AddressFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Address;
  onChange: (next: Address) => void;
  idPrefix: string;
}) {
  const [looking, setLooking] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const latestCep = useRef('');
  // Valor mais recente: o que for digitado durante a busca do CEP não se perde.
  const valueRef = useRef(value);
  valueRef.current = value;
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });

  const changeCep = async (raw: string) => {
    const cep = formatCEP(raw);
    set({ cep });
    setCepMessage(null);
    latestCep.current = cep;
    if (cep.replace(/\D/g, '').length !== 8) return;
    setLooking(true);
    try {
      const found = await lookupCEP(cep);
      if (latestCep.current !== cep) return;
      if (found) onChange({ ...valueRef.current, ...found, cep });
      else setCepMessage('CEP não encontrado. Preencha o endereço manualmente.');
    } catch {
      if (latestCep.current === cep) setCepMessage('Não foi possível buscar o CEP agora.');
    } finally {
      if (latestCep.current === cep) setLooking(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <Field label="CEP" className="col-span-2 sm:col-span-2" hint={cepMessage ?? undefined}>
        <div className="relative">
          <input
            id={`${idPrefix}-cep`}
            aria-label="CEP"
            inputMode="numeric"
            value={value.cep || ''}
            onChange={(event) => changeCep(event.target.value)}
            placeholder="00000-000"
            className={fieldClass}
          />
          {looking && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
          )}
        </div>
      </Field>
      <Field label="Rua / logradouro" className="col-span-2 sm:col-span-3">
        <input
          value={value.street || ''}
          onChange={(event) => set({ street: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="Nº" className="sm:col-span-1">
        <input
          value={value.number || ''}
          onChange={(event) => set({ number: event.target.value })}
          placeholder="S/N"
          className={fieldClass}
        />
      </Field>
      <Field label="Bairro" className="sm:col-span-2">
        <input
          value={value.neighborhood || ''}
          onChange={(event) => set({ neighborhood: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="Cidade" className="col-span-2 sm:col-span-3">
        <input
          value={value.city || ''}
          onChange={(event) => set({ city: event.target.value })}
          className={fieldClass}
        />
      </Field>
      <Field label="UF" className="col-span-2 sm:col-span-1">
        <select
          value={value.state || ''}
          onChange={(event) => set({ state: event.target.value })}
          className={fieldClass}
        >
          <option value="">UF</option>
          {BRAZILIAN_STATES.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
