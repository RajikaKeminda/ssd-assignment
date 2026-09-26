import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import moment from 'moment'
import { ApiClientError } from '../api/client'
import * as inventoryApi from '../api/inventory'
import { listPharmacies } from '../api/pharmacies'
import { CATEGORIES, FORMS } from '../utils/inventoryUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600'
const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const labelClass =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'

const EMPTY = {
  pharmacyId: '',
  medicationName: '',
  genericName: '',
  category: 'otc',
  dosage: '',
  form: '',
  quantity: '',
  unitPrice: '',
  batchNumber: '',
  expiryDate: '',
  manufacturer: '',
  requiresPrescription: false,
  lowStockThreshold: '10',
  storageConditions: '',
  sideEffects: [],
  contraindications: [],
  activeIngredients: [],
}

/* ─── tag input component ─── */
function TagInput({ id, label, value = [], onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const trimmed = draft.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
  }

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          id={id}
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Type and press Enter…"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── main form ─── */
export function InventoryFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [pharmacies, setPharmacies] = useState([])
  const [pharmaciesLoading, setPharmaciesLoading] = useState(false)

  /* load pharmacies for the dropdown (only when creating) */
  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    ;(async () => {
      setPharmaciesLoading(true)
      try {
        const data = await listPharmacies({ limit: 200 })
        if (!cancelled) {
          /* data may be an array or { pharmacies: [...] } depending on API shape */
          setPharmacies(Array.isArray(data) ? data : data.pharmacies ?? [])
        }
      } catch {
        /* silently fail – user can still type manually if needed */
      } finally {
        if (!cancelled) setPharmaciesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isEdit])

  /* load existing item for edit */
  const loadItem = useCallback(async () => {
    if (!isEdit) return
    setLoading(true)
    try {
      const data = await inventoryApi.getInventoryItem(id)
      setForm({
        pharmacyId: data.pharmacyId ?? '',
        medicationName: data.medicationName ?? '',
        genericName: data.genericName ?? '',
        category: data.category ?? 'otc',
        dosage: data.dosage ?? '',
        form: data.form ?? '',
        quantity: data.quantity ?? '',
        unitPrice: data.unitPrice ?? '',
        batchNumber: data.batchNumber ?? '',
        expiryDate: data.expiryDate ? data.expiryDate.slice(0, 10) : '',
        manufacturer: data.manufacturer ?? '',
        requiresPrescription: data.requiresPrescription ?? false,
        lowStockThreshold: data.lowStockThreshold ?? 10,
        storageConditions: data.storageConditions ?? '',
        sideEffects: data.sideEffects ?? [],
        contraindications: data.contraindications ?? [],
        activeIngredients: data.activeIngredients ?? [],
      })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load item.')
    } finally {
      setLoading(false)
    }
  }, [id, isEdit])

  useEffect(() => {
    loadItem()
  }, [loadItem])

  /* field updater */
  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  /* client-side validation */
  const validate = () => {
    const errs = {}
    if (!isEdit && !form.pharmacyId) errs.pharmacyId = 'Please select a pharmacy'
    if (!form.medicationName.trim()) errs.medicationName = 'Medication name is required'
    if (form.quantity === '' || Number(form.quantity) < 0) errs.quantity = 'Valid quantity required'
    if (form.unitPrice === '' || Number(form.unitPrice) < 0) errs.unitPrice = 'Valid price required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* submit */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setError('')
    try {
      const body = {
        ...form,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        lowStockThreshold: Number(form.lowStockThreshold) || 10,
      }
      /* remove empty optional fields */
      if (!body.genericName) delete body.genericName
      if (!body.dosage) delete body.dosage
      if (!body.form) delete body.form
      if (!body.batchNumber) delete body.batchNumber
      if (!body.expiryDate) delete body.expiryDate
      else body.expiryDate = moment(body.expiryDate, 'YYYY-MM-DD').toISOString()
      if (!body.manufacturer) delete body.manufacturer
      if (!body.storageConditions) delete body.storageConditions
      if (!body.sideEffects?.length) delete body.sideEffects
      if (!body.contraindications?.length) delete body.contraindications
      if (!body.activeIngredients?.length) delete body.activeIngredients

      if (isEdit) {
        delete body.pharmacyId /* don't send pharmacyId on update */
        await inventoryApi.updateInventoryItem(id, body)
        navigate(`/inventory/${id}`, { replace: true })
      } else {
        const created = await inventoryApi.createInventoryItem(body)
        navigate(`/inventory/${created._id}`, { replace: true })
      }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Save failed. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

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

      <h1 className="mb-8 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isEdit ? 'Edit Medication' : 'Add Medication'}
      </h1>

      {error && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* basic info */}
        <section className={cardClass}>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Basic Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isEdit && (
              <div className="sm:col-span-2">
                <label htmlFor="pharmacyId" className={labelClass}>
                  Pharmacy <span className="text-red-500">*</span>
                </label>
                <select
                  id="pharmacyId"
                  className={selectClass}
                  value={form.pharmacyId}
                  onChange={set('pharmacyId')}
                  disabled={pharmaciesLoading}
                >
                  <option value="">
                    {pharmaciesLoading ? 'Loading pharmacies…' : '— Select a Pharmacy —'}
                  </option>
                  {pharmacies.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}{p.location ? ` — ${p.location}` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.pharmacyId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.pharmacyId}</p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="medicationName" className={labelClass}>
                Medication Name <span className="text-red-500">*</span>
              </label>
              <input
                id="medicationName"
                className={inputClass}
                value={form.medicationName}
                onChange={set('medicationName')}
                placeholder="e.g. Amoxicillin"
              />
              {fieldErrors.medicationName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.medicationName}</p>
              )}
            </div>
            <div>
              <label htmlFor="genericName" className={labelClass}>
                Generic Name
              </label>
              <input
                id="genericName"
                className={inputClass}
                value={form.genericName}
                onChange={set('genericName')}
                placeholder="e.g. Amoxicillin"
              />
            </div>
            <div>
              <label htmlFor="category" className={labelClass}>
                Category
              </label>
              <select id="category" className={selectClass} value={form.category} onChange={set('category')}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="formType" className={labelClass}>
                Form
              </label>
              <select id="formType" className={selectClass} value={form.form} onChange={set('form')}>
                <option value="">— Select —</option>
                {Object.entries(FORMS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dosage" className={labelClass}>
                Dosage
              </label>
              <input id="dosage" className={inputClass} value={form.dosage} onChange={set('dosage')} placeholder="e.g. 500mg" />
            </div>
            <div>
              <label htmlFor="manufacturer" className={labelClass}>
                Manufacturer
              </label>
              <input id="manufacturer" className={inputClass} value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. PharmaCorp" />
            </div>
          </div>
        </section>

        {/* stock & pricing */}
        <section className={cardClass}>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Stock & Pricing
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="quantity" className={labelClass}>
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                className={inputClass}
                value={form.quantity}
                onChange={set('quantity')}
                placeholder="0"
              />
              {fieldErrors.quantity && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
              )}
            </div>
            <div>
              <label htmlFor="unitPrice" className={labelClass}>
                Unit Price (USD) <span className="text-red-500">*</span>
              </label>
              <input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.unitPrice}
                onChange={set('unitPrice')}
                placeholder="0.00"
              />
              {fieldErrors.unitPrice && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.unitPrice}</p>
              )}
            </div>
            <div>
              <label htmlFor="batchNumber" className={labelClass}>
                Batch Number
              </label>
              <input id="batchNumber" className={inputClass} value={form.batchNumber} onChange={set('batchNumber')} placeholder="e.g. BATCH-2024-001" />
            </div>
            <div>
              <label htmlFor="expiryDate" className={labelClass}>
                Expiry Date
              </label>
              <input id="expiryDate" type="date" className={inputClass} value={form.expiryDate} onChange={set('expiryDate')} />
            </div>
            <div>
              <label htmlFor="lowStockThreshold" className={labelClass}>
                Low Stock Threshold
              </label>
              <input id="lowStockThreshold" type="number" min="0" className={inputClass} value={form.lowStockThreshold} onChange={set('lowStockThreshold')} />
            </div>
            <div>
              <label htmlFor="storageConditions" className={labelClass}>
                Storage Conditions
              </label>
              <input id="storageConditions" className={inputClass} value={form.storageConditions} onChange={set('storageConditions')} placeholder="e.g. Store below 25°C" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              id="requiresPrescription"
              type="checkbox"
              checked={form.requiresPrescription}
              onChange={set('requiresPrescription')}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
            />
            <label htmlFor="requiresPrescription" className="text-sm text-slate-700 dark:text-slate-300">
              Requires Prescription
            </label>
          </div>
        </section>

        {/* medical details */}
        <section className={cardClass}>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Medical Details
          </h2>
          <div className="space-y-4">
            <TagInput
              id="activeIngredients"
              label="Active Ingredients"
              value={form.activeIngredients}
              onChange={(v) => setForm((prev) => ({ ...prev, activeIngredients: v }))}
            />
            <TagInput
              id="sideEffects"
              label="Side Effects"
              value={form.sideEffects}
              onChange={(v) => setForm((prev) => ({ ...prev, sideEffects: v }))}
            />
            <TagInput
              id="contraindications"
              label="Contraindications"
              value={form.contraindications}
              onChange={(v) => setForm((prev) => ({ ...prev, contraindications: v }))}
            />
          </div>
        </section>

        {/* actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/inventory"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Update Medication' : 'Create Medication'}
          </button>
        </div>
      </form>
    </div>
  )
}
