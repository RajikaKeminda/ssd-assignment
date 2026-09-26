import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import { AuthScenery } from '../components/AuthScenery'

const ROLES = [
  { value: 'Patient', label: 'Patient' },
  { value: 'Pharmacy Staff', label: 'Pharmacy staff' },
  { value: 'Delivery Partner', label: 'Delivery partner' },
  { value: 'System Admin', label: 'System admin' },
]

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20'

function formatFieldError(details, fieldKey) {
  if (!details?.length) return ''
  const hit = details.find(
    (d) =>
      d.field === fieldKey ||
      d.field === `body.${fieldKey}` ||
      d.field?.endsWith(`.${fieldKey}`)
  )
  return hit?.message ?? ''
}

export function Signup() {
  const navigate = useNavigate()
  const { register, isAuthenticated } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('Patient')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      })
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiClientError && err.details?.length) {
        const next = {}
        for (const key of ['name', 'email', 'password', 'role', 'phone']) {
          const m = formatFieldError(err.details, key)
          if (m) next[key] = m
        }
        setFieldErrors(next)
        if (!Object.keys(next).length) setError(err.message)
      } else {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Something went wrong. Try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const errText = 'text-sm text-red-600 dark:text-red-400'

  return (
    <div className="relative flex flex-1 flex-col items-center px-4 py-10 sm:py-12">
      <AuthScenery />
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign up
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Create your account. Already registered?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              Log in
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            {error ? (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
              </span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? <span className={`mt-1 block ${errText}`}>{fieldErrors.name}</span> : null}
            </label>

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? (
                <span className={`mt-1 block ${errText}`}>{fieldErrors.email}</span>
              ) : null}
            </label>

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                At least 8 characters, with upper and lower case, a number, and a special character
                (@$!%*?&#).
              </span>
              {fieldErrors.password ? (
                <span className={`mt-1 block ${errText}`}>{fieldErrors.password}</span>
              ) : null}
            </label>

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="+94 77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? (
                <span className={`mt-1 block ${errText}`}>{fieldErrors.phone}</span>
              ) : null}
            </label>

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Role
              </span>
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`${inputClass} cursor-pointer`}
                aria-invalid={Boolean(fieldErrors.role)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {fieldErrors.role ? (
                <span className={`mt-1 block ${errText}`}>{fieldErrors.role}</span>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
