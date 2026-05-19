import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  LayoutDashboard,
  PlusCircle,
  LogOut,
  Wallet,
  ScanText,
  History,
  Brain,
  TrendingUp,
  Sun,
  Moon,
  User,
  Plane,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Navbar() {
  const { pathname } = useLocation()

  const { logout, user } =
    useAuth()

  const { dark, toggle } =
    useTheme()

  const navigate =
    useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const mainLinks = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Add Expense',
      path: '/add',
      icon: PlusCircle,
    },
    {
      name: 'Transactions',
      path: '/transactions',
      icon: History,
    },
    {
      name: 'Trip Expenses',
      path: '/trips',
      icon: Plane,
    },
  ]

  const aiLinks = [
    {
      name: 'Smart Insights',
      path: '/analytics',
      icon: Brain,
    },
    {
      name: 'Predictions',
      path: '/predictions',
      icon: TrendingUp,
    },
    {
      name: 'Receipt Scanner',
      path: '/ocr',
      icon: ScanText,
    },
  ]

  const settingsLinks = [
    {
      name: 'Receipt History',
      path: '/history',
      icon: History,
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: User,
    },
  ]

  const bg = dark
    ? 'bg-[#1a1a1a] border-[#2a2a2a]'
    : 'bg-white border-gray-200'

  const textPrimary = dark
    ? 'text-white'
    : 'text-gray-800'

  const textMuted = dark
    ? 'text-gray-400'
    : 'text-gray-500'

  const hoverBg = dark
    ? 'hover:bg-[#2a2a2a] hover:text-white'
    : 'hover:bg-gray-100 hover:text-gray-900'

  const tripMatch =
    pathname.match(
      /^\/trips\/(\d+)/
    )

  const tripId = tripMatch
    ? tripMatch[1]
    : null

  const walletPath = tripId
    ? `/trips/${tripId}/wallet`
    : null

  const NavLink = ({
    link,
  }) => {
    const Icon = link.icon

    const active =
      link.path === '/trips'
        ? pathname === '/trips'
        : pathname ===
            link.path ||
          pathname.startsWith(
            link.path + '/'
          )

    return (
      <Link
        to={link.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
          active
            ? 'bg-emerald-500 text-white font-medium'
            : `${textMuted} ${hoverBg}`
        }`}
      >
        <Icon size={17} />
        {link.name}
      </Link>
    )
  }

  const mobileLinks = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Add Expense',
      path: '/add',
      icon: PlusCircle,
    },
    {
      name: 'Transactions',
      path: '/transactions',
      icon: History,
    },
    {
      name: 'Trips',
      path: '/trips',
      icon: Plane,
    },
    {
      name: 'Insights',
      path: '/analytics',
      icon: Brain,
    },
  ]

  return (
    <>
      {/* Desktop Sidebar */}

      <aside
        className={`hidden md:flex fixed top-0 left-0 w-56 h-screen ${bg} border-r flex-col z-50`}
      >

        {/* Header */}

        <div
          className={`p-5 flex items-center justify-between border-b ${
            dark
              ? 'border-[#2a2a2a]'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2.5">

            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Wallet
                size={16}
                className="text-white"
              />
            </div>

            <span
              className={`font-semibold text-sm ${textPrimary}`}
            >
              SpendWise AI
            </span>

          </div>

          <button
            onClick={toggle}
            className={`p-1.5 rounded-lg ${
              dark
                ? 'text-gray-400 hover:bg-[#2a2a2a]'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {dark ? (
              <Sun size={15} />
            ) : (
              <Moon size={15} />
            )}
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 p-3 overflow-y-auto">

          {[
            {
              label: 'Main',
              links: mainLinks,
            },
            {
              label: 'AI Features',
              links: aiLinks,
            },
            {
              label: 'Settings',
              links:
                settingsLinks,
            },
          ].map(
            ({
              label,
              links,
            }) => (
              <div
                key={label}
                className="mb-4"
              >

                <p
                  className={`text-[10px] font-semibold uppercase tracking-widest px-3 mb-2 mt-1 ${
                    dark
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                >
                  {label}
                </p>

                <div className="space-y-1">
                  {links.map(
                    (
                      link
                    ) => (
                      <NavLink
                        key={
                          link.path
                        }
                        link={
                          link
                        }
                      />
                    )
                  )}
                </div>

              </div>
            )
          )}

          {/* Trip Wallet */}

          {walletPath && (
            <div className="mb-4">

              <p
                className={`text-[10px] font-semibold uppercase tracking-widest px-3 mb-2 mt-1 ${
                  dark
                    ? 'text-gray-600'
                    : 'text-gray-400'
                }`}
              >
                Trip Tools
              </p>

              <Link
                to={walletPath}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  pathname ===
                  walletPath
                    ? 'bg-emerald-500 text-white font-medium'
                    : `${textMuted} ${hoverBg}`
                }`}
              >
                <Wallet
                  size={17}
                />

                Trip Wallet
              </Link>

            </div>
          )}

        </nav>

        {/* User Section */}

        <div
          className={`p-3 border-t ${
            dark
              ? 'border-[#2a2a2a]'
              : 'border-gray-200'
          }`}
        >

          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg hover:bg-emerald-900/20"
          >

            <div className="w-7 h-7 rounded-full bg-emerald-900 flex items-center justify-center text-xs font-bold text-emerald-400">
              {user?.name
                ?.charAt(
                  0
                )
                ?.toUpperCase() ||
                user?.email
                  ?.charAt(
                    0
                  )
                  ?.toUpperCase() ||
                'U'}
            </div>

            <div className="flex-1 min-w-0">

              <p
                className={`text-xs font-medium truncate ${textPrimary}`}
              >
                {user?.name ||
                  'User'}
              </p>

              <p className="text-[10px] text-gray-500 truncate">
                {
                  user?.email
                }
              </p>

            </div>

          </Link>

          <button
            onClick={
              handleLogout
            }
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/20"
          >
            <LogOut
              size={16}
            />

            Logout
          </button>

        </div>

      </aside>

      {/* Mobile Nav */}

      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 h-16 ${bg} border-t flex items-center justify-around z-50 px-2`}
      >
        {mobileLinks.map(
          (link) => {
            const Icon =
              link.icon

            const active =
              pathname ===
                link.path ||
              pathname.startsWith(
                link.path +
                  '/'
              )

            return (
              <Link
                key={
                  link.path
                }
                to={
                  link.path
                }
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg ${
                  active
                    ? 'text-emerald-400'
                    : textMuted
                }`}
              >
                <Icon
                  size={20}
                />

                <span className="text-[9px]">
                  {link.name.split(
                    ' '
                  )[0]}
                </span>
              </Link>
            )
          }
        )}
      </nav>
    </>
  )
}