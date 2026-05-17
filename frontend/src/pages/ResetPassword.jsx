import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Wallet, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/axios'

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One number', pass: /\d/.test(password) },
  ]
  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      {checks.map((check, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {check.pass
            ? <CheckCircle size={11} className="text-emerald-500" />
            : <XCircle size={11} className="text-gray-600" />
          }
          <span className={`text-[11px] ${check.pass ? 'text-emerald-400' : 'text-gray-600'}`}>{check.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const isValid = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      setError('Invalid reset link. Please request a new one.')
      return
    }
    if (!isValid) {
      setError('Please meet all password requirements.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-md p-8 rounded-2xl">

        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Wallet className="text-white" size={17} />
          </div>
          <span className="text-base font-bold text-white">SpendWise AI</span>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-900/30 border border-emerald-800/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Password reset!</h2>
            <p className="text-sm text-gray-500 mb-4">Your password has been updated successfully.</p>
            <p className="text-xs text-gray-600">Redirecting to login in 3 seconds...</p>
            <Link to="/login" className="text-emerald-500 hover:text-emerald-400 text-sm mt-4 inline-block">
              Go to login →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
            <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>

            {!token && (
              <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                ⚠️ Invalid reset link. Please{' '}
                <Link to="/forgot-password" className="underline">request a new one</Link>.
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={!token}
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
                <PasswordStrength password={password} />
              </div>

              <button
                type="submit"
                disabled={loading || !isValid || !token}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 disabled:text-emerald-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <Link to="/login" className="flex items-center justify-center text-sm text-gray-600 hover:text-gray-400 mt-6 transition-colors">
              ← Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}