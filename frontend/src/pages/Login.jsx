import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiClientError } from '../api/client'
import { AuthScenery } from '../components/AuthScenery'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20'

export function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email: email.trim().toLowerCase(), password })
      navigate('/', { replace: true })
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Something went wrong. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <AuthScenery />
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Log in
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Welcome back. New here?{' '}
            <Link
              to="/signup"
              className="font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              Create an account
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
              />
            </label>

            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
