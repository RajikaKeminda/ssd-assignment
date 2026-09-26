import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import * as inventoryApi from '../api/inventory'
import { ROLES } from '../constants/roles'
import {
  CATEGORIES,
  FORMS,
  CATEGORY_BADGE,
  formatMoney,
  formatDate,
  stockBadge,
  stockLabel,
  daysUntil,
  isExpiringSoon,
} from '../utils/inventoryUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-900 dark:text-white">{children ?? '—'}</dd>
    </div>
  )
}

function TagList({ items }) {
  if (!items?.length) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

export function InventoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit =
    user?.role === ROLES.PHARMACY_STAFF || user?.role === ROLES.SYSTEM_ADMIN

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await inventoryApi.getInventoryItem(id)
      setItem(data)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load item.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await inventoryApi.deleteInventoryItem(id)
      navigate('/inventory', { replace: true })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Delete failed.')
      setShowDelete(false)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
        <Link
          to="/inventory"
          className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Back to Inventory
        </Link>
      </div>
    )
  }

  if (!item) return null

  const expDays = daysUntil(item.expiryDate)
  const expSoon = isExpiringSoon(item)

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      {/* breadcrumb */}
      <Link
        to="/inventory"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Inventory
      </Link>

      {/* header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {item.medicationName}
          </h1>
          {item.genericName && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Generic: {item.genericName}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                CATEGORY_BADGE[item.category] ?? ''
              }`}
            >
              {CATEGORIES[item.category] ?? item.category}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${stockBadge(
                item,
              )}`}
            >
              {stockLabel(item)}
            </span>
            {item.requiresPrescription && (
              <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 ring-1 ring-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-800/60">
                Rx Required
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link
              to={`/inventory/${item._id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 112.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487z" />
              </svg>
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {/* medication info */}
      <section className={`${cardClass} mb-4`}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Medication Information
        </h2>
        <dl className="space-y-3">
          <InfoRow label="Dosage">{item.dosage}</InfoRow>
          <InfoRow label="Form">{FORMS[item.form] ?? item.form}</InfoRow>
          <InfoRow label="Manufacturer">{item.manufacturer}</InfoRow>
          <InfoRow label="Active Ingredients">
            <TagList items={item.activeIngredients} />
          </InfoRow>
        </dl>
      </section>

      {/* stock info */}
      <section className={`${cardClass} mb-4`}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Stock & Pricing
        </h2>
        <dl className="space-y-3">
          <InfoRow label="Quantity">
            <span className="font-mono font-semibold">{item.quantity}</span>
          </InfoRow>
          <InfoRow label="Low Stock Threshold">{item.lowStockThreshold}</InfoRow>
          <InfoRow label="Unit Price">{formatMoney(item.unitPrice)}</InfoRow>
          <InfoRow label="Batch Number">{item.batchNumber}</InfoRow>
          <InfoRow label="Expiry Date">
            <span className={expSoon ? 'font-medium text-red-600 dark:text-red-400' : ''}>
              {formatDate(item.expiryDate)}
              {expSoon && expDays > 0 && (
                <span className="ml-1 text-xs">({expDays} days remaining)</span>
              )}
            </span>
          </InfoRow>
          <InfoRow label="Storage">{item.storageConditions}</InfoRow>
        </dl>
      </section>

      {/* medical info */}
      <section className={cardClass}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Medical Details
        </h2>
        <dl className="space-y-3">
          <InfoRow label="Side Effects">
            <TagList items={item.sideEffects} />
          </InfoRow>
          <InfoRow label="Contraindications">
            <TagList items={item.contraindications} />
          </InfoRow>
          <InfoRow label="Prescription">
            {item.requiresPrescription ? 'Required' : 'Not required'}
          </InfoRow>
        </dl>
      </section>

      {/* delete modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Medication</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">{item.medicationName}</strong>?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
