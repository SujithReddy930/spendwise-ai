import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockCountdown, setLockCountdown] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const countdownRef = useRef(null)

  // Countdown timer when account is locked
  useEffect(() => {
    if (lockCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setLockCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current)
            setIsLocked(false)
            setError('')
            setAttemptsLeft(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(countdownRef.current)
  }, [lockCountdown])

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const checkLockStatus = async (email) => {
    try {
      const res = await api.get(`/auth/check-lock/${encodeURIComponent(email)}`)
      if (res.data.locked) {
        setIsLocked(true)
        setLockCountdown(res.data.remaining_seconds)
      }
    } catch (e) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setLoading(true)
    setError('')
    setAttemptsLeft(null)

    try {
      const res = await api.post('/auth/login', form)
      login(res.data.user, res.data.access_token)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed'
      const status = err.response?.status

      if (status === 423) {
        // Account locked
        setIsLocked(true)
        setError(detail)
        await checkLockStatus(form.email)
      } else {
        // Extract attempts left from message
        const match = detail.match(/(\d+) attempt/)
        if (match) setAttemptsLeft(parseInt(match[1]))
        setError(detail)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-md p-8 rounded-2xl">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Wallet className="text-white" size={17} />
          </div>
          <span className="text-base font-bold text-white">SpendWise AI</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

        {/* Lock warning */}
        {isLocked && (
          <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <Lock size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-400 font-medium">Account temporarily locked</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                Too many failed attempts. Try again in{' '}
                <span className="font-mono font-bold text-red-300">{formatCountdown(lockCountdown)}</span>
              </p>
            </div>
          </div>
        )}

        {/* Attempts warning */}
        {!isLocked && attemptsLeft !== null && (
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-400">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before your account is locked for 15 minutes.
            </p>
          </div>
        )}

        {/* General error */}
        {error && !isLocked && attemptsLeft === null && (
          <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              disabled={isLocked}
              className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600 disabled:opacity-40"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">Password</label>
              <Link to="/forgot-password" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                disabled={isLocked}
                className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600 disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 disabled:text-emerald-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Signing in...' : isLocked ? `Locked — ${formatCountdown(lockCountdown)}` : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}