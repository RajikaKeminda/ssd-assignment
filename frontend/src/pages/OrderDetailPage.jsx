import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as ordersApi from '../api/orders'
import { downloadInvoice } from '../api/orders'
import * as partnersApi from '../api/deliveryPartners'
import { ROLES, userId } from '../constants/roles'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  formatDate,
  formatMoney,
  humanizeStatus,
  nextOrderStatuses,
} from '../utils/orderUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const btnPrimary =
  'rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50'
const btnSecondary =
  'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

function resolveName(populated) {
  if (!populated) return '—'
  if (typeof populated === 'object' && populated.name) return populated.name
  return '—'
}

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = userId(user)
  const role = user?.role

  const [order, setOrder] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [nextStatus, setNextStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [partnerPick, setPartnerPick] = useState('')
  const [payMethod, setPayMethod] = useState('card')
  const [cancelReason, setCancelReason] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')

  const loadOrder = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const o = await ordersApi.getOrder(id)
      setOrder(o)
      setDeliveryFee(String(o.deliveryFee ?? ''))
      if (o.estimatedDelivery) {
        const d = new Date(o.estimatedDelivery)
        setEstimatedDelivery(d.toISOString().slice(0, 16))
      } else {
        setEstimatedDelivery('')
      }
      const choices = nextOrderStatuses(o.status)
      setNextStatus(choices[0] ?? '')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load order')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const loadTracking = useCallback(async () => {
    try {
      const t = await ordersApi.getDeliveryTracking(id)
      setTracking(t)
    } catch {
      setTracking(null)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    loadTracking()
  }, [id, loadTracking])

  useEffect(() => {
    const canAssign =
      role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN
    if (!canAssign) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await partnersApi.listDeliveryPartners({
          isActive: 'true',
          limit: '50',
        })
        if (!cancelled) setPartners(data.partners ?? [])
      } catch {
        if (!cancelled) setPartners([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role])

  const isPatient = role === ROLES.PATIENT
  const isPharmacy = role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN
  const isDelivery = role === ROLES.DELIVERY_PARTNER
  const orderUserId = order?.userId && typeof order.userId === 'object' ? order.userId._id : order?.userId
  const isOwner = order && String(orderUserId) === uid

  async function handleStatusUpdate(e) {
    e.preventDefault()
    if (!nextStatus) return
    setBusy(true)
    setActionMsg('')
    try {
      const body = { status: nextStatus }
      if (statusNotes.trim()) body.notes = statusNotes.trim()
      const o = await ordersApi.updateOrderStatus(id, body)
      setOrder(o)
      setStatusNotes('')
      setNextStatus(nextOrderStatuses(o.status)[0] ?? '')
      setActionMsg('Status updated.')
      await loadTracking()
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssign(e) {
    e.preventDefault()
    if (!partnerPick) return
    setBusy(true)
    setActionMsg('')
    try {
      const o = await ordersApi.assignDeliveryPartner(id, { deliveryPartnerId: partnerPick })
      setOrder(o)
      setActionMsg('Delivery partner assigned.')
      await loadTracking()
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Assign failed')
    } finally {
      setBusy(false)
    }
  }

  async function handlePharmacyUpdate(e) {
    e.preventDefault()
    setBusy(true)
    setActionMsg('')
    try {
      const body = {}
      const fee = parseFloat(deliveryFee)
      if (!Number.isNaN(fee)) body.deliveryFee = fee
      if (estimatedDelivery) body.estimatedDelivery = new Date(estimatedDelivery).toISOString()
      const o = await ordersApi.updateOrder(id, body)
      setOrder(o)
      setActionMsg('Order details saved.')
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handlePay(e) {
    e.preventDefault()
    setBusy(true)
    setActionMsg('')
    try {
      const o = await ordersApi.processPayment(id, { paymentMethod: payMethod })
      setOrder(o)
      setActionMsg('Payment completed.')
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(e) {
    e.preventDefault()
    setBusy(true)
    setActionMsg('')
    try {
      const body = {}
      if (cancelReason.trim()) body.reason = cancelReason.trim()
      const o = await ordersApi.cancelOrder(id, body)
      setOrder(o)
      setCancelReason('')
      setActionMsg('Order cancelled.')
      await loadTracking()
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleInvoice() {
    setBusy(true)
    setActionMsg('')
    try {
      await downloadInvoice(id, order.orderNumber)
      setActionMsg('Invoice downloaded.')
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : err?.message ?? 'Invoice download failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Permanently delete this cancelled order?')) return
    setBusy(true)
    setActionMsg('')
    try {
      await ordersApi.deleteOrder(id)
      navigate('/orders', { replace: true })
    } catch (err) {
      setActionMsg(err instanceof ApiClientError ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500 dark:text-slate-400">
        Loading order…
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error || 'Order not found.'}
        </div>
        <Link to="/orders" className={`mt-6 inline-block ${btnSecondary}`}>
          Back to orders
        </Link>
      </div>
    )
  }

  const canPatientAct = isPatient && isOwner
  const showPatientCancel =
    canPatientAct &&
    order.status !== ORDER_STATUS.DELIVERED &&
    order.status !== ORDER_STATUS.CANCELLED
  const showStaffCancel =
    isPharmacy &&
    order.status !== ORDER_STATUS.DELIVERED &&
    order.status !== ORDER_STATUS.CANCELLED
  const showPay =
    canPatientAct &&
    order.paymentStatus === PAYMENT_STATUS.PENDING &&
    order.status !== ORDER_STATUS.CANCELLED

  const updates = tracking?.trackingUpdates ?? order.trackingUpdates ?? []

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/orders"
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Orders
        </Link>
      </div>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-300">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Placed {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {humanizeStatus(order.status)}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
              {humanizeStatus(order.paymentStatus)}
            </span>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Customer</dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {resolveName(order.userId)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Pharmacy</dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {resolveName(order.pharmacyId)}
            </dd>
          </div>
        </dl>
      </div>

      {actionMsg ? (
        <p
          className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          role="status"
        >
          {actionMsg}
        </p>
      ) : null}

      <div className={`mt-6 ${cardClass}`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Line items</h2>
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
          {(order.items ?? []).map((item, i) => (
            <li key={i} className="flex justify-between gap-4 py-3 text-sm">
              <span className="text-slate-800 dark:text-slate-200">
                {item.name}{' '}
                <span className="text-slate-500 dark:text-slate-500">×{item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium">{formatMoney(item.totalPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Delivery</span>
            <span>{formatMoney(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Tax</span>
            <span>{formatMoney(order.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-white">
            <span>Total</span>
            <span>{formatMoney(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className={`mt-6 ${cardClass}`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Delivery</h2>
        <address className="mt-2 text-sm not-italic leading-relaxed text-slate-700 dark:text-slate-300">
          {order.deliveryAddress?.street}
          <br />
          {order.deliveryAddress?.city} {order.deliveryAddress?.postalCode}
          <br />
          {order.deliveryAddress?.phoneNumber}
        </address>
        {order.estimatedDelivery ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Estimated delivery: {formatDate(order.estimatedDelivery)}
          </p>
        ) : null}
        {order.deliveryPartnerId && typeof order.deliveryPartnerId === 'object' ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Driver:{' '}
            <span className="font-medium text-slate-900 dark:text-white">
              {order.deliveryPartnerId.name}
            </span>
          </p>
        ) : null}
      </div>

      <div className={`mt-6 ${cardClass}`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tracking</h2>
        <ol className="mt-4 space-y-3 border-l-2 border-emerald-200 pl-4 dark:border-emerald-800">
          {[...updates].reverse().map((u, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-slate-900 dark:text-white">
                {humanizeStatus(u.status)}
              </span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-500">
                {formatDate(u.timestamp)}
              </span>
              {u.notes ? (
                <p className="mt-1 text-slate-600 dark:text-slate-400">{u.notes}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {isPharmacy && order.status !== ORDER_STATUS.CANCELLED ? (
        <form onSubmit={handlePharmacyUpdate} className={`mt-6 space-y-4 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Fulfillment details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Estimated delivery
              </label>
              <input
                className={inputClass}
                type="datetime-local"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className={btnPrimary} disabled={busy}>
            Save details
          </button>
        </form>
      ) : null}

      {isPharmacy &&
      order.status !== ORDER_STATUS.DELIVERED &&
      order.status !== ORDER_STATUS.CANCELLED ? (
        <form onSubmit={handleStatusUpdate} className={`mt-6 space-y-4 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Update status
          </h2>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Next status
            </label>
            <select
              className={inputClass}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
            >
              {nextOrderStatuses(order.status).map((s) => (
                <option key={s} value={s}>
                  {humanizeStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Notes (optional)
            </label>
            <input
              className={inputClass}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="e.g. Packed and ready for pickup"
            />
          </div>
          <button
            type="submit"
            className={btnPrimary}
            disabled={busy || nextOrderStatuses(order.status).length === 0}
          >
            Apply status
          </button>
        </form>
      ) : null}

      {isPharmacy &&
      order.status !== ORDER_STATUS.DELIVERED &&
      order.status !== ORDER_STATUS.CANCELLED ? (
        <form onSubmit={handleAssign} className={`mt-6 space-y-4 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Assign delivery partner
          </h2>
          <select
            className={inputClass}
            value={partnerPick}
            onChange={(e) => setPartnerPick(e.target.value)}
            required
          >
            <option value="">Select partner…</option>
            {partners.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — {p.email}
              </option>
            ))}
          </select>
          <button type="submit" className={btnPrimary} disabled={busy || partners.length === 0}>
            Assign
          </button>
        </form>
      ) : null}

      {isPharmacy && order.status === ORDER_STATUS.CANCELLED ? (
        <div className={`mt-6 ${cardClass}`}>
          <button type="button" className={btnSecondary} onClick={handleDelete} disabled={busy}>
            Delete cancelled order
          </button>
        </div>
      ) : null}

      {showPay ? (
        <form onSubmit={handlePay} className={`mt-6 space-y-4 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pay</h2>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Payment method
            </label>
            <select
              className={inputClass}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </div>
          <button type="submit" className={btnPrimary} disabled={busy}>
            Process payment
          </button>
        </form>
      ) : null}

      {showPatientCancel || showStaffCancel ? (
        <form onSubmit={handleCancel} className={`mt-6 space-y-4 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {showStaffCancel && !showPatientCancel
              ? 'Cancel order (pharmacy)'
              : 'Cancel order'}
          </h2>
          <input
            className={inputClass}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <button
            type="submit"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            disabled={busy}
          >
            Cancel order
          </button>
        </form>
      ) : null}

      {(canPatientAct || isPharmacy) && order.status !== ORDER_STATUS.CANCELLED ? (
        <div className={`mt-6 ${cardClass}`}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Invoice</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Download a PDF invoice for this order.
          </p>
          <button
            type="button"
            onClick={handleInvoice}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            {busy ? 'Generating…' : 'Download Invoice PDF'}
          </button>
        </div>
      ) : null}

      {isDelivery ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Use tracking above for delivery updates. Status changes are made by pharmacy staff.
        </p>
      ) : null}
    </div>
  )
}
