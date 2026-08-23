// Compatibility export for existing consumers. New code should import from domain/pricing-engine.
export { calculateProfitability as calcRentability } from '../domain/pricing-engine';
export type { ProfitabilityInput as RentabilityInput } from '../domain/pricing-engine';
