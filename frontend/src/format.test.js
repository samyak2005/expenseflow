import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatLongDate,
  formatMoney,
  formatPercent,
  humanize,
  initials,
  pluralize,
  todayIso,
} from './format.js';

describe('formatMoney', () => {
  it('uses Indian digit grouping with two decimals', () => {
    expect(formatMoney(123456)).toBe('₹1,23,456.00');
    expect(formatMoney(10000000)).toBe('₹1,00,00,000.00');
    expect(formatMoney(1240.5)).toBe('₹1,240.50');
  });

  it('accepts numeric strings', () => {
    expect(formatMoney('7350')).toBe('₹7,350.00');
  });

  it('falls back to zero for missing or invalid amounts', () => {
    expect(formatMoney(undefined)).toBe('₹0.00');
    expect(formatMoney('abc')).toBe('₹0.00');
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(formatPercent(0.4308)).toBe('43%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as day, short month and year', () => {
    expect(formatDate('2026-10-14')).toBe('14 Oct 2026');
  });

  it('keeps the calendar day of a full timestamp', () => {
    expect(formatDate('2026-10-14T23:30:00Z')).toBe('14 Oct 2026');
  });
});

describe('formatLongDate', () => {
  it('includes the weekday and full month', () => {
    expect(formatLongDate(new Date(2026, 9, 16))).toBe('Friday, 16 October 2026');
  });
});

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59));
    expect(todayIso()).toBe('2026-01-05');
  });
});

describe('humanize', () => {
  it('title-cases enum values', () => {
    expect(humanize('ENGINEERING')).toBe('Engineering');
  });

  it('leaves short acronyms alone', () => {
    expect(humanize('HR')).toBe('HR');
  });
});

describe('pluralize', () => {
  it('adds an s unless the count is one', () => {
    expect(pluralize(0, 'claim')).toBe('0 claims');
    expect(pluralize(1, 'claim')).toBe('1 claim');
    expect(pluralize(3, 'claim')).toBe('3 claims');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two names', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('Anand Kumar Rao')).toBe('AK');
  });

  it('handles single names and extra whitespace', () => {
    expect(initials('Madhu')).toBe('M');
    expect(initials('  ananya   iyer ')).toBe('AI');
  });
});
