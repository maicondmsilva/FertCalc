export function microGuaranteePercentToKg(
  targetGuaranteePercent: number,
  materialGuaranteePercent: number
): number {
  if (targetGuaranteePercent <= 0 || materialGuaranteePercent <= 0) return 0;
  return roundMicroValue((targetGuaranteePercent / materialGuaranteePercent) * 1000);
}

export function microKgToGuaranteePercent(
  quantityKg: number,
  materialGuaranteePercent: number
): number {
  if (quantityKg <= 0 || materialGuaranteePercent <= 0) return 0;
  return (quantityKg / 1000) * materialGuaranteePercent;
}

export function roundMicroValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
