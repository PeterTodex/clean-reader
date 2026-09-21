import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names safely with clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes and formats raw update time string to a clean Chinese date representation (e.g. 2026年9月15日).
 * Gracefully handles quirks like banshanren's YYYY.DD.MM format (e.g. 2026.15.09 where month 15 is actually the day)
 * and safely falls back on unparseable or relative dates.
 */
export function formatDisplayDate(raw?: string): string {
  if (!raw || !raw.trim()) return '';
  let str = raw.trim();

  // Strip prefixes like "更新：", "更新时间：", "最后更新："
  str = str.replace(/^(?:最新|最后)?更新(?:时间)?[:：\s]*/i, '').trim();

  // If already relative date (e.g. "刚刚", "10分钟前", "昨天", "2小时前", "3天前"), return as is
  if (/(?:刚刚|分[钟]?前|小时前|天前|月前|年前|昨天|前天)/.test(str)) {
    return str;
  }

  // Case 1: YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD
  // Also catches YYYY.DD.MM where month/day are inverted (e.g. banshanren 2026.15.09)
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[\sT].*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const partA = parseInt(ymdMatch[2], 10);
    const partB = parseInt(ymdMatch[3], 10);

    let month = partA;
    let day = partB;

    // Detect inverted Day/Month:
    // If partA > 12 and partB <= 12, partA is definitely the Day and partB is the Month (e.g. 2026.15.09)
    if (partA > 12 && partB <= 12) {
      month = partB;
      day = partA;
    } else if (str.includes('.') && partB <= 12 && partA <= 31 && partA > 0) {
      // Banshanren CMS template quirk: outputs YYYY.DD.MM with dots
      month = partB;
      day = partA;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}年${month}月${day}日`;
    }
  }

  // Case 2: MM-DD or MM/DD or MM.DD
  const mdMatch = str.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (mdMatch) {
    const partA = parseInt(mdMatch[1], 10);
    const partB = parseInt(mdMatch[2], 10);
    let month = partA;
    let day = partB;
    if (partA > 12 && partB <= 12) {
      month = partB;
      day = partA;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${month}月${day}日`;
    }
  }

  // Case 3: Already in Chinese format (e.g. 2026年9月15日)
  if (/\d{4}年\d{1,2}月\d{1,2}日/.test(str)) {
    return str;
  }

  // Fallback: return cleaned string
  return str;
}
