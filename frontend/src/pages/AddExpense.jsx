import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { PlusCircle, Sparkles, RefreshCw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Education', 'Other']
const PAYMENT_METHODS = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking']

export default function AddExpense() {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const [form, setForm] = useState({
    title: '', amount: '', category: 'Food',
    payment_method: 'UPI',
    date: new Date().toISOString().split('T')[0],
    note: '', is_recurring: false
  })
  const [message, setMessage] = useState('')
  const [aiCategory, setAiCategory] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const bg = dark ? 'bg-[#111111]' : 'bg-gray-50'
  const card = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textMuted = dark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = dark
    ? 'bg-[#111] border-[#2a2a2a] text-white placeholder-gray-600'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'

  const handleTitleChange = async (value) => {
    setForm(prev => ({ ...prev, title: value }))
    setAiCategory('')
    if (value.length > 3) {
      setAiLoading(true)
      try {
        const res = await fetch('http://localhost:8001/ai/categorize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: value })
        })
        const data = await res.json()
        if (data.confidence > 60) {
          setForm(prev => ({ ...prev, title: value, category: data.category }))
          setAiCategory(`${data.category} · ${data.confidence}% confident`)
        }
      } catch (e) {} finally { setAiLoading(false) }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/expenses', { ...form, amount: parseFloat(form.amount) })
      setMessage('success')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) { setMessage('error') }
  }

  return (
    <div className={`flex ${bg} min-h-screen ${textPrimary}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">
        <div className={`${topbar} border-b px-6 py-4`}>
          <h1 className={`text-base font-semibold ${textPrimary}`}>Add Expense</h1>
          <p className={`text-xs ${textMuted} mt-0.5`}>AI will auto-suggest the category as you type</p>
        </div>

        <div className="p-6 max-w-xl">
          {message === 'success' && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 text-sm">
              ✅ Expense added! Redirecting...
            </div>
          )}
          {message === 'error' && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-800/40 text-red-400 text-sm">
              ❌ Failed to add expense.
            </div>
          )}

          <form onSubmit={handleSubmit} className={`${card} border rounded-2xl p-6 space-y-5`}>

            {/* Title */}
            <div>
              <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Title</label>
              <input
                type="text" required value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. Domino's Pizza, Ola Cab..."
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
              />
              {aiLoading && <p className={`text-xs ${textMuted} mt-1.5`}>🤖 AI thinking...</p>}
              {aiCategory && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <Sparkles size={11} /> AI suggested: {aiCategory}
                </p>
              )}
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Amount (₹)</label>
                <input
                  type="number" required min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Date</label>
                <input
                  type="date" required value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                />
              </div>
            </div>

            {/* Category + Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>
                  Category {aiCategory && <span className="text-emerald-500">✨ AI filled</span>}
                </label>
                <select
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Payment Method</label>
                <select
                  value={form.payment_method}
                  onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 ${inputCls}`}
                >
                  {PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className={`block text-xs font-medium ${textMuted} mb-1.5`}>Note (optional)</label>
              <textarea
                value={form.note}
                onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Any additional details..."
                rows={2}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none ${inputCls}`}
              />
            </div>

            {/* 🔄 Recurring toggle */}
            <div
              onClick={() => setForm(prev => ({ ...prev, is_recurring: !prev.is_recurring }))}
              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                form.is_recurring
                  ? 'border-blue-700/60 bg-blue-900/20'
                  : dark ? 'border-[#2a2a2a] hover:border-blue-800/40' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw size={16} className={form.is_recurring ? 'text-blue-400' : textMuted} />
                <div>
                  <p className={`text-sm font-medium ${form.is_recurring ? 'text-blue-400' : textPrimary}`}>Recurring expense</p>
                  <p className={`text-xs ${textMuted}`}>Auto-adds this expense every month</p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-all ${form.is_recurring ? 'bg-blue-500' : dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-all ${form.is_recurring ? 'ml-5' : 'ml-0.5'}`} />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <PlusCircle size={16} /> Add Expense
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}