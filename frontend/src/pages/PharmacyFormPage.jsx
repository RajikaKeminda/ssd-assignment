import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClientError } from '../api/client'
import * as pharmaciesApi from '../api/pharmacies'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function defaultDay() {
  return { open: '09:00', close: '17:00', isClosed: false }
}

function defaultForm() {
  return {
    name: '',
    licenseNumber: '',
    location: { address: '', city: '', province: '', postalCode: '' },
    contactInfo: { phone: '', email: '', website: '', emergencyContact: '' },
    serviceRadius: 5,
    facilityType: 'retail',
    services: '',
    certifications: '',
    operatingHours: DAYS.reduce((acc, d) => ({ ...acc, [d]: defaultDay() }), {}),
  }
}

export function PharmacyFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadItem = useCallback(async () => {
    if (!isEdit) return
    setLoading(true)
    setError('')
    try {
      const item = await pharmaciesApi.getPharmacy(id)
      setForm({
        name: item.name ?? '',
        licenseNumber: item.licenseNumber ?? '',
        location: {
          address: item.location?.address ?? '',
          city: item.location?.city ?? '',
          province: item.location?.province ?? '',
          postalCode: item.location?.postalCode ?? '',
        },
        contactInfo: {
          phone: item.contactInfo?.phone ?? '',
          email: item.contactInfo?.email ?? '',
          website: item.contactInfo?.website ?? '',
          emergencyContact: item.contactInfo?.emergencyContact ?? '',
        },
        serviceRadius: Number(item.serviceRadius ?? 5),
        facilityType: item.facilityType ?? 'retail',
        services: Array.isArray(item.services) ? item.services.join(', ') : '',
        certifications: Array.isArray(item.certifications) ? item.certifications.join(', ') : '',
        operatingHours: DAYS.reduce(
          (acc, d) => ({
            ...acc,
            [d]: {
              open: item.operatingHours?.[d]?.open ?? '09:00',
              close: item.operatingHours?.[d]?.close ?? '17:00',
              isClosed: Boolean(item.operatingHours?.[d]?.isClosed),
            },
          }),
          {}
        ),
      })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load pharmacy.')
    } finally {
      setLoading(false)
    }
  }, [id, isEdit])

  useEffect(() => {
    loadItem()
  }, [loadItem])

  const setRoot = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const setNested = (parent, field) => (e) =>
    setForm((prev) => ({ ...prev, [parent]: { ...prev[parent], [field]: e.target.value } }))
  const setDay = (day, field) => (e) =>
    setForm((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: { ...prev.operatingHours[day], [field]: field === 'isClosed' ? e.target.checked : e.target.value },
      },
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = {
        name: form.name.trim(),
        licenseNumber: form.licenseNumber.trim(),
        location: { ...form.location },
        contactInfo: { ...form.contactInfo },
        operatingHours: { ...form.operatingHours },
        serviceRadius: Number(form.serviceRadius),
        facilityType: form.facilityType,
        services: form.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        certifications: form.certifications
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      if (!body.contactInfo.website) delete body.contactInfo.website
      if (!body.contactInfo.emergencyContact) delete body.contactInfo.emergencyContact
      if (isEdit) {
        await pharmaciesApi.updatePharmacy(id, body)
        navigate(`/pharmacies/${id}`, { replace: true })
      } else {
        const created = await pharmaciesApi.createPharmacy(body)
        navigate(`/pharmacies/${created._id}`, { replace: true })
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to save pharmacy.')
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
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <Link to="/pharmacies" className="mb-6 inline-flex text-sm font-medium text-emerald-700 dark:text-emerald-400">
        ← Back to Pharmacies
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isEdit ? 'Edit Pharmacy' : 'Register Pharmacy'}
      </h1>
      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Basic</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Pharmacy name" value={form.name} onChange={setRoot('name')} required />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="License number" value={form.licenseNumber} onChange={setRoot('licenseNumber')} required />
            <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" value={form.facilityType} onChange={setRoot('facilityType')}>
              <option value="retail">Retail</option>
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
            </select>
            <input type="number" min="0" step="0.1" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Service radius (km)" value={form.serviceRadius} onChange={setRoot('serviceRadius')} required />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Street address" value={form.location.address} onChange={setNested('location', 'address')} required />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="City" value={form.location.city} onChange={setNested('location', 'city')} required />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Province" value={form.location.province} onChange={setNested('location', 'province')} required />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Postal code" value={form.location.postalCode} onChange={setNested('location', 'postalCode')} required />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Phone" value={form.contactInfo.phone} onChange={setNested('contactInfo', 'phone')} required />
            <input type="email" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Email" value={form.contactInfo.email} onChange={setNested('contactInfo', 'email')} required />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Website (optional)" value={form.contactInfo.website} onChange={setNested('contactInfo', 'website')} />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Emergency contact (optional)" value={form.contactInfo.emergencyContact} onChange={setNested('contactInfo', 'emergencyContact')} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Operating Hours</h2>
          <div className="space-y-3">
            {DAYS.map((d) => (
              <div key={d} className="grid items-center gap-3 sm:grid-cols-4">
                <p className="text-sm font-medium capitalize text-slate-700 dark:text-slate-300">{d}</p>
                <input type="time" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={form.operatingHours[d].open} onChange={setDay(d, 'open')} disabled={form.operatingHours[d].isClosed} />
                <input type="time" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={form.operatingHours[d].close} onChange={setDay(d, 'close')} disabled={form.operatingHours[d].isClosed} />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.operatingHours[d].isClosed} onChange={setDay(d, 'isClosed')} />
                  Closed
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Additional</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Services (comma separated)" value={form.services} onChange={setRoot('services')} />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Certifications (comma separated)" value={form.certifications} onChange={setRoot('certifications')} />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            to={isEdit ? `/pharmacies/${id}` : '/pharmacies'}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Pharmacy' : 'Create Pharmacy'}
          </button>
        </div>
      </form>
    </div>
  )
}
