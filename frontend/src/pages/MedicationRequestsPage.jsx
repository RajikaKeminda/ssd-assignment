import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as requestsApi from '../api/requests'
import { ROLES, userId } from '../constants/roles'
import { formatDate, humanizeStatus, patientLabel, pharmacyLabel } from '../utils/requestUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const selectClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

function canUseRequests(role) {
  return (
    role === ROLES.PATIENT ||
    role === ROLES.PHARMACY_STAFF ||
    role === ROLES.SYSTEM_ADMIN
  )
}

export function MedicationRequestsPage() {
  const { user } = useAuth()
  const uid = userId(user)
  const role = user?.role

  const [requests, setRequests] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [urgentOnly, setUrgentOnly] = useState(false)

  const load = useCallback(async () => {
    if (!canUseRequests(role)) {
      setLoading(false)
      return
    }

    setError('')
    setLoading(true)
    const pagination = {
      page: String(page),
      limit: '12',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    const filters = { ...pagination }
    if (statusFilter) filters.status = statusFilter

    try {
      let data
      if (role === ROLES.PATIENT) {
        data = await requestsApi.listUserRequests(uid, filters)
      } else if (urgentOnly) {
        data = await requestsApi.listUrgentRequests(pagination)
      } else if (role === ROLES.PHARMACY_STAFF && user?.pharmacyId) {
        data = await requestsApi.listPharmacyRequests(String(user.pharmacyId), filters)
      } else if (role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN) {
        data = await requestsApi.listRequests(filters)
      } else {
        data = { requests: [], page: 1, pages: 1 }
      }

      setRequests(data.requests ?? [])
      setPages(data.pages ?? 1)
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : 'Could not load medication requests. Try again.'
      setError(msg)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [role, uid, user?.pharmacyId, page, statusFilter, urgentOnly])

  useEffect(() => {
    load()
  }, [load])

  if (!canUseRequests(role)) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className={cardClass}>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Medication requests
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your account role does not include the medication request workflow.
          </p>
        </div>
      </div>
    )
  }

  const showStaffFilters =
    role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Medication requests
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {role === ROLES.PATIENT &&
              'Submit requests to a pharmacy and track approval status.'}
            {role === ROLES.PHARMACY_STAFF &&
              'Review and update requests assigned to your pharmacy.'}
            {role === ROLES.SYSTEM_ADMIN && 'All medication requests on the platform.'}
          </p>
        </div>
        {role === ROLES.PATIENT ? (
          <Link
            to="/requests/new"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Request medication
          </Link>
        ) : null}
      </div>

      {showStaffFilters ? (
        <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${cardClass}`}>
          <div>
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
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={urgentOnly}
                onChange={(e) => {
                  setPage(1)
                  setUrgentOnly(e.target.checked)
                }}
              />
              Urgent queue only
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              When enabled, shows urgent-priority requests system-wide (ignores status filter).
            </p>
          </div>
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className={cardClass}>
          <p className="text-sm text-slate-600 dark:text-slate-400">No requests yet.</p>
          {role === ROLES.PATIENT ? (
            <Link
              to="/requests/new"
              className="mt-3 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              Request your first medication
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {requests.map((r) => (
            <li key={r._id}>
              <Link
                to={`/requests/${r._id}`}
                className={`block transition hover:ring-2 hover:ring-emerald-500/30 ${cardClass}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {r.medicationName}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {humanizeStatus(r.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Qty {r.quantity}
                  {r.urgencyLevel === 'urgent' ? (
                    <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                      Urgent
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  {formatDate(r.requestDate || r.createdAt)}
                </p>
                {role === ROLES.PATIENT ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {pharmacyLabel(r.pharmacyId)}
                  </p>
                ) : null}
                {role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Patient: {patientLabel(r.userId)} · {pharmacyLabel(r.pharmacyId)}
                  </p>
                ) : null}
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
