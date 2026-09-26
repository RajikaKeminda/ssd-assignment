/** Mirrors backend `UserRole` */
export const ROLES = {
  PATIENT: 'Patient',
  PHARMACY_STAFF: 'Pharmacy Staff',
  DELIVERY_PARTNER: 'Delivery Partner',
  SYSTEM_ADMIN: 'System Admin',
}

export function userId(user) {
  if (!user) return ''
  return String(user._id ?? user.id ?? '')
}
