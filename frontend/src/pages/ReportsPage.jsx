import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { ROLES } from '../constants/roles'
import {
  downloadInventoryReport,
  downloadOrdersReport,
  downloadUsersReport,
  downloadRequestsReport,
} from '../api/reports'
import { listPharmacies } from '../api/pharmacies'

const cardClass =
  'rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80'
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 disabled:opacity-50'
const btnClass =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500'

function usePharmacies() {
  const [pharmacies, setPharmacies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPharmacies({ limit: 200 })
      .then(data => setPharmacies(Array.isArray(data?.pharmacies) ? data.pharmacies : Array.isArray(data) ? data : []))
      .catch(() => setPharmacies([]))
      .finally(() => setLoading(false))
  }, [])

  return { pharmacies, loading }
}

function PharmacySelect({ value, onChange, pharmacies, loading }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        Pharmacy <span className="font-normal text-slate-400">(optional — leave blank for all)</span>
      </label>
      <select
        className={selectClass}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? 'Loading pharmacies…' : 'All pharmacies'}</option>
        {pharmacies.map(p => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function ReportBadge({ color, label }) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {label}
    </span>
  )
}

function ReportCard({ icon, title, description, badgeColor, badgeLabel, children }) {
  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-xl shadow-md shadow-emerald-500/20">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <ReportBadge color={badgeColor} label={badgeLabel} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
      {msg}
    </p>
  )
}

// ── Inventory Report ──────────────────────────────────────────────────────────
function InventoryReportCard({ pharmacies, pharmaciesLoading }) {
  const [pharmacyId, setPharmacyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      await downloadInventoryReport(pharmacyId ? { pharmacyId } : {})
    } catch (e) {
      setError(e.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReportCard
      icon="📦"
      title="Inventory Report"
      description="All medications with stock levels, expiry status, and unit pricing. Low-stock and expiring items are highlighted."
      badgeColor="emerald"
      badgeLabel="Pharmacy Staff · Admin"
    >
      <div className="space-y-3">
        <PharmacySelect
          value={pharmacyId}
          onChange={setPharmacyId}
          pharmacies={pharmacies}
          loading={pharmaciesLoading}
        />
        <button className={btnClass} onClick={handleDownload} disabled={loading}>
          {loading ? <Spinner /> : <DownloadIcon />}
          {loading ? 'Generating PDF…' : 'Download Inventory Report'}
        </button>
        <ErrorMsg msg={error} />
      </div>
    </ReportCard>
  )
}

// ── Orders Report ─────────────────────────────────────────────────────────────
function OrdersReportCard({ pharmacies, pharmaciesLoading }) {
  const [pharmacyId, setPharmacyId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      await downloadOrdersReport({ pharmacyId, from, to })
    } catch (e) {
      setError(e.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReportCard
      icon="🧾"
      title="Orders Report"
      description="Full order listing with status, payment info, and revenue summary. Includes per-status breakdown."
      badgeColor="blue"
      badgeLabel="Pharmacy Staff · Admin"
    >
      <div className="space-y-3">
        <PharmacySelect
          value={pharmacyId}
          onChange={setPharmacyId}
          pharmacies={pharmacies}
          loading={pharmaciesLoading}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">From</label>
            <input type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
            <input type="date" className={inputClass} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <button className={btnClass} onClick={handleDownload} disabled={loading}>
          {loading ? <Spinner /> : <DownloadIcon />}
          {loading ? 'Generating PDF…' : 'Download Orders Report'}
        </button>
        <ErrorMsg msg={error} />
      </div>
    </ReportCard>
  )
}

// ── Requests Report ───────────────────────────────────────────────────────────
function RequestsReportCard({ pharmacies, pharmaciesLoading }) {
  const [pharmacyId, setPharmacyId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      await downloadRequestsReport({ pharmacyId, from, to })
    } catch (e) {
      setError(e.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReportCard
      icon="💊"
      title="Medication Requests Report"
      description="All medication requests with urgency levels, status breakdown, and fulfillment rate."
      badgeColor="amber"
      badgeLabel="Pharmacy Staff · Admin"
    >
      <div className="space-y-3">
        <PharmacySelect
          value={pharmacyId}
          onChange={setPharmacyId}
          pharmacies={pharmacies}
          loading={pharmaciesLoading}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">From</label>
            <input type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
            <input type="date" className={inputClass} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <button className={btnClass} onClick={handleDownload} disabled={loading}>
          {loading ? <Spinner /> : <DownloadIcon />}
          {loading ? 'Generating PDF…' : 'Download Requests Report'}
        </button>
        <ErrorMsg msg={error} />
      </div>
    </ReportCard>
  )
}

// ── Users Report ──────────────────────────────────────────────────────────────
function UsersReportCard() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      await downloadUsersReport()
    } catch (e) {
      setError(e.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReportCard
      icon="👥"
      title="Users Report"
      description="All registered users grouped by role, with account status, email verification, and registration date."
      badgeColor="purple"
      badgeLabel="Admin only"
    >
      <div className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          This report includes all users across all roles. No filters required.
        </p>
        <button className={btnClass} onClick={handleDownload} disabled={loading}>
          {loading ? <Spinner /> : <DownloadIcon />}
          {loading ? 'Generating PDF…' : 'Download Users Report'}
        </button>
        <ErrorMsg msg={error} />
      </div>
    </ReportCard>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.SYSTEM_ADMIN
  const isStaffOrAdmin = user?.role === ROLES.PHARMACY_STAFF || isAdmin
  const { pharmacies, loading: pharmaciesLoading } = usePharmacies()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate and download PDF reports for operational insights. Reports are produced in real-time from live data.
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/60 dark:bg-emerald-950/30">
        <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
          </svg>
        </span>
        <p className="text-sm text-emerald-800 dark:text-emerald-300">
          Reports are exported as <strong>PDF files</strong>. They will download automatically when ready.
          {!isAdmin && ' The Users Report is restricted to System Administrators.'}
        </p>
      </div>

      {/* Report cards grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {isStaffOrAdmin && (
          <InventoryReportCard pharmacies={pharmacies} pharmaciesLoading={pharmaciesLoading} />
        )}
        {isStaffOrAdmin && (
          <OrdersReportCard pharmacies={pharmacies} pharmaciesLoading={pharmaciesLoading} />
        )}
        {isStaffOrAdmin && (
          <RequestsReportCard pharmacies={pharmacies} pharmaciesLoading={pharmaciesLoading} />
        )}
        {isAdmin && <UsersReportCard />}
      </div>

      {!isStaffOrAdmin && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="mb-4 text-5xl">🔒</span>
          <h2 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-300">Access Restricted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Reports are only available to Pharmacy Staff and System Administrators.
          </p>
        </div>
      )}
    </div>
  )
}
