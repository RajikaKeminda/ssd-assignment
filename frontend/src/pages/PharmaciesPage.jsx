import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError } from '../api/client'
import * as pharmaciesApi from '../api/pharmacies'
import { useAuth } from '../context/useAuth'
import { ROLES } from '../constants/roles'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

export function PharmaciesPage() {
  const { user, isAuthenticated } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canManage =
    isAuthenticated &&
    (user?.role === ROLES.PHARMACY_STAFF || user?.role === ROLES.SYSTEM_ADMIN)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await pharmaciesApi.listPharmacies({
        search,
        city,
        isVerified: verifiedFilter,
        page,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      setItems(Array.isArray(data?.items) ? data.items : [])
      setPages(Number(data?.pages) > 0 ? Number(data.pages) : 1)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load pharmacies.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [city, page, search, verifiedFilter])

  useEffect(() => {
    load()
  }, [load])

  const verifiedCount = useMemo(() => items.filter((p) => p.isVerified).length, [items])

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pharmacies
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse and manage pharmacy profiles, verification status, and location details.
          </p>
        </div>
        {canManage ? (
          <Link
            to="/pharmacies/new"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Register Pharmacy
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Listed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Verified</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{verifiedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Unverified
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{items.length - verifiedCount}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Search
            </label>
            <input
              className={inputClass}
              placeholder="Pharmacy name or license"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              City
            </label>
            <input
              className={inputClass}
              placeholder="e.g. Colombo"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Verification
            </label>
            <select
              className={inputClass}
              value={verifiedFilter}
              onChange={(e) => {
                setVerifiedFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-8 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
          No pharmacies found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">City</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Rating</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900/40">
                {items.map((p) => (
                  <tr key={p._id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{p.licenseNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.location?.city ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {Number(p.rating ?? 0).toFixed(1)} ({p.totalReviews ?? 0})
                    </td>
                    <td className="px-4 py-3">
                      {p.isVerified ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/pharmacies/${p._id}`}
                        className="font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={loading || page <= 1}
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
            disabled={loading || page >= pages}
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
