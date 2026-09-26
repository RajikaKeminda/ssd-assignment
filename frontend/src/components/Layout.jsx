import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROLES } from '../constants/roles'

const navInactive =
  'rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
const navActive =
  'rounded-lg px-3 py-2 text-sm font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/80'

function showRequestsNav(role) {
  return (
    role === ROLES.PATIENT ||
    role === ROLES.PHARMACY_STAFF ||
    role === ROLES.SYSTEM_ADMIN
  )
}

export function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const showInventory =
    isAuthenticated &&
    (user?.role === ROLES.PHARMACY_STAFF || user?.role === ROLES.SYSTEM_ADMIN)

  const showReports =
    isAuthenticated &&
    (user?.role === ROLES.PHARMACY_STAFF || user?.role === ROLES.SYSTEM_ADMIN)

  return (
    <div className="flex min-h-svh flex-col bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 transition hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md shadow-emerald-500/25"
              aria-hidden
            >
              Rx
            </span>
            <span className="hidden sm:inline">Medication Tracker</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => (isActive ? navActive : navInactive)}>
              Home
            </NavLink>
            {isAuthenticated ? (
              <NavLink
                to="/orders"
                className={({ isActive }) => (isActive ? navActive : navInactive)}
              >
                Orders
              </NavLink>
            ) : null}
            <NavLink
              to="/pharmacies"
              className={({ isActive }) => (isActive ? navActive : navInactive)}
            >
              Pharmacies
            </NavLink>
            {showInventory ? (
              <NavLink
                to="/inventory"
                className={({ isActive }) => (isActive ? navActive : navInactive)}
              >
                Inventory
              </NavLink>
            ) : null}
            {isAuthenticated && showRequestsNav(user?.role) ? (
              <NavLink
                to="/requests"
                className={({ isActive }) => (isActive ? navActive : navInactive)}
              >
                Requests
              </NavLink>
            ) : null}
            {showReports ? (
              <NavLink
                to="/reports"
                className={({ isActive }) => (isActive ? navActive : navInactive)}
              >
                Reports
              </NavLink>
            ) : null}
            {!isAuthenticated ? (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) => (isActive ? navActive : navInactive)}
                >
                  Log in
                </NavLink>
                <NavLink
                  to="/signup"
                  className={({ isActive }) =>
                    isActive
                      ? `${navActive} sm:shadow-sm`
                      : `${navInactive} bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:px-4`
                  }
                >
                  Sign up
                </NavLink>
              </>
            ) : (
              <>
                <span
                  className="max-w-[10rem] truncate px-2 text-sm text-slate-600 dark:text-slate-400"
                  title={user?.email}
                >
                  {user?.name}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="relative flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
