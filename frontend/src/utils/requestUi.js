import { formatDate, humanizeStatus } from './orderUi'

export { formatDate, humanizeStatus }

export const REQUEST_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
}

/** Matches backend `VALID_STATUS_TRANSITIONS` */
const STATUS_NEXT = {
  [REQUEST_STATUS.PENDING]: [
    REQUEST_STATUS.PROCESSING,
    REQUEST_STATUS.UNAVAILABLE,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.PROCESSING]: [
    REQUEST_STATUS.AVAILABLE,
    REQUEST_STATUS.UNAVAILABLE,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.AVAILABLE]: [REQUEST_STATUS.FULFILLED, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.UNAVAILABLE]: [REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.FULFILLED]: [],
  [REQUEST_STATUS.CANCELLED]: [],
}

export function nextRequestStatuses(current) {
  return STATUS_NEXT[current] ?? []
}

export function pharmacyLabel(pharmacyId) {
  if (!pharmacyId) return '—'
  if (typeof pharmacyId === 'object' && pharmacyId !== null && pharmacyId.name) {
    return pharmacyId.name
  }
  return 'Pharmacy'
}

export function patientLabel(userId) {
  if (!userId) return '—'
  if (typeof userId === 'object' && userId !== null && userId.name) {
    return userId.name
  }
  return 'Patient'
}
