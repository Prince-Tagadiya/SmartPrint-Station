// ============================================================
// Pricing Engine
// ============================================================

import type { ColorMode, PaperSize, PricingConfig } from '@/types';

const DEFAULT_PRICING: PricingConfig = {
  bw_single: 1,
  bw_duplex: 1.5,
  color_single: 5,
  color_duplex: 8,
  scan_per_page: 2,
};

export function calculatePrintCost(params: {
  totalPages: number;
  colorMode: ColorMode;
  duplex: boolean;
  copies: number;
  pageRange: string;
  paperSize: PaperSize;
  pricing?: PricingConfig;
}): { estimatedSheets: number; estimatedCost: number; effectivePages: number } {
  const pricing = params.pricing || DEFAULT_PRICING;

  // Calculate effective pages from range
  const effectivePages = calculateEffectivePages(params.totalPages, params.pageRange);

  // Calculate sheets (duplex = 2 pages per sheet)
  let estimatedSheets: number;
  if (params.duplex) {
    estimatedSheets = Math.ceil(effectivePages / 2);
  } else {
    estimatedSheets = effectivePages;
  }

  // Calculate cost per sheet based on mode
  let costPerUnit: number;
  if (params.colorMode === 'bw') {
    costPerUnit = params.duplex ? pricing.bw_duplex : pricing.bw_single;
  } else {
    costPerUnit = params.duplex ? pricing.color_duplex : pricing.color_single;
  }

  // Total with copies
  const totalSheets = estimatedSheets * params.copies;
  const estimatedCost = totalSheets * costPerUnit;

  return {
    estimatedSheets: totalSheets,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    effectivePages: effectivePages * params.copies,
  };
}

export function calculateEffectivePages(totalPages: number, pageRange: string): number {
  if (pageRange === 'all' || !pageRange) {
    return totalPages;
  }

  const pages = new Set<number>();
  const parts = pageRange.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          pages.add(i);
        }
      }
    } else {
      const page = Number(trimmed);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page);
      }
    }
  }

  return pages.size || totalPages;
}

export function calculateScanCost(pages: number, pricing?: PricingConfig): number {
  const p = pricing || DEFAULT_PRICING;
  return pages * p.scan_per_page;
}

export function getPricing(): PricingConfig {
  return { ...DEFAULT_PRICING };
}
