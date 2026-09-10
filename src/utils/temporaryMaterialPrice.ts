import type { RawMaterial } from '../types';

export function withOfficialListPrice(material: RawMaterial): RawMaterial {
  return {
    ...material,
    price: Number(material.price) || 0,
    listPrice: Number(material.price) || 0,
    isManualPrice: false,
  };
}

export function applyTemporaryMaterialPrice(material: RawMaterial, price: number): RawMaterial {
  const normalizedPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const listPrice = material.listPrice ?? material.price;
  return {
    ...material,
    listPrice,
    price: normalizedPrice,
    isManualPrice: normalizedPrice !== Number(listPrice),
  };
}

export function restoreOfficialMaterialPrice(material: RawMaterial): RawMaterial {
  const price = Number(material.listPrice ?? material.price) || 0;
  return { ...material, price, listPrice: price, isManualPrice: false };
}

export function stripTemporaryMaterialPrices(materials: RawMaterial[]): RawMaterial[] {
  return materials.map(({ listPrice, isManualPrice: _isManualPrice, ...material }) => ({
    ...material,
    price: Number(listPrice ?? material.price) || 0,
  }));
}
