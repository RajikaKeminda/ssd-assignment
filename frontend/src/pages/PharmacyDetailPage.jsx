import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClientError } from '../api/client'
import * as pharmaciesApi from '../api/pharmacies'
import { useAuth } from '../context/useAuth'
import { ROLES } from '../constants/roles'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function PharmacyDetailPage() {
  const { id } = useParams()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(5)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const canManage =
    isAuthenticated &&
    (user?.role === ROLES.PHARMACY_STAFF || user?.role === ROLES.SYSTEM_ADMIN)
  const isAdmin = isAuthenticated && user?.role === ROLES.SYSTEM_ADMIN
  const canReview = isAuthenticated && user?.role === ROLES.PATIENT
  const isOwner = useMemo(
    () => Boolean(item?.ownerId && (item.ownerId === user?._id || item.ownerId?._id === user?._id)),
    [item?.ownerId, user?._id]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [pharmacy, reviewData] = await Promise.all([
        pharmaciesApi.getPharmacy(id),
        pharmaciesApi.listPharmacyReviews(id, { page: 1, limit: 5, sortOrder: 'desc' }),
      ])
      setItem(pharmacy)
      setReviews(Array.isArray(reviewData?.items) ? reviewData.items : [])
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load pharmacy.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const submitReview = async (e) => {
    e.preventDefault()
    if (!canReview) return
    setSubmittingReview(true)
    setError('')
    try {
      await pharmaciesApi.createPharmacyReview(id, {
        rating: Number(rating),
        comment: reviewText.trim() || undefined,
      })
      setReviewText('')
      setRating(5)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to add review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeactivate = async () => {
    if (!canManage || !item) return
    setDeactivating(true)
    setError('')
    try {
      await pharmaciesApi.deactivatePharmacy(item._id)
      navigate('/pharmacies', { replace: true })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to deactivate pharmacy.')
      setDeactivating(false)
    }
  }

  const handleVerify = async () => {
    if (!isAdmin || !item || item.isVerified) return
    setVerifying(true)
    setError('')
    try {
      const updated = await pharmaciesApi.verifyPharmacy(item._id)
      setItem(updated)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to verify pharmacy.')
    } finally {
      setVerifying(false)
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
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <Link
        to="/pharmacies"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        ← Back to Pharmacies
      </Link>

      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {item.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.licenseNumber}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.facilityType}
              </span>
              {item.isVerified ? (
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Verified
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Pending verification
                </span>
              )}
            </div>
          </div>
          {canManage && (isOwner || isAdmin) ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/pharmacies/${item._id}/edit`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Edit
              </Link>
              {isAdmin && !item.isVerified ? (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleVerify}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={deactivating}
                onClick={handleDeactivate}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60"
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Contact
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
              <dd className="text-slate-900 dark:text-white">{item.contactInfo?.phone ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="text-slate-900 dark:text-white">{item.contactInfo?.email ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Website</dt>
              <dd className="text-slate-900 dark:text-white">{item.contactInfo?.website || '-'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Location
          </h2>
          <p className="mt-3 text-sm text-slate-900 dark:text-white">
            {item.location?.address}, {item.location?.city}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {item.location?.province}, {item.location?.postalCode}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Service radius: {item.serviceRadius} km
          </p>
        </section>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Operating Hours
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DAY_KEYS.map((d) => {
            const day = item.operatingHours?.[d]
            const text = day?.isClosed ? 'Closed' : `${day?.open ?? '--:--'} - ${day?.close ?? '--:--'}`
            return (
              <div key={d} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300">{titleCase(d)}</span>
                <span className="text-slate-600 dark:text-slate-400">{text}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Reviews ({item.totalReviews ?? 0})
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Average rating: {Number(item.rating ?? 0).toFixed(1)} / 5</p>

        {canReview ? (
          <form onSubmit={submitReview} className="mt-4 grid gap-3 sm:grid-cols-4">
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} stars</option>
              ))}
            </select>
            <input
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write a short review"
              className="sm:col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {submittingReview ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        ) : null}

        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r._id} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {r.userId?.name ?? 'User'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.rating}/5</p>
                </div>
                {r.comment ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{r.comment}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
