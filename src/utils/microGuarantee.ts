export function microGuaranteePercentToKg(
  targetGuaranteePercent: number,
  materialGuaranteePercent: number
): number {
  if (targetGuaranteePercent <= 0 || materialGuaranteePercent <= 0) return 0;
  return (targetGuaranteePercent / materialGuaranteePercent) * 1000;
}

export function microKgToGuaranteePercent(
  quantityKg: number,
  materialGuaranteePercent: number
): number {
  if (quantityKg <= 0 || materialGuaranteePercent <= 0) return 0;
  return (quantityKg / 1000) * materialGuaranteePercent;
}
