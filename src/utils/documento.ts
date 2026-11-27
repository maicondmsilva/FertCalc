const onlyDigits = (value: string) => value.replace(/\D/g, '');

function cpfValido(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base
      .split('')
      .reduce((total, char, index) => total + Number(char) * (pesoInicial - index), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

function cnpjValido(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const digito = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base
      .split('')
      .reduce((total, char, index) => total + Number(char) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return (
    digito(cnpj.slice(0, 12)) === Number(cnpj[12]) && digito(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) com os dígitos verificadores corretos. */
export function documentoValido(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11
    ? cpfValido(digits)
    : digits.length === 14
      ? cnpjValido(digits)
      : false;
}

/** 12345678909 → 123.456.789-09; 14 dígitos → 12.345.678/0001-95. */
export function formatarDocumento(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14)
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}
