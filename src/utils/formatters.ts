export const formatDocument = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 11) {
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
  return cleanValue
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const formatPhone = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 10) {
    return cleanValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
  return cleanValue
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export const formatCEP = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  return cleanValue
    .replace(/(\d{5})(\d{1,3})/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};

export const lookupCEP = async (cep: string) => {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  // Try multiple providers for redundancy
  const providers = [
    {
      url: `https://viacep.com.br/ws/${cleanCEP}/json/`,
      parse: (data: any) => data.erro ? null : {
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf
      }
    },
    {
      url: `https://cep.awesomeapi.com.br/json/${cleanCEP}`,
      parse: (data: any) => ({
        street: data.address,
        neighborhood: data.district,
        city: data.city,
        state: data.state
      })
    }
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) continue;
      const data = await response.json();
      const result = provider.parse(data);
      if (result) return result;
    } catch (error) {
      console.warn(`CEP lookup failed for ${provider.url}:`, error);
    }
  }

  return null;
};

export const formatNPK = (targetFormula: string, resultingN: number, resultingP: number, resultingK: number) => {
  const parts = targetFormula.split(/[- ]/);
  const tN = parts[0] || '0';
  const tP = parts[1] || '0';
  const tK = parts[2] || '0';

  const formatPart = (targetPart: string, val: number) => {
    const rounded = Number((val || 0).toFixed(2));
    if (Number.isInteger(rounded)) {
      if (Number(targetPart) === rounded) return targetPart;
      return rounded.toString();
    }
    return rounded.toString().replace('.', ',');
  };

  return `${formatPart(tN, resultingN)}-${formatPart(tP, resultingP)}-${formatPart(tK, resultingK)}`;
};
