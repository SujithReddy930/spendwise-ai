import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, ArrowLeft, Mail } from 'lucide-react'
import api from '../api/axios'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
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

        {!sent ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Forgot password?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and we'll send you a reset link.
            </p>

            {error && (
              <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 disabled:text-emerald-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          // Success state
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-900/30 border border-emerald-800/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-2">
              If <span className="text-white">{email}</span> is registered, a reset link has been sent.
            </p>
            <p className="text-xs text-gray-600 mb-6">
              The link expires in 30 minutes. Check your spam folder if you don't see it.
            </p>
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3 mb-6 text-left">
              <p className="text-xs text-amber-400 font-medium mb-1">💡 Development mode</p>
              <p className="text-xs text-amber-400/70">If SMTP is not configured, the reset link is printed in your backend terminal.</p>
            </div>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Send to a different email
            </button>
          </div>
        )}

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-400 mt-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  )
}