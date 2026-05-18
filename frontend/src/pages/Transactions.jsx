import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
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

export default function Transactions() {
  const { dark } = useTheme()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch] = useState('')

  const bg = dark ? 'bg-[#111111]' : 'bg-gray-50'
  const card = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textMuted = dark ? 'text-gray-500' : 'text-gray-400'
  const inputBg = dark ? 'bg-[#111] border-[#2a2a2a] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
  const tooltipStyle = dark
    ? { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }
    : { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses/')
      setExpenses(res.data)
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
    window.addEventListener('focus', fetchExpenses)
    return () => window.removeEventListener('focus', fetchExpenses)
  }, [])

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      fetchExpenses()
    } catch (err) {
      console.log(err)
    }
  }

  // Sort by most recent first
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date))

  const filtered = sorted.filter(e =>
    (categoryFilter === 'All' || e.category === categoryFilter) &&
    e.title.toLowerCase().includes(search.toLowerCase())
  )

  // Pie chart data
  const byCategory = {}
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }))
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Group by date
  const groupedByDate = {}
  filtered.forEach(e => {
    const dateKey = e.date
      ? new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Unknown date'
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
    groupedByDate[dateKey].push(e)
  })

  if (loading) return (
    <div className={`flex ${bg} min-h-screen`}>
      <Navbar />
      <main className="md:ml-56 flex-1 flex items-center justify-center">
        <p className={textMuted}>Loading transactions...</p>
      </main>
    </div>
  )

  return (
    <div className={`flex ${bg} min-h-screen ${textPrimary}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* Topbar */}
        <div className={`${topbar} border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10`}>
          <div>
            <h1 className={`text-base font-semibold ${textPrimary}`}>Transactions</h1>
            <p className={`text-xs ${textMuted} mt-0.5`}>{expenses.length} total · sorted by recent</p>
          </div>
          <button
            onClick={fetchExpenses}
            className={`text-xs border ${dark ? 'border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:bg-gray-100'} px-3 py-1.5 rounded-lg transition-colors`}
          >
            ↻ Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Pie Chart + Summary */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Pie Chart */}
            <div className={`${card} border rounded-2xl p-5`}>
              <p className={`text-sm font-semibold ${textPrimary} mb-4`}>Spending by Category</p>
              {pieData.length === 0 ? (
                <div className={`h-48 flex items-center justify-center ${textMuted} text-sm`}>No data yet</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString('en-IN')}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {pieData.sort((a, b) => b.value - a.value).map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] || '#6b7280' }} />
                          <span className={`text-xs ${textMuted}`}>{d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium ${textPrimary}`}>₹{d.value.toLocaleString('en-IN')}</span>
                          <span className={`text-[10px] ${textMuted} ml-1`}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className={`${card} border rounded-2xl p-5 space-y-4`}>
              <p className={`text-sm font-semibold ${textPrimary}`}>Summary</p>
              <div className="space-y-3">
                <div className={`flex justify-between py-2 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                  <span className={`text-sm ${textMuted}`}>Total Spent</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div className={`flex justify-between py-2 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                  <span className={`text-sm ${textMuted}`}>Transactions</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>{expenses.length}</span>
                </div>
                <div className={`flex justify-between py-2 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                  <span className={`text-sm ${textMuted}`}>Average</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>₹{expenses.length > 0 ? Math.round(total / expenses.length).toLocaleString('en-IN') : 0}</span>
                </div>
                <div className={`flex justify-between py-2 border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                  <span className={`text-sm ${textMuted}`}>Highest</span>
                  <span className={`text-sm font-semibold ${textPrimary}`}>
                    ₹{expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)).toLocaleString('en-IN') : 0}
                  </span>
                </div>
                <div className={`flex justify-between py-2`}>
                  <span className={`text-sm ${textMuted}`}>Top Category</span>
                  <span className={`text-sm font-semibold text-emerald-400`}>
                    {pieData.length > 0 ? pieData.sort((a, b) => b.value - a.value)[0].name : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className={`${card} border rounded-2xl p-4 flex flex-wrap items-center gap-3`}>
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`text-xs ${inputBg} border rounded-lg px-3 py-2 flex-1 min-w-40 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
            />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className={`text-xs ${inputBg} border rounded-lg px-3 py-2 focus:outline-none`}
            >
              {['All','Food','Transport','Shopping','Bills','Health','Entertainment','Education','Other'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className={`text-xs ${textMuted}`}>{filtered.length} results</span>
          </div>

          {/* Transactions grouped by date */}
          <div className={`${card} border rounded-2xl overflow-hidden`}>
            {filtered.length === 0 ? (
              <div className={`text-center py-16 ${textMuted} text-sm`}>
                No transactions found
              </div>
            ) : (
              Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date}>
                  {/* Date header */}
                  <div className={`px-5 py-2.5 ${dark ? 'bg-[#111] border-b border-[#2a2a2a]' : 'bg-gray-50 border-b border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${textMuted}`}>{date}</span>
                      <span className={`text-xs ${textMuted}`}>
                        ₹{items.reduce((s, e) => s + e.amount, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Transactions for that date */}
                  {items.map((exp, i) => (
                    <div
                      key={exp.id}
                      className={`flex items-center gap-3 px-5 py-3.5 ${
                        i < items.length - 1 ? `border-b ${dark ? 'border-[#2a2a2a]' : 'border-gray-100'}` : ''
                      } hover:${dark ? 'bg-[#111]' : 'bg-gray-50'} transition-colors`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: (CATEGORY_COLORS[exp.category] || '#6b7280') + '22' }}
                      >
                        {CATEGORY_ICONS[exp.category] || '💳'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${textPrimary} truncate`}>{exp.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: (CATEGORY_COLORS[exp.category] || '#6b7280') + '22', color: CATEGORY_COLORS[exp.category] || '#6b7280' }}
                          >
                            {exp.category}
                          </span>
                          {exp.payment_method && (
                            <span className={`text-[10px] ${textMuted}`}>{exp.payment_method}</span>
                          )}
                          {exp.is_recurring && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400">🔄 Recurring</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold ${textPrimary}`}>-₹{exp.amount.toLocaleString('en-IN')}</p>
                      </div>
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        className={`${textMuted} hover:text-red-400 transition-colors flex-shrink-0 ml-1`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}