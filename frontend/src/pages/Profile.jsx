import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'
import { User, Mail, Bell, Send, CheckCircle } from 'lucide-react'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { dark } = useTheme()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [email] = useState(user?.email || '')
  const [reportEmail, setReportEmail] = useState(user?.email || '')
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  const bg = dark ? 'bg-[#111111]' : 'bg-gray-50'
  const card = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textMuted = dark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = dark
    ? 'bg-[#111] border-[#2a2a2a] text-white placeholder-gray-600'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'

  const saveProfile = () => {
    updateUser({ name })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sendEmailReport = async () => {
    setSending(true)
    setEmailError('')
    try {
      await api.post('/expenses/send-report', { email: reportEmail })
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 4000)
    } catch (err) {
      setEmailError('Failed to send. Make sure email is configured in the backend.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`flex ${bg} min-h-screen ${textPrimary}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">
        <div className={`${topbar} border-b px-6 py-4`}>
          <h1 className={`text-base font-semibold ${textPrimary}`}>Profile & Settings</h1>
          <p className={`text-xs ${textMuted} mt-0.5`}>Manage your account and preferences</p>
        </div>

        <div className="p-6 max-w-2xl space-y-5">

          {/* Avatar + Name */}
          <div className={`${card} border rounded-2xl p-6`}>
            <h2 className={`text-sm font-semibold ${textPrimary} mb-5`}>Personal Info</h2>

            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-900 flex items-center justify-center text-2xl font-bold text-emerald-400">
                {name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className={`font-semibold ${textPrimary}`}>{name || 'User'}</p>
                <p className={`text-sm ${textMuted}`}>{email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Display Name</label>
                <div className="relative">
                  <User size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className={`w-full border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Email</label>
                <div className="relative">
                  <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={`w-full border rounded-xl pl-9 pr-4 py-3 text-sm opacity-50 cursor-not-allowed ${inputCls}`}
                  />
                </div>
                <p className={`text-xs ${textMuted} mt-1`}>Email cannot be changed</p>
              </div>

              <button
                onClick={saveProfile}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {saved ? <><CheckCircle size={15} /> Saved!</> : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Email Report */}
          <div className={`${card} border rounded-2xl p-6`}>
            <h2 className={`text-sm font-semibold ${textPrimary} mb-1`}>📧 Email Spending Report</h2>
            <p className={`text-xs ${textMuted} mb-5`}>Get a summary of your monthly spending delivered to your inbox</p>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Send report to</label>
                <div className="relative">
                  <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                  <input
                    type="email"
                    value={reportEmail}
                    onChange={e => setReportEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={`w-full border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                  />
                </div>
              </div>

              {emailError && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 px-3 py-2 rounded-lg">{emailError}</p>
              )}
              {emailSent && (
                <p className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 px-3 py-2 rounded-lg flex items-center gap-1">
                  <CheckCircle size={12} /> Report sent to {reportEmail}!
                </p>
              )}

              <button
                onClick={sendEmailReport}
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900/40 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Send size={15} />
                {sending ? 'Sending report...' : 'Send Monthly Report'}
              </button>
            </div>
          </div>

          {/* Budget + Notifications info */}
          <div className={`${card} border rounded-2xl p-6`}>
            <h2 className={`text-sm font-semibold ${textPrimary} mb-1`}>
              <Bell size={14} className="inline mr-2" />Budget Alerts
            </h2>
            <p className={`text-xs ${textMuted} mb-4`}>Alerts are shown automatically on the dashboard when you reach budget thresholds</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2.5 border-b border-[#2a2a2a]">
                <span className={`text-sm ${textMuted}`}>80% budget warning</span>
                <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded-full">⚠️ Active</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className={`text-sm ${textMuted}`}>100% budget exceeded alert</span>
                <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded-full">🚨 Active</span>
              </div>
            </div>
            <p className={`text-xs ${textMuted} mt-3`}>
              Set your monthly budget on the <span className="text-emerald-400 cursor-pointer" onClick={() => navigate('/dashboard')}>Dashboard →</span>
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}