import type { AppSettings } from '../types';

/**
 * Nome a exibir junto à logo. Fica vazio quando o usuário escolheu mostrar só a
 * logo; sem logo cadastrada, o nome aparece sempre (senão não haveria identificação).
 */
export function getCompanyDisplayName(
  settings: Pick<AppSettings, 'companyName' | 'companyLogo' | 'showCompanyName'> | undefined
): string {
  const name = settings?.companyName?.trim() || '';
  if (!name) return '';
  if (settings?.showCompanyName === false && settings.companyLogo) return '';
  return name;
}
