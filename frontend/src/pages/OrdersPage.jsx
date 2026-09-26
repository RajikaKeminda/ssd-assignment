import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as ordersApi from '../api/orders'
import { ROLES, userId } from '../constants/roles'
import { formatDate, formatMoney, humanizeStatus } from '../utils/orderUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const selectClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

export function OrdersPage() {
  const { user } = useAuth()
  const uid = userId(user)
  const role = user?.role

  const [orders, setOrders] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const pagination = { page, limit: 12, sortBy: 'createdAt', sortOrder: 'desc' }
      const q = { ...pagination }
      if (statusFilter) q.status = statusFilter

      let data
      if (role === ROLES.PATIENT) {
        data = await ordersApi.listUserOrders(uid, pagination)
      } else if (role === ROLES.DELIVERY_PARTNER) {
        data = await ordersApi.listDeliveryPartnerOrders(uid, pagination)
      } else if (role === ROLES.PHARMACY_STAFF && user?.pharmacyId) {
        data = await ordersApi.listPharmacyOrders(String(user.pharmacyId), pagination)
      } else if (role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN) {
        data = await ordersApi.listOrders(q)
      } else {
        data = { orders: [], page: 1, pages: 1 }
      }

      setOrders(data.orders ?? [])
      setPages(data.pages ?? 1)
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : 'Could not load orders. Try again.'
      setError(msg)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [role, uid, user?.pharmacyId, page, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const showFilters =
    role === ROLES.SYSTEM_ADMIN ||
    (role === ROLES.PHARMACY_STAFF && !user?.pharmacyId)

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Orders
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {role === ROLES.PATIENT && 'Your medication orders and delivery status.'}
            {role === ROLES.PHARMACY_STAFF && 'Process and fulfill pharmacy orders.'}
            {role === ROLES.SYSTEM_ADMIN && 'All orders across the platform.'}
            {role === ROLES.DELIVERY_PARTNER && 'Deliveries assigned to you.'}
          </p>
        </div>
        {role === ROLES.PATIENT ? (
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            New order from request
          </Link>
        ) : null}
      </div>

      {showFilters ? (
        <div className={`mb-6 ${cardClass}`}>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Filter by status
          </label>
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="packed">Packed</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className={cardClass}>
          <p className="text-sm text-slate-600 dark:text-slate-400">No orders yet.</p>
          {role === ROLES.PATIENT ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
              When a medication request is marked available, you can place an order from{' '}
              <Link to="/orders/new" className="font-medium text-emerald-700 underline dark:text-emerald-400">
                New order
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {orders.map((o) => (
            <li key={o._id}>
              <Link
                to={`/orders/${o._id}`}
                className={`block transition hover:ring-2 hover:ring-emerald-500/30 ${cardClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {o.orderNumber}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {humanizeStatus(o.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(o.createdAt)}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                  {formatMoney(o.totalAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  Payment: {humanizeStatus(o.paymentStatus)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
