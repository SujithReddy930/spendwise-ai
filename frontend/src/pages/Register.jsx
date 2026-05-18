import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One number', pass: /\d/.test(password) },
  ]

  const passed = checks.filter(c => c.pass).length
  const strength = passed === 0 ? null : passed === 1 ? 'weak' : passed === 2 ? 'medium' : 'strong'

  const barColor = { weak: 'bg-red-500', medium: 'bg-amber-500', strong: 'bg-emerald-500' }
  const barWidth = { weak: 'w-1/3', medium: 'w-2/3', strong: 'w-full' }

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${strength ? barColor[strength] : ''} ${strength ? barWidth[strength] : 'w-0'}`} />
      </div>
      <div className="space-y-1">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {check.pass
              ? <CheckCircle size={11} className="text-emerald-500 flex-shrink-0" />
              : <XCircle size={11} className="text-gray-600 flex-shrink-0" />
            }
            <span className={`text-[11px] ${check.pass ? 'text-emerald-400' : 'text-gray-600'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isPasswordValid = form.password.length >= 8 && /[A-Z]/.test(form.password) && /\d/.test(form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isPasswordValid) {
      setError('Please meet all password requirements before continuing.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/register', form)
      login(res.data.user, res.data.access_token)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'Email already registered') {
        setError('⚠️ This email is already registered. Please sign in instead.')
      } else {
        setError(detail || 'Registration failed. Please try again.')
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

        <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
        <p className="text-sm text-gray-500 mb-6">Start tracking your expenses with AI</p>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {error.includes('already registered') && (
                <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium underline text-xs mt-1 block">
                  → Click here to sign in
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              placeholder="Ravi Kumar"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value })
                if (error) setError('')
              }}
              className={`w-full bg-[#111] border text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600 ${
                error.includes('already registered') ? 'border-red-700' : 'border-[#2a2a2a]'
              }`}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 disabled:text-emerald-700 text-white font-medium py-3 rounded-xl text-sm transition-colors mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}