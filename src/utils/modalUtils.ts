import type React from 'react';

export function closeModalOnBackdrop(
  event: React.MouseEvent<HTMLElement>,
  onClose: () => void,
  disabled = false
) {
  if (!disabled && event.target === event.currentTarget) onClose();
}
