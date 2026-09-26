import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as pharmaciesApi from '../api/pharmacies'
import * as requestsApi from '../api/requests'
import { ROLES } from '../constants/roles'
import { pharmacyLabel } from '../utils/requestUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const btnPrimary =
  'rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50'

export function CreateMedicationRequestPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [pharmacies, setPharmacies] = useState([])
  const [pharmacyId, setPharmacyId] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [urgencyLevel, setUrgencyLevel] = useState('normal')
  const [prescriptionRequired, setPrescriptionRequired] = useState(false)
  const [prescriptionImage, setPrescriptionImage] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingPharmacies, setLoadingPharmacies] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadPharmacies = useCallback(async () => {
    setLoadingPharmacies(true)
    setError('')
    try {
      const data = await pharmaciesApi.listPharmacies({
        limit: '100',
        page: '1',
        isVerified: 'true',
        sortBy: 'name',
        sortOrder: 'asc',
      })
      setPharmacies(data.items ?? [])
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load pharmacies')
      setPharmacies([])
    } finally {
      setLoadingPharmacies(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && user?.role === ROLES.PATIENT) loadPharmacies()
  }, [isAuthenticated, user?.role, loadPharmacies])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== ROLES.PATIENT) {
    return <Navigate to="/requests" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const body = {
      pharmacyId,
      medicationName: medicationName.trim(),
      quantity: Math.max(1, parseInt(String(quantity), 10) || 1),
      urgencyLevel,
      prescriptionRequired,
    }
    if (notes.trim()) body.notes = notes.trim()
    const img = prescriptionImage.trim()
    if (img) body.prescriptionImage = img

    if (!body.pharmacyId) {
      setError('Select a pharmacy.')
      return
    }
    if (body.medicationName.length < 2) {
      setError('Medication name must be at least 2 characters.')
      return
    }

    setSubmitting(true)
    try {
      const created = await requestsApi.createRequest(body)
      navigate(`/requests/${created._id}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        to="/requests"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Medication requests
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Request medication
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Choose a verified pharmacy and describe what you need. You can update or cancel while
        the request is still pending.
      </p>

      {error ? (
        <div
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loadingPharmacies ? (
        <p className="mt-8 text-sm text-slate-500">Loading pharmacies…</p>
      ) : pharmacies.length === 0 ? (
        <div className={`mt-8 ${cardClass}`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No verified pharmacies are available yet. Try again later or contact support.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className={cardClass}>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pharmacy
            </label>
            <select
              className={inputClass}
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
              required
            >
              <option value="">Select pharmacy…</option>
              {pharmacies.map((p) => (
                <option key={p._id} value={p._id}>
                  {pharmacyLabel(p)}
                  {p.location?.city ? ` — ${p.location.city}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={cardClass}>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Medication name
            </label>
            <input
              className={inputClass}
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="e.g. Amoxicillin 500mg"
              required
              minLength={2}
              maxLength={200}
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Quantity
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={10000}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Urgency
                </label>
                <select
                  className={inputClass}
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={prescriptionRequired}
                onChange={(e) => setPrescriptionRequired(e.target.checked)}
              />
              Prescription required for this medication
            </label>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Prescription image URL (optional)
              </label>
              <input
                className={inputClass}
                type="url"
                value={prescriptionImage}
                onChange={(e) => setPrescriptionImage(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Notes (optional)
              </label>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                placeholder="Instructions for the pharmacy team…"
              />
            </div>
          </div>

          <button type="submit" className={`w-full sm:w-auto ${btnPrimary}`} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      )}
    </div>
  )
}
