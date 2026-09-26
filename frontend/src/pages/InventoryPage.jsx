import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  isExpiringSoon,
  daysUntil,
} from '../utils/inventoryUi'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600'

/* ───────── stat card ───────── */
function StatCard({ label, value, accent }) {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/20',
    red: 'from-red-500 to-rose-600 shadow-red-500/20',
  }
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${colors[accent]}`}
        >
          {value}
        </span>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      </div>
    </div>
  )
}

/* ───────── delete modal ───────── */
function DeleteModal({ item, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Medication</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to permanently delete{' '}
          <strong className="text-slate-900 dark:text-white">{item.medicationName}</strong>? This
          action cannot be undone.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────── main page ───────── */
export function InventoryPage() {
  const { user } = useAuth()
  const role = user?.role
  const canEdit = role === ROLES.PHARMACY_STAFF || role === ROLES.SYSTEM_ADMIN

  /* list state */
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* filter state */
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [form, setForm] = useState('')

  /* stats */
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringCount, setExpiringCount] = useState(0)

  /* delete modal */
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  /* fetch items */
  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const params = { page, limit: 12, sortBy: 'createdAt', sortOrder: 'desc' }
      if (search) params.search = search
      if (category) params.category = category
      if (form) params.form = form

      const data = await inventoryApi.listInventory(params)
      setItems(data.items ?? [])
      setTotalPages(data.pagination?.totalPages ?? 1)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load inventory.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page, search, category, form])

  /* fetch stats */
  const loadStats = useCallback(async () => {
    try {
      const [low, exp] = await Promise.all([
        inventoryApi.getLowStock(),
        inventoryApi.getExpiring({ days: 30 }),
      ])
      setLowStockCount(Array.isArray(low) ? low.length : 0)
      setExpiringCount(Array.isArray(exp) ? exp.length : 0)
    } catch {
      /* stats are non-critical */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  /* delete handler */
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await inventoryApi.deleteInventoryItem(deleteTarget._id)
      setDeleteTarget(null)
      load()
      loadStats()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      {/* header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage pharmacy medication stock, track low-stock and expiring items.
          </p>
        </div>
        {canEdit && (
          <Link
            to="/inventory/new"
            id="add-medication-btn"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Medication
          </Link>
        )}
      </div>

      {/* stats bar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Items" value={items.length > 0 || !loading ? items.length : '—'} accent="emerald" />
        <StatCard label="Low Stock" value={lowStockCount} accent="amber" />
        <StatCard label="Expiring (30d)" value={expiringCount} accent="red" />
      </div>

      {/* filters */}
      <div className={`mb-6 ${cardClass}`}>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Search
            </label>
            <input
              id="inventory-search"
              className={inputClass}
              type="text"
              placeholder="Medication name, generic name, manufacturer…"
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Category
            </label>
            <select
              id="inventory-category-filter"
              className={selectClass}
              value={category}
              onChange={(e) => {
                setPage(1)
                setCategory(e.target.value)
              }}
            >
              <option value="">All categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Form
            </label>
            <select
              id="inventory-form-filter"
              className={selectClass}
              value={form}
              onChange={(e) => {
                setPage(1)
                setForm(e.target.value)
              }}
            >
              <option value="">All forms</option>
              {Object.entries(FORMS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* error */}
      {error && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No inventory items found.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Medication</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Form</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Expiry</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900/40">
                {items.map((item) => {
                  const expDays = daysUntil(item.expiryDate)
                  const expSoon = isExpiringSoon(item)
                  return (
                    <tr
                      key={item._id}
                      className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/inventory/${item._id}`}
                          className="font-medium text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
                        >
                          {item.medicationName}
                        </Link>
                        {item.dosage && (
                          <span className="ml-1 text-xs text-slate-500">{item.dosage}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                            CATEGORY_BADGE[item.category] ?? ''
                          }`}
                        >
                          {CATEGORIES[item.category] ?? item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {FORMS[item.form] ?? item.form ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            expSoon
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }
                        >
                          {formatDate(item.expiryDate)}
                          {expSoon && expDays > 0 && (
                            <span className="ml-1 text-xs">({expDays}d)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${stockBadge(
                            item,
                          )}`}
                        >
                          {stockLabel(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/inventory/${item._id}`}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            title="View"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>
                          {canEdit && (
                            <>
                              <Link
                                to={`/inventory/${item._id}/edit`}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                                title="Edit"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 112.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487z" />
                                </svg>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
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
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      )}

      {/* delete modal */}
      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
