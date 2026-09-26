import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROLES } from '../constants/roles'

function CheckIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={props.className}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Home() {
  const { user, isAuthenticated } = useAuth()

  const features = []

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.18),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-24 -z-10 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-600/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-20 -z-10 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-600/10"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            Remote pharmacy care
          </p>
          <h1 className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-800 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:via-slate-100 dark:to-emerald-200 sm:text-5xl sm:leading-tight lg:text-6xl">
            Medication tracking, simplified
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Request medications, follow orders, and stay on schedule—one place for patients
            and pharmacy teams.
          </p>
        </div>

        {isAuthenticated ? (
          <section
            className="mx-auto mt-14 w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white/90 p-8 shadow-xl shadow-slate-200/40 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none"
            aria-labelledby="welcome-heading"
          >
            <h2
              id="welcome-heading"
              className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Welcome back{user?.name ? `, ${user.name}` : ''}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Signed in as{' '}
              <span className="font-medium text-slate-900 dark:text-slate-200">{user?.email}</span>
              {user?.role ? (
                <>
                  {' '}
                  <span
                    className="ml-1 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60"
                  >
                    {user.role}
                  </span>
                </>
              ) : null}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-500">
              {(user?.role === ROLES.PATIENT ||
                user?.role === ROLES.PHARMACY_STAFF ||
                user?.role === ROLES.SYSTEM_ADMIN) && (
                <>
                  <Link
                    to="/requests"
                    className="font-medium text-emerald-700 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-600 dark:text-emerald-400"
                  >
                    Medication requests
                  </Link>
                  {' · '}
                </>
              )}
              <Link
                to="/orders"
                className="font-medium text-emerald-700 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-600 dark:text-emerald-400"
              >
                Orders
              </Link>{' '}
              for deliveries, payment, and fulfillment by role.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/30 sm:w-auto"
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
              >
                Log in
              </Link>
            </div>

            <ul className="mx-auto mt-16 grid max-w-3xl gap-4 sm:grid-cols-3">
              {features.map((text) => (
                <li
                  key={text}
                  className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white/80 p-5 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium leading-snug text-slate-700 dark:text-slate-300">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
