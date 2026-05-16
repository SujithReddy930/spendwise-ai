import { Trash2, PlusCircle, Download, FileText, Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
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

export default function Dashboard() {
  const { dark } = useTheme()
  const [expenses, setExpenses] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [budget, setBudget] = useState(() => Number(localStorage.getItem('budget')) || 30000)
  const [insights, setInsights] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [alertDismissed, setAlertDismissed] = useState(false)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  // Theme classes
  const bg = dark ? 'bg-[#111111]' : 'bg-gray-50'
  const card = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textMuted = dark ? 'text-gray-500' : 'text-gray-400'
  const inputBg = dark ? 'bg-[#111] border-[#2a2a2a] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
  const tooltipStyle = dark
    ? { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }
    : { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }

  useEffect(() => { fetchExpenses(); fetchAI() }, [])
  useEffect(() => { localStorage.setItem('budget', budget) }, [budget])

  const fetchExpenses = async () => {
    try { const res = await api.get('/expenses'); setExpenses(res.data) } catch (err) { console.log(err) }
  }

  const fetchAI = async () => {
    try {
      const [insRes, predRes] = await Promise.all([
        api.get(`/expenses/insights?month=${month}&year=${year}`),
        api.get(`/expenses/prediction?month=${month}&year=${year}`)
      ])
      setInsights(insRes.data.insights || [])
      setPrediction(predRes.data)
    } catch (e) { console.log('AI not available') }
  }

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return
    try { await api.delete(`/expenses/${id}`); fetchExpenses() } catch (err) { console.log(err) }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('SpendWise — Expense Report', 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`${monthName} · Total: Rs.${totalExpenses.toLocaleString('en-IN')}`, 14, 30)
    autoTable(doc, {
      startY: 38,
      head: [['Title', 'Category', 'Amount (Rs.)', 'Date']],
      body: filteredExpenses.map(e => [
        e.title, e.category,
        e.amount.toLocaleString('en-IN'),
        e.date || '—'
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [16, 185, 129] },
    })
    doc.save(`SpendWise-${monthName.replace(' ', '-')}.pdf`)
  }

  const filteredExpenses = expenses.filter(e => {
    return e.title.toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === 'All' || e.category === categoryFilter)
  })

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const remainingBudget = budget - totalExpenses
  const spendingPct = budget > 0 ? (totalExpenses / budget) * 100 : 0

  const byCategory = {}
  filteredExpenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount })
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  const byDate = {}
  filteredExpenses.forEach(e => {
    const day = e.date ? new Date(e.date).getDate() : new Date(e.created_at || Date.now()).getDate()
    byDate[day] = (byDate[day] || 0) + e.amount
  })
  const lineData = Object.entries(byDate).sort((a, b) => Number(a[0]) - Number(b[0])).map(([day, total]) => ({ day, total }))

  const categoryBudgets = { Food: 8000, Transport: 5000, Shopping: 6000, Bills: 5000, Other: 6000 }

  // Alert level
  const alertLevel = spendingPct >= 100 ? 'over' : spendingPct >= 80 ? 'warning' : null

  return (
    <div className={`flex ${bg} min-h-screen ${textPrimary}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* Topbar */}
        <div className={`${topbar} border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10`}>
          <div>
            <h1 className={`text-base font-semibold ${textPrimary}`}>Dashboard</h1>
            <p className={`text-xs ${textMuted} mt-0.5`}>{monthName} · AI analysis ready</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs border ${dark ? 'border-[#2a2a2a] text-gray-400' : 'border-gray-200 text-gray-500'} px-3 py-1.5 rounded-lg`}>
              📅 {monthName}
            </span>
            <CSVLink
              data={filteredExpenses}
              filename="expenses.csv"
              className={`text-xs border ${dark ? 'border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:bg-gray-100'} px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1`}
            >
              <Download size={13} /> CSV
            </CSVLink>
            <button
              onClick={exportPDF}
              className={`text-xs border ${dark ? 'border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:bg-gray-100'} px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1`}
            >
              <FileText size={13} /> PDF
            </button>
            <Link to="/add" className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <PlusCircle size={13} /> Add Expense
            </Link>
          </div>
        </div>

        <div className="p-6">

          {/* 🔔 Budget Alert Banner */}
          {alertLevel && !alertDismissed && (
            <div className={`rounded-2xl p-4 mb-6 flex items-start gap-3 ${
              alertLevel === 'over'
                ? 'bg-red-900/20 border border-red-800/40'
                : 'bg-amber-900/20 border border-amber-800/40'
            }`}>
              <Bell size={16} className={alertLevel === 'over' ? 'text-red-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
              <div className="flex-1">
                <p className={`text-xs font-semibold mb-0.5 ${alertLevel === 'over' ? 'text-red-400' : 'text-amber-400'}`}>
                  {alertLevel === 'over' ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning'}
                </p>
                <p className={`text-sm ${alertLevel === 'over' ? 'text-red-300/80' : 'text-amber-300/80'}`}>
                  {alertLevel === 'over'
                    ? `You've spent ₹${totalExpenses.toLocaleString('en-IN')} — ₹${Math.abs(remainingBudget).toLocaleString('en-IN')} over your ₹${budget.toLocaleString('en-IN')} budget.`
                    : `You've used ${spendingPct.toFixed(0)}% of your ₹${budget.toLocaleString('en-IN')} budget. ₹${remainingBudget.toLocaleString('en-IN')} remaining.`
                  }
                </p>
              </div>
              <button onClick={() => setAlertDismissed(true)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
            </div>
          )}

          {/* AI Insight Banner */}
          {insights.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✨</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-400 mb-1">AI Insight · {now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                {insights.slice(0, 2).map((tip, i) => <p key={i} className="text-sm text-emerald-300/80">{tip}</p>)}
              </div>
              <button onClick={fetchAI} className="text-xs text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-900/40 transition-colors flex-shrink-0">
                Refresh ↗
              </button>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Spent', value: `₹${totalExpenses.toLocaleString('en-IN')}`, sub: `${spendingPct.toFixed(0)}% of budget`, subColor: spendingPct > 80 ? 'text-red-400' : textMuted },
              { label: 'Budget Left', value: `₹${Math.abs(remainingBudget).toLocaleString('en-IN')}`, valueColor: remainingBudget < 0 ? 'text-red-400' : 'text-emerald-400', sub: remainingBudget < 0 ? '⚠️ Over budget' : `${monthName.split(' ')[0]} budget`, subColor: textMuted },
              { label: 'Transactions', value: filteredExpenses.length, sub: 'Total count', subColor: textMuted },
              { label: 'AI Predicted', value: prediction && !prediction.error ? `₹${prediction.predicted_total?.toLocaleString('en-IN')}` : '—', sub: 'Month-end forecast', subColor: textMuted },
            ].map((c, i) => (
              <div key={i} className={`${card} border rounded-2xl p-4`}>
                <p className={`text-xs ${textMuted} mb-2`}>{c.label}</p>
                <p className={`text-2xl font-bold ${c.valueColor || textPrimary}`}>{c.value}</p>
                <p className={`text-xs mt-1 ${c.subColor}`}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            {['Overview', 'Monthly', 'Categories', 'Trends'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === tab ? 'bg-emerald-500 text-white' : `border ${dark ? 'border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Spending over time</p>
                <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded-full">{monthName.split(' ')[0]} 1–{now.getDate()}</span>
              </div>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={lineData}>
                    <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Spent']} />
                    <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className={`h-[180px] flex items-center justify-center ${textMuted} text-sm`}>No data yet</div>}
            </div>

            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Category breakdown</p>
                <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full">✨ AI-categorized</span>
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
                        <span className={`text-[10px] font-medium ${textPrimary}`}>{totalExpenses > 0 ? Math.round(d.value / totalExpenses * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className={`h-[130px] flex items-center justify-center ${textMuted} text-sm`}>No data yet</div>}
            </div>
          </div>

          {/* Transactions + Budget */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Recent transactions</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={`text-xs ${inputBg} border rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                  />
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className={`text-xs ${inputBg} border rounded-lg px-2 py-1.5 focus:outline-none`}
                  >
                    {['All','Food','Transport','Shopping','Bills','Health','Entertainment','Education','Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredExpenses.length === 0 ? (
                  <div className={`text-center py-10 ${textMuted} text-sm`}>
                    No expenses yet. <Link to="/add" className="text-emerald-500 hover:underline">Add one →</Link>
                  </div>
                ) : filteredExpenses.slice(0, 10).map(exp => (
                  <div key={exp.id} className={`flex items-center gap-3 py-2.5 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'} last:border-0`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-emerald-900/40 text-emerald-400">
                      {exp.category === 'Food' ? '🍕' : exp.category === 'Transport' ? '🚗' : exp.category === 'Shopping' ? '🛍️' : exp.category === 'Bills' ? '⚡' : exp.category === 'Health' ? '💊' : '💳'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${textPrimary} truncate`}>{exp.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-400">{exp.category}</span>
                        {exp.date && <span className={`text-[10px] ${textMuted}`}>{exp.date}</span>}
                        {exp.is_recurring && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400">🔄 Recurring</span>}
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

            {/* Budget Tracker */}
            <div className={`${card} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-sm font-semibold ${textPrimary}`}>Budget tracker</p>
                <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded-full">{monthName}</span>
              </div>
              <div className="mb-4">
                <label className={`text-xs ${textMuted} mb-1 block`}>Monthly budget (₹)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={e => { setBudget(Number(e.target.value)); setAlertDismissed(false) }}
                  className={`text-sm ${inputBg} border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
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
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#ef4444' : CATEGORY_COLORS[name] || '#10b981' }} />
                      </div>
                    </div>
                  )
                }) : <p className={`text-xs ${textMuted} text-center py-4`}>Add expenses to see budget breakdown</p>}
              </div>
              <div className={`border-t ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'} pt-3`}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className={textMuted}>Overall budget</span>
                  <span className={spendingPct > 100 ? 'text-red-400' : textMuted}>{spendingPct.toFixed(0)}%</span>
                </div>
                <div className={`h-2 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(spendingPct, 100)}%`, background: spendingPct > 100 ? '#ef4444' : '#10b981' }} />
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