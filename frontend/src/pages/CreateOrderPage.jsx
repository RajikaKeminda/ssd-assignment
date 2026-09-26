import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as ordersApi from '../api/orders'
import * as requestsApi from '../api/requests'
import * as inventoryApi from '../api/inventory'
import { ROLES, userId } from '../constants/roles'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const btnPrimary =
  'rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50'

const emptyLine = () => ({
  medicationId: '',
  name: '',
  quantity: 1,
  unitPrice: 0,
})

export function CreateOrderPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const uid = userId(user)

  const [requests, setRequests] = useState([])
  const [requestId, setRequestId] = useState('')
  const [inventory, setInventory] = useState([])
  const [lines, setLines] = useState([emptyLine()])
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone ?? '')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const prefilledForRequest = useRef(null)

  const selectedRequest = useMemo(
    () => requests.find((r) => r._id === requestId),
    [requests, requestId]
  )

  const loadRequests = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    setError('')
    try {
      const data = await requestsApi.listUserRequests(uid, { limit: '50', page: '1' })
      const all = data.requests ?? []
      setRequests(all.filter((r) => r.status === 'available'))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (isAuthenticated && user?.role === ROLES.PATIENT) loadRequests()
  }, [isAuthenticated, user?.role, loadRequests])

  useEffect(() => {
    if (user?.phone) setPhoneNumber((p) => p || user.phone)
  }, [user?.phone])

  const loadInventory = useCallback(async (pharmacyId) => {
    if (!pharmacyId) {
      setInventory([])
      return
    }
    try {
      const data = await inventoryApi.listInventory({
        pharmacyId: String(pharmacyId),
        limit: '100',
        page: '1',
      })
      setInventory(data.items ?? [])
    } catch {
      setInventory([])
    }
  }, [])

  useEffect(() => {
    if (!selectedRequest?.pharmacyId) return
    const pid =
      typeof selectedRequest.pharmacyId === 'object'
        ? selectedRequest.pharmacyId._id
        : selectedRequest.pharmacyId
    loadInventory(pid)
  }, [selectedRequest, loadInventory])

  useEffect(() => {
    if (!requestId) prefilledForRequest.current = null
  }, [requestId])

  useEffect(() => {
    if (!selectedRequest || inventory.length === 0) return
    if (prefilledForRequest.current === selectedRequest._id) return
    const med = selectedRequest.medicationName?.toLowerCase?.() ?? ''
    const match = inventory.find((inv) => inv.medicationName?.toLowerCase() === med)
    if (match) {
      prefilledForRequest.current = selectedRequest._id
      setLines([
        {
          medicationId: match._id,
          name: match.medicationName,
          quantity: Math.min(selectedRequest.quantity ?? 1, match.quantity ?? 1),
          unitPrice: match.unitPrice ?? 0,
        },
      ])
    }
  }, [selectedRequest, inventory, requestId])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== ROLES.PATIENT) {
    return <Navigate to="/orders" replace />
  }

  function setLine(idx, patch) {
    setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  function onPickMedication(idx, invId) {
    const inv = inventory.find((i) => i._id === invId)
    if (!inv) {
      setLine(idx, { medicationId: '', name: '', unitPrice: 0 })
      return
    }
    setLine(idx, {
      medicationId: inv._id,
      name: inv.medicationName,
      unitPrice: inv.unitPrice ?? 0,
    })
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const fee = parseFloat(deliveryFee)
    const items = lines
      .filter((l) => l.medicationId && l.name)
      .map((l) => ({
        medicationId: l.medicationId,
        name: l.name.trim(),
        quantity: Math.max(1, parseInt(String(l.quantity), 10) || 1),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      }))
    if (!requestId) {
      setError('Select an approved medication request.')
      return
    }
    if (items.length === 0) {
      setError('Add at least one medication line with inventory selected.')
      return
    }
    if (!street.trim() || !city.trim() || !postalCode.trim() || !phoneNumber.trim()) {
      setError('Complete the delivery address and phone.')
      return
    }
    setSubmitting(true)
    try {
      const order = await ordersApi.createOrder({
        requestId,
        items,
        deliveryAddress: {
          street: street.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          phoneNumber: phoneNumber.trim(),
        },
        deliveryFee: Number.isNaN(fee) ? 0 : Math.max(0, fee),
      })
      navigate(`/orders/${order._id}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        to="/orders"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Orders
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        New order
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Create an order from a request that your pharmacy has marked as available. Stock is
        reserved when you submit.
      </p>

      {error ? (
        <div
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading your requests…</p>
      ) : requests.length === 0 ? (
        <div className={`mt-8 ${cardClass}`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You have no requests in <strong>available</strong> status. Ask your pharmacy to
            approve a request first.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className={cardClass}>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Medication request
            </label>
            <select
              className={inputClass}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              required
            >
              <option value="">Choose request…</option>
              {requests.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.medicationName} — qty {r.quantity} ({r.status})
                </option>
              ))}
            </select>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Items
              </h2>
              <button type="button" onClick={addLine} className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                + Add line
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Pick medications from the same pharmacy as the request.
            </p>
            <ul className="mt-4 space-y-4">
              {lines.map((line, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="flex justify-end">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                        onClick={() => removeLine(idx)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Inventory item
                  </label>
                  <select
                    className={inputClass}
                    value={line.medicationId}
                    onChange={(e) => onPickMedication(idx, e.target.value)}
                  >
                    <option value="">Select medication…</option>
                    {inventory.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.medicationName} — {inv.quantity} in stock @ ${inv.unitPrice}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Quantity
                      </label>
                      <input
                        className={inputClass}
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => setLine(idx, { quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Unit price (USD)
                      </label>
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => setLine(idx, { unitPrice: e.target.value })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={cardClass}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Delivery address
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Street
                </label>
                <input
                  className={inputClass}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    City
                  </label>
                  <input
                    className={inputClass}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Postal code
                  </label>
                  <input
                    className={inputClass}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Phone (7–15 digits, may include +, spaces, dashes)
                </label>
                <input
                  className={inputClass}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Delivery fee (USD)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button type="submit" className={`w-full sm:w-auto ${btnPrimary}`} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create order'}
          </button>
        </form>
      )}
    </div>
  )
}
