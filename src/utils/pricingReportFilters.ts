import { PricingRecord } from '../types';

export interface PricingReportFilterValues {
  search: string;
  status: string;
  approval: string;
  branchId: string;
  userId: string;
  month: string;
  startDate: string;
  endDate: string;
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR');

const dateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function filterPricingRecords(
  pricings: PricingRecord[],
  filters: PricingReportFilterValues
): PricingRecord[] {
  const term = normalize(filters.search);

  return pricings.filter((pricing) => {
    const formulas = pricing.calculations?.map((calc) => calc.formula).join(' ') || '';
    const searchable = [
      pricing.formattedCod,
      pricing.cod,
      pricing.userName,
      pricing.factors?.client?.name,
      pricing.factors?.client?.document,
      pricing.factors?.client?.stateRegistration,
      pricing.factors?.agent?.name,
      formulas,
    ]
      .map(normalize)
      .join(' ');
    const pricingDate = dateKey(pricing.date);

    return (
      (!term || searchable.includes(term)) &&
      (!filters.status || pricing.status === filters.status) &&
      (!filters.approval || pricing.approvalStatus === filters.approval) &&
      (!filters.branchId || pricing.factors?.branchId === filters.branchId) &&
      (!filters.userId || pricing.userId === filters.userId) &&
      (!filters.month || pricingDate.startsWith(filters.month)) &&
      (!filters.startDate || pricingDate >= filters.startDate) &&
      (!filters.endDate || pricingDate <= filters.endDate)
    );
  });
}

export function getPricingReportPeriodLabel(filters: PricingReportFilterValues): string {
  if (filters.month) {
    const [year, month] = filters.month.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1)
    );
  }
  if (filters.startDate || filters.endDate) {
    const format = (value: string) => (value ? value.split('-').reverse().join('/') : 'sem limite');
    return `${format(filters.startDate)} a ${format(filters.endDate)}`;
  }
  return 'Todo o período';
}
