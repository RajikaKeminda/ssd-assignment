export const ORDER_STATUS = {
  CONFIRMED: 'confirmed',
  PACKED: 'packed',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}

const STATUS_NEXT = {
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PACKED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

export function nextOrderStatuses(current) {
  return STATUS_NEXT[current] ?? []
}

export function formatMoney(n) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n))
}

export function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

export function humanizeStatus(s) {
  if (!s) return ''
  return String(s)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
