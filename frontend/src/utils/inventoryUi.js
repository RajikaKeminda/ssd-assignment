import moment from 'moment'

/** Label maps for select dropdowns & badges */
export const CATEGORIES = {
  prescription: 'Prescription',
  otc: 'Over-the-Counter',
  controlled: 'Controlled',
}

export const FORMS = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  syrup: 'Syrup',
  injection: 'Injection',
}

/** Badge colour classes keyed by category */
export const CATEGORY_BADGE = {
  prescription:
    'bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800/60',
  otc: 'bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800/60',
  controlled:
    'bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60',
}

export function formatMoney(n) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(Number(n))
}

export function formatDate(iso) {
  if (!iso) return '—'
  return moment(iso).format('MMM D, YYYY')
}

export function daysUntil(iso) {
  if (!iso) return Infinity
  // moment.diff with 'days' truncates toward zero, giving exact day counts
  // regardless of timezone, browser, or time-of-day.
  return moment(iso).startOf('day').diff(moment().startOf('day'), 'days')
}

export function isLowStock(item) {
  return item.quantity <= (item.lowStockThreshold ?? 10)
}

export function isExpiringSoon(item, days = 30) {
  if (!item.expiryDate) return false
  return daysUntil(item.expiryDate) <= days
}

/** Stock-level badge classes */
export function stockBadge(item) {
  if (item.quantity === 0) {
    return 'bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/60'
  }
  if (isLowStock(item)) {
    return 'bg-orange-100 text-orange-800 ring-orange-200/80 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-800/60'
  }
  return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60'
}

export function stockLabel(item) {
  if (item.quantity === 0) return 'Out of stock'
  if (isLowStock(item)) return 'Low stock'
  return 'In stock'
}
