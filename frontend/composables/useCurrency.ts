/**
 * Currency formatting helpers.
 *
 * Monetary values are transported over the API as *minor units* (integers)
 * — e.g. GBP in pence — to avoid floating-point rounding errors when the
 * backend splits commissions. The frontend converts to major units at the
 * very last moment, purely for display.
 */
export function useCurrency(defaultLocale = 'en-GB', defaultCurrency = 'GBP') {
  /**
   * Formats a minor-unit integer (e.g. 123450 pence) as a human string
   * ("£1,234.50"). Returns an em-dash for null / undefined so UI slots
   * never render the string "undefined".
   */
  function formatMinor(
    minorUnits: number | null | undefined,
    currency: string = defaultCurrency,
    locale: string = defaultLocale,
  ): string {
    if (minorUnits === null || minorUnits === undefined || !Number.isFinite(minorUnits)) {
      return '—';
    }
    const major = minorUnits / 100;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  }

  /** Same as above but for pre-converted major units. */
  function formatMajor(
    major: number | null | undefined,
    currency: string = defaultCurrency,
    locale: string = defaultLocale,
  ): string {
    if (major === null || major === undefined || !Number.isFinite(major)) {
      return '—';
    }
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  }

  return { formatMinor, formatMajor };
}
