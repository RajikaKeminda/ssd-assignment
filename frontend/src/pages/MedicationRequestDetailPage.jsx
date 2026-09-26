import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as requestsApi from '../api/requests'
import { ROLES, userId } from '../constants/roles'
import {
  formatDate,
  humanizeStatus,
  nextRequestStatuses,
  patientLabel,
  pharmacyLabel,
  REQUEST_STATUS,
} from '../utils/requestUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const btnPrimary =
  'rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50'
const btnDanger =
  'rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40'

function ownerId(req) {
  if (!req?.userId) return ''
  return typeof req.userId === 'object' ? String(req.userId._id ?? '') : String(req.userId)
}

function canStaffAct(role) {
  return role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN
}

export function MedicationRequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const uid = userId(user)
  const role = user?.role

  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editQty, setEditQty] = useState(1)
  const [editUrgency, setEditUrgency] = useState('normal')
  const [editNotes, setEditNotes] = useState('')
  const [editRxUrl, setEditRxUrl] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [nextStatus, setNextStatus] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [estimatedAt, setEstimatedAt] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await requestsApi.getRequest(id)
      setReq(data)
      setEditQty(data.quantity ?? 1)
      setEditUrgency(data.urgencyLevel ?? 'normal')
      setEditNotes(data.notes ?? '')
      setEditRxUrl(data.prescriptionImage ?? '')
      const options = nextRequestStatuses(data.status)
      setNextStatus(options[0] ?? '')
    } catch (e) {
      setReq(null)
      setError(e instanceof ApiClientError ? e.message : 'Could not load request')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const isPatient = role === ROLES.PATIENT
  const isOwner = req && ownerId(req) === uid
  const canViewAsPatient = isPatient && isOwner
  const canViewStaff = canStaffAct(role)

  if (req && isPatient && !isOwner) {
    return <Navigate to="/requests" replace />
  }

  async function handleSavePatientEdit(e) {
    e.preventDefault()
    if (!req?._id) return
    setSavingEdit(true)
    setError('')
    try {
      const body = {
        quantity: Math.max(1, parseInt(String(editQty), 10) || 1),
        urgencyLevel: editUrgency,
        notes: editNotes.trim(),
      }
      const rx = editRxUrl.trim()
      if (rx) body.prescriptionImage = rx
      const updated = await requestsApi.updateRequest(req._id, body)
      setReq(updated)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update request')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleStatusUpdate(e) {
    e.preventDefault()
    if (!req?._id || !nextStatus) return
    setSavingStatus(true)
    setError('')
    try {
      const body = { status: nextStatus }
      if (staffNotes.trim()) body.notes = staffNotes.trim()
      if (estimatedAt) {
        const iso = new Date(estimatedAt).toISOString()
        if (!Number.isNaN(Date.parse(iso))) body.estimatedAvailability = iso
      }
      const updated = await requestsApi.updateRequestStatus(req._id, body)
      setReq(updated)
      setStaffNotes('')
      setEstimatedAt('')
      const options = nextRequestStatuses(updated.status)
      setNextStatus(options[0] ?? '')
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update status')
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleCancel() {
    if (!req?._id) return
    if (!window.confirm('Cancel this medication request?')) return
    setCancelling(true)
    setError('')
    try {
      await requestsApi.cancelRequest(req._id)
      navigate('/requests', { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not cancel request')
    } finally {
      setCancelling(false)
    }
  }

  const showPatientEdit =
    canViewAsPatient && req?.status === REQUEST_STATUS.PENDING
  const showPatientCancel =
    req &&
    (canViewAsPatient || canStaffAct(role)) &&
    req.status !== REQUEST_STATUS.FULFILLED &&
    req.status !== REQUEST_STATUS.CANCELLED
  const showStaffPanel = canViewStaff && req && nextRequestStatuses(req.status).length > 0

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        to="/requests"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Medication requests
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Request detail
      </h1>

      {error ? (
        <div
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : !req ? (
        <p className="mt-8 text-sm text-slate-500">Request not found.</p>
      ) : (
        <div className="mt-8 space-y-6">
          <div className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {req.medicationName}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {humanizeStatus(req.status)}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Quantity</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{req.quantity}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Urgency</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {humanizeStatus(req.urgencyLevel)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Pharmacy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {pharmacyLabel(req.pharmacyId)}
                </dd>
              </div>
              {canViewStaff ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Patient</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                    {patientLabel(req.userId)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Submitted</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {formatDate(req.requestDate || req.createdAt)}
                </dd>
              </div>
              {req.responseDate ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Last response</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    {formatDate(req.responseDate)}
                  </dd>
                </div>
              ) : null}
              {req.estimatedAvailability ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Est. availability</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    {formatDate(req.estimatedAvailability)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Prescription required</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {req.prescriptionRequired ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
            {req.prescriptionImage ? (
              <p className="mt-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Prescription: </span>
                <a
                  href={req.prescriptionImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-700 underline dark:text-emerald-400"
                >
                  Open link
                </a>
              </p>
            ) : null}
            {req.notes ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <span className="font-medium text-slate-600 dark:text-slate-400">Notes: </span>
                {req.notes}
              </div>
            ) : null}
          </div>

          {showPatientEdit ? (
            <form onSubmit={handleSavePatientEdit} className={cardClass}>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit request (pending only)
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Quantity
                  </label>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={10000}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Urgency
                  </label>
                  <select
                    className={inputClass}
                    value={editUrgency}
                    onChange={(e) => setEditUrgency(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Prescription image URL
                </label>
                <input
                  className={inputClass}
                  type="url"
                  value={editRxUrl}
                  onChange={(e) => setEditRxUrl(e.target.value)}
                />
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Notes
                </label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <button type="submit" className={`mt-4 ${btnPrimary}`} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : null}

          {showStaffPanel ? (
            <form onSubmit={handleStatusUpdate} className={cardClass}>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Update status
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                Valid transitions follow your pharmacy workflow. The patient is notified when the
                status changes.
              </p>
              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                New status
              </label>
              <select
                className={inputClass}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                required
              >
                {nextRequestStatuses(req.status).map((s) => (
                  <option key={s} value={s}>
                    {humanizeStatus(s)}
                  </option>
                ))}
              </select>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Message to patient (optional)
                </label>
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y`}
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Estimated availability (optional)
                </label>
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={estimatedAt}
                  onChange={(e) => setEstimatedAt(e.target.value)}
                />
              </div>
              <button type="submit" className={`mt-4 ${btnPrimary}`} disabled={savingStatus}>
                {savingStatus ? 'Updating…' : 'Apply status'}
              </button>
            </form>
          ) : null}

          {showPatientCancel ? (
            <div className={cardClass}>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Cancel request
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                You cannot cancel a request that is already fulfilled or cancelled.
              </p>
              <button
                type="button"
                onClick={handleCancel}
                className={`mt-4 ${btnDanger}`}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel request'}
              </button>
            </div>
          ) : null}

          {canViewAsPatient && req.status === REQUEST_STATUS.AVAILABLE ? (
            <div className={cardClass}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This request is available. You can place an order from your approved request.
              </p>
              <Link
                to="/orders/new"
                className={`mt-4 inline-flex ${btnPrimary}`}
              >
                Go to new order
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
