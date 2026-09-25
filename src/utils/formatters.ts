/**
 * Formatting utilities for MYDOMPET
 * Supports Indonesian Rupiah currency, dates, and numbers with high precision
 */

/**
 * Format number into Indonesian Rupiah (IDR) or other supported currencies
 */
export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  if (isNaN(amount)) return 'Rp 0';
  
  if (currency === 'IDR') {
    const formattedNumber = Math.abs(amount).toLocaleString('id-ID');
    const sign = amount < 0 ? '- ' : '';
    return `${sign}Rp ${formattedNumber}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date in Indonesian localized string (e.g. "23 Sep 2026")
 */
export function formatDateID(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format full date with day name (e.g. "Rabu, 23 September 2026")
 */
export function formatFullDateID(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format percentage (e.g. "24.5%")
 */
export function formatPercentage(val: number): string {
  if (isNaN(val)) return '0%';
  return `${val.toFixed(1)}%`;
}

/**
 * Format relative date (e.g. "Hari ini", "Kemarin", or "21 Sep")
 */
export function formatRelativeDateID(dateString: string): string {
  try {
    const today = getTodayString();
    if (dateString === today) return 'Hari ini';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateString === yesterdayStr) return 'Kemarin';

    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return dateString;
  }
}

/**
 * Get current date formatted as YYYY-MM-DD for input fields
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current month string formatted as YYYY-MM
 */
export function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
