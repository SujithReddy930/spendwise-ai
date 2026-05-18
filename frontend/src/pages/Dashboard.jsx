import { Trash2, PlusCircle, Download, FileText, Bell, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CSVLink } from 'react-csv'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { useTheme } from '../context/ThemeContext'

const CATEGORY_COLORS = {
  Food: '#10b981', Transport: '#3b82f6', Shopping: '#ec4899',
  Bills: '#f59e0b', Health: '#ef4444', Entertainment: '#8b5cf6',
  Education: '#06b6d4', Other: '#6b7280',
}

const CATEGORY_ICONS = {
  Food: '🍕', Transport: '🚗', Shopping: '🛍️',
  Bills: '⚡', Health: '💊', Entertainment: '🎬',
  Education: '📚', Other: '💳',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Dashboard() {
  const { dark } = useTheme()
  const now = new Date()

  // ── Selected month/year ──
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  // ── Data ──
  const [expenses, setExpenses] = useState([])
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [budget, setBudget] = useState(() => Number(localStorage.getItem('budget')) || 30000)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const monthLabel = `${MONTH_NAMES[selMonth - 1]} ${selYear}`
  const isCurrentMonth = selMonth === now.getMonth() + 1 && selYear === now.getFullYear()

  // ── Theme helpers ──
  const bg = dark ? 'bg-[#111111]' : 'bg-gray-50'
  const card = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textMuted = dark ? 'text-gray-500' : 'text-gray-400'
  const inputBg = dark ? 'bg-[#111] border-[#2a2a2a] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
  const borderColor = dark ? 'border-[#2a2a2a]' : 'border-gray-200'
  const hoverBg = dark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-100'
  const tooltipStyle = dark
    ? { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }
    : { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }

  // ── Fetchers ──
  const fetchExpenses = useCallback(async () => {
    try {
      const res = await api.get('/expenses/')
      setExpenses(res.data)
    } catch (err) { console.log(err) }
  }, [])

  const fetchAI = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const [insRes, predRes] = await Promise.all([
        api.get(`/expenses/insights?month=${selMonth}&year=${selYear}`),
        api.get(`/expenses/prediction?month=${selMonth}&year=${selYear}`),
      ])
      setInsights(insRes.data.insights || [])
      setPrediction(predRes.data)
    } catch {
      setInsights(['Could not load insights. Please try again.'])
      setPrediction(null)
    } finally {
      setInsightsLoading(false)
    }
  }, [selMonth, selYear])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])
  useEffect(() => { fetchAI() }, [fetchAI])

  useEffect(() => {
    window.addEventListener('focus', fetchExpenses)
    return () => window.removeEventListener('focus', fetchExpenses)
  }, [fetchExpenses])

  useEffect(() => { localStorage.setItem('budget', budget) }, [budget])

  // ── Month navigation ──
  const prevMonth = () => {
    setAlertDismissed(false)
    if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1) }
    else setSelMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (isCurrentMonth) return
    setAlertDismissed(false)
    if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1) }
    else setSelMonth(m => m + 1)
  }

  const selectFromPicker = (m) => {
    const future = pickerYear > now.getFullYear() ||
      (pickerYear === now.getFullYear() && m > now.getMonth() + 1)
    if (future) return
    setSelMonth(m)
    setSelYear(pickerYear)
    setShowPicker(false)
    setAlertDismissed(false)
  }

  // ── Delete ──
  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return
    try { await api.delete(`/expenses/${id}`); fetchExpenses() }
    catch (err) { console.log(err) }
  }

  // ── Export PDF ──
  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('SpendWise — Expense Report', 14, 20)
    doc.setFontSize(11); doc.setTextColor(100)
    doc.text(`${monthLabel} · Total: ₹${totalExpenses.toLocaleString('en-IN')}`, 14, 30)
    autoTable(doc, {
      startY: 38,
      head: [['Title', 'Category', 'Amount (₹)', 'Date']],
      body: filteredExpenses.map(e => [
        e.title, e.category,
        e.amount.toLocaleString('en-IN'),
        e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—',
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [16, 185, 129] },
    })
    doc.save(`SpendWise-${monthLabel.replace(' ', '-')}.pdf`)
  }

  // ── Derived data ──
  const monthExpenses = expenses.filter(e => {
    if (!e.date) return true
    const d = new Date(e.date)
    return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear
  })

  const filteredExpenses = monthExpenses.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) &&
    (categoryFilter === 'All' || e.category === categoryFilter)
  )

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const remainingBudget = budget - totalExpenses
  const spendingPct = budget > 0 ? (totalExpenses / budget) * 100 : 0
  const alertLevel = spendingPct >= 100 ? 'over' : spendingPct >= 80 ? 'warning' : null

  const byCategory = {}
  filteredExpenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount })
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  const byDate = {}
  filteredExpenses.forEach(e => {
    const day = e.date ? new Date(e.date).getDate() : new Date().getDate()
    byDate[day] = (byDate[day] || 0) + e.amount
  })
  const lineData = Object.entries(byDate)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([day, total]) => ({ day, total }))

  const categoryBudgets = { Food: 8000, Transport: 5000, Shopping: 6000, Bills: 5000, Other: 6000 }

  return (
    <div className={`flex ${bg} min-h-screen ${textPrimary}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* ── Top Bar ── */}
        <div className={`${topbar} border-b ${borderColor} px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20`}>
          <div>
            <h1 className={`text-base font-semibold ${textPrimary}`}>Dashboard</h1>
            <p className={`text-xs ${textMuted} mt-0.5`}>{monthLabel} · AI analysis ready</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* Month picker */}
            <div className="relative">
              <div className={`flex items-center border ${borderColor} rounded-lg overflow-hidden`}>
                <button onClick={prevMonth} className={`px-2 py-1.5 ${textMuted} ${hoverBg} transition-colors`}>
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => { setShowPicker(v => !v); setPickerYear(selYear) }}
                  className={`text-xs px-2 py-1.5 font-medium ${textMuted} ${hoverBg} transition-colors whitespace-nowrap`}
                >
                  📅 {monthLabel}
                </button>
                <button
                  onClick={nextMonth}
                  disabled={isCurrentMonth}
                  className={`px-2 py-1.5 transition-colors ${isCurrentMonth ? 'opacity-30 cursor-not-allowed' : `${textMuted} ${hoverBg}`}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {showPicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
                  <div className={`absolute top-full left-0 mt-1 z-40 w-60 ${dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setPickerYear(y => y - 1)} className={`p-1.5 rounded-lg ${textMuted} ${hoverBg}`}>
                        <ChevronLeft size={14} />
                      </button>
                      <span className={`text-sm font-semibold ${textPrimary}`}>{pickerYear}</span>
                      <button
                        onClick={() => { if (pickerYear < now.getFullYear()) setPickerYear(y => y + 1) }}
                        disabled={pickerYear >= now.getFullYear()}
                        className={`p-1.5 rounded-lg transition-colors ${pickerYear >= now.getFullYear() ? 'opacity-30 cursor-not-allowed' : `${textMuted} ${hoverBg}`}`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {MONTH_NAMES.map((name, idx) => {
                        const m = idx + 1
                        const future = pickerYear > now.getFullYear() ||
                          (pickerYear === now.getFullYear() && m > now.getMonth() + 1)
                        const selected = m === selMonth && pickerYear === selYear
                        return (
                          <button
                            key={name}
                            disabled={future}
                            onClick={() => selectFromPicker(m)}
                            className={`text-xs py-2 rounded-lg font-medium transition-colors ${
                              future ? 'opacity-25 cursor-not-allowed'
                              : selected ? 'bg-emerald-500 text-white'
                              : `${textMuted} ${hoverBg}`
                            }`}
                          >
                            {name.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <CSVLink
              data={filteredExpenses}
              filename={`spendwise-${monthLabel.replace(' ', '-')}.csv`}
              className={`text-xs border ${borderColor} ${textMuted} ${hoverBg} px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1`}
            >
              <Download size={13} /> CSV
            </CSVLink>

            <button onClick={exportPDF} className={`text-xs border ${borderColor} ${textMuted} ${hoverBg} px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1`}>
              <FileText size={13} /> PDF
            </button>

            <button
              onClick={() => { fetchExpenses(); fetchAI() }}
              className={`text-xs border ${borderColor} ${textMuted} ${hoverBg} px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1`}
            >
              <RefreshCw size={13} /> Refresh
            </button>

            <Link to="/add" className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <PlusCircle size={13} /> Add Expense
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">

          {/* Budget Alert */}
          {alertLevel && !alertDismissed && (
            <div className={`rounded-2xl p-4 flex items-start gap-3 border ${alertLevel === 'over' ? 'bg-red-900/20 border-red-800/40' : 'bg-amber-900/20 border-amber-800/40'}`}>
              <Bell size={16} className={`mt-0.5 flex-shrink-0 ${alertLevel === 'over' ? 'text-red-400' : 'text-amber-400'}`} />
              <div className="flex-1">
                <p className={`text-xs font-semibold mb-0.5 ${alertLevel === 'over' ? 'text-red-400' : 'text-amber-400'}`}>
                  {alertLevel === 'over' ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning'}
                </p>
                <p className={`text-sm ${alertLevel === 'over' ? 'text-red-300/80' : 'text-amber-300/80'}`}>
                  {alertLevel === 'over'
                    ? `You've spent ₹${totalExpenses.toLocaleString('en-IN')} — ₹${Math.abs(remainingBudget).toLocaleString('en-IN')} over your ₹${budget.toLocaleString('en-IN')} budget.`
                    : `You've used ${spendingPct.toFixed(0)}% of your ₹${budget.toLocaleString('en-IN')} budget. ₹${remainingBudget.toLocaleString('en-IN')} remaining.`}
                </p>
              </div>
              <button onClick={() => setAlertDismissed(true)} className={`${textMuted} text-xs flex-shrink-0`}>✕</button>
            </div>
          )}

          {/* AI Insights */}
          <div className={`rounded-2xl p-4 border ${dark ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✨</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold mb-1.5 ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  AI Insight · {monthLabel}
                </p>
                {insightsLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className={`text-sm ${dark ? 'text-emerald-300/70' : 'text-emerald-600'}`}>Generating insights…</span>
                  </div>
                ) : insights.length > 0 ? (
                  <div className="space-y-1.5">
                    {insights.slice(0, 2).map((tip, i) => (
                      <p key={i} className={`text-sm ${dark ? 'text-emerald-300/80' : 'text-emerald-700'}`}>{tip}</p>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${dark ? 'text-emerald-300/60' : 'text-emerald-600'}`}>
                    Add expenses to see personalised AI insights.
                  </p>
                )}
              </div>
              <button
                onClick={fetchAI}
                disabled={insightsLoading}
                className={`text-xs border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50 ${
                  dark ? 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/40' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Total Spent', value: `₹${totalExpenses.toLocaleString('en-IN')}`, sub: `${spendingPct.toFixed(0)}% of budget`, subColor: spendingPct > 80 ? 'text-red-400' : textMuted },
              { label: 'Budget Left', value: `₹${Math.abs(remainingBudget).toLocaleString('en-IN')}`, valueColor: remainingBudget < 0 ? 'text-red-400' : 'text-emerald-400', sub: remainingBudget < 0 ? '⚠️ Over budget' : `${MONTH_NAMES[selMonth - 1]} budget`, subColor: textMuted },
              { label: 'Transactions', value: filteredExpenses.length, sub: 'This month', subColor: textMuted },
              { label: 'AI Predicted', value: prediction && !prediction.error ? `₹${prediction.predicted_total?.toLocaleString('en-IN')}` : '—', sub: prediction?.confidence ? `${prediction.confidence} confidence` : 'Month-end forecast', subColor: textMuted },
            ].map((c, i) => (
              <div key={i} className={`${card} border rounded-2xl p-4`}>
                <p className={`text-xs ${textMuted} mb-2`}>{c.label}</p>
                <p className={`text-2xl font-bold ${c.valueColor || textPrimary}`}>{c.value}</p>
                <p className={`text-xs mt-1 ${c.subColor}`}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Spending over time</p>
                <span className={`text-xs px-2 py-1 rounded-full ${dark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                  {MONTH_NAMES[selMonth - 1].slice(0, 3)} {selYear}
                </span>
              </div>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={lineData}>
                    <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Spent']} />
                    <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`h-[180px] flex items-center justify-center ${textMuted} text-sm`}>No data for {monthLabel}</div>
              )}
            </div>

            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Category breakdown</p>
                <span className={`text-xs px-2 py-1 rounded-full ${dark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>✨ AI-categorized</span>
              </div>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString('en-IN')}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 grid grid-cols-2 gap-1.5">
                    {pieData.map(d => (
                      <div key={d.name} className={`flex items-center gap-1.5 ${dark ? 'bg-[#111]' : 'bg-gray-50'} rounded-lg px-2 py-1.5`}>
                        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] || '#6b7280' }} />
                        <span className={`text-[10px] ${textMuted} flex-1 truncate`}>{d.name}</span>
                        <span className={`text-[10px] font-medium ${textPrimary}`}>
                          {totalExpenses > 0 ? Math.round(d.value / totalExpenses * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`h-[130px] flex items-center justify-center ${textMuted} text-sm`}>No data for {monthLabel}</div>
              )}
            </div>
          </div>

          {/* Transactions + Budget */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Recent transactions</p>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                    className={`text-xs ${inputBg} border rounded-lg px-3 py-1.5 w-24 focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className={`text-xs ${inputBg} border rounded-lg px-2 py-1.5 focus:outline-none`}>
                    {['All', 'Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Education', 'Other'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredExpenses.length === 0 ? (
                  <div className={`text-center py-10 ${textMuted} text-sm`}>
                    No expenses for {monthLabel}.{' '}
                    <Link to="/add" className="text-emerald-500 hover:underline">Add one →</Link>
                  </div>
                ) : filteredExpenses.slice(0, 10).map(exp => (
                  <div key={exp.id} className={`flex items-center gap-3 py-2.5 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'} last:border-0`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: (CATEGORY_COLORS[exp.category] || '#6b7280') + '22' }}>
                      {CATEGORY_ICONS[exp.category] || '💳'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${textPrimary} truncate`}>{exp.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: (CATEGORY_COLORS[exp.category] || '#6b7280') + '22', color: CATEGORY_COLORS[exp.category] || '#6b7280' }}>
                          {exp.category}
                        </span>
                        {exp.date && <span className={`text-[10px] ${textMuted}`}>{new Date(exp.date).toLocaleDateString('en-IN')}</span>}
                        {exp.is_recurring && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400">🔄</span>}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${textPrimary} flex-shrink-0`}>-₹{exp.amount.toLocaleString('en-IN')}</span>
                    <button onClick={() => deleteExpense(exp.id)} className={`${textMuted} hover:text-red-400 transition-colors flex-shrink-0`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Budget tracker</p>
                <span className={`text-xs px-2 py-1 rounded-full ${dark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>{monthLabel}</span>
              </div>
              <div className="mb-4">
                <label className={`text-xs ${textMuted} mb-1 block`}>Monthly budget (₹)</label>
                <input type="number" value={budget}
                  onChange={e => { setBudget(Number(e.target.value)); setAlertDismissed(false) }}
                  className={`text-sm ${inputBg} border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
              </div>
              <div className="space-y-3 mb-4">
                {pieData.length > 0 ? pieData.sort((a, b) => b.value - a.value).slice(0, 5).map(({ name, value }) => {
                  const catBudget = categoryBudgets[name] || budget / 5
                  const pct = Math.min((value / catBudget) * 100, 100)
                  const over = value > catBudget
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={textMuted}>{name}</span>
                        <span className={over ? 'text-red-400' : textMuted}>{Math.round(pct)}%</span>
                      </div>
                      <div className={`h-1.5 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: over ? '#ef4444' : CATEGORY_COLORS[name] || '#10b981' }} />
                      </div>
                    </div>
                  )
                }) : <p className={`text-xs ${textMuted} text-center py-4`}>Add expenses to see budget breakdown</p>}
              </div>
              <div className={`border-t ${borderColor} pt-3`}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className={textMuted}>Overall budget</span>
                  <span className={spendingPct > 100 ? 'text-red-400' : textMuted}>{spendingPct.toFixed(0)}%</span>
                </div>
                <div className={`h-2 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(spendingPct, 100)}%`, background: spendingPct > 100 ? '#ef4444' : '#10b981' }} />
                </div>
                {prediction && !prediction.error && (
                  <p className={`mt-3 text-xs text-center ${textMuted}`}>
                    🔮 AI predicts ₹{prediction.predicted_total?.toLocaleString('en-IN')} by month end
                    · <span className="text-emerald-400 capitalize">{prediction.confidence}</span> confidence
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}