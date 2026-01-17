export type DateFormat = 'mdy' | 'dmy' | 'ymd';

const localeMap: Record<DateFormat, string> = {
  mdy: 'en-US',
  dmy: 'en-GB',
  ymd: 'sv-SE'
};

export function formatDate(value: string | number | Date | null | undefined, format: DateFormat = 'mdy'): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const locale = localeMap[format] || localeMap.mdy;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined, format: DateFormat = 'mdy'): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const locale = localeMap[format] || localeMap.mdy;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
