import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell
} from 'recharts'
import Navbar from '../components/Navbar'
import api from '../api/axios'

// ─── helpers ────────────────────────────────────────────────────────────────
const inr = (v, dec = 0) =>
  v == null || isNaN(v)
    ? '—'
    : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: dec })}`

const safeNum = (v, fallback = 0) =>
  v != null && !isNaN(Number(v)) ? Number(v) : fallback

// ─── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = 'text-white', icon }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {icon && <span>{icon}</span>}{label}
      </p>
      <p className={`text-lg sm:text-xl font-bold truncate ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">Day {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name === 'actual' ? 'Actual' : 'Projected'}: {inr(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function Predictions() {
  const [expenses, setExpenses]   = useState([])
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // date math
  const now          = new Date()
  const month        = now.getMonth() + 1
  const year         = now.getFullYear()
  const daysInMonth  = new Date(year, month, 0).getDate()
  const daysElapsed  = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed
  const monthName    = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [expRes, predRes] = await Promise.all([
        api.get('/expenses/'),
        api.get(`/expenses/prediction?month=${month}&year=${year}`)
      ])
      setExpenses(Array.isArray(expRes.data) ? expRes.data : [])
      setPrediction(predRes.data ?? null)
    } catch (err) {
      console.error('Predictions fetch error:', err)
      setError('Could not load prediction data. Showing local estimates.')
      // still try to load expenses alone so charts render
      try {
        const expRes = await api.get('/expenses/')
        setExpenses(Array.isArray(expRes.data) ? expRes.data : [])
      } catch (_) { /* ignore */ }
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    fetchAll()
    window.addEventListener('focus', fetchAll)
    return () => window.removeEventListener('focus', fetchAll)
  }, [fetchAll])

  // ── derived numbers ──────────────────────────────────────────────────────
  const totalSpent = expenses.reduce((s, e) => s + safeNum(e.amount), 0)
  const dailyAvg   = daysElapsed > 0 ? totalSpent / daysElapsed : 0

  // Prefer API prediction; fall back to linear projection
  const apiPredTotal = safeNum(
    prediction?.predicted_total ??   // field your API returns
    prediction?.predictedTotal ??    // camelCase variant
    prediction?.amount ??            // possible other variant
    prediction?.total,               // another possible variant
    null
  )
  const predictedTotal    = apiPredTotal ?? dailyAvg * daysInMonth
  const projectedRemaining = predictedTotal - totalSpent

  const confidence     = prediction?.confidence ?? null
  const hasApiPrediction = apiPredTotal != null && !prediction?.error

  // ── chart data ───────────────────────────────────────────────────────────
  const byDay = {}
  expenses.forEach(e => {
    const d = e.date ? new Date(e.date).getDate() : now.getDate()
    byDay[d] = (byDay[d] || 0) + safeNum(e.amount)
  })

  let cumulative = 0
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    if (d <= daysElapsed) {
      cumulative += byDay[d] || 0
      return { day: d, actual: Math.round(cumulative), projected: Math.round(dailyAvg * d) }
    }
    return { day: d, projected: Math.round(dailyAvg * d) }
  })

  // ── weekly data ──────────────────────────────────────────────────────────
  const weekBounds = [
    { label: 'Wk 1', days: [1, 7] },
    { label: 'Wk 2', days: [8, 14] },
    { label: 'Wk 3', days: [15, 21] },
    { label: 'Wk 4', days: [22, daysInMonth] },
  ]
  const weeklyData = weekBounds.map(w => {
    const spent = expenses
      .filter(e => {
        const d = e.date ? new Date(e.date).getDate() : 0
        return d >= w.days[0] && d <= w.days[1]
      })
      .reduce((s, e) => s + safeNum(e.amount), 0)
    const budget = Math.round(dailyAvg * 7)
    const pct    = budget > 0 ? Math.min((spent / budget) * 100, 150) : 0
    return { week: w.label, spent: Math.round(spent), budget, pct, over: spent > budget }
  })

  // ── confidence styling ───────────────────────────────────────────────────
  const confStyle = {
    high:   { text: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/40', dot: '#10b981' },
    medium: { text: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-800/40',     dot: '#f59e0b' },
    low:    { text: 'text-red-400',     bg: 'bg-red-900/20 border-red-800/40',         dot: '#ef4444' },
  }
  const cs = confStyle[confidence] ?? { text: 'text-gray-400', bg: 'bg-[#1a1a1a] border-[#2a2a2a]', dot: '#6b7280' }

  const paceLabel = dailyAvg > 1000 ? ['High 🔴', 'text-red-400'] :
                    dailyAvg > 500  ? ['Moderate 🟡', 'text-amber-400'] :
                                      ['Low 🟢', 'text-emerald-400']

  // ── loading / error states ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex bg-[#111111] min-h-screen">
      <Navbar />
      <main className="md:ml-56 flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading predictions…</p>
        </div>
      </main>
    </div>
  )

  return (
    <div className="flex bg-[#111111] min-h-screen text-white">
      <Navbar />

      <main className="md:ml-56 flex-1 pb-24 md:pb-6">

        {/* ── Top bar ── */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-sm sm:text-base font-semibold text-white">Predictions</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered forecast · {monthName}</p>
          </div>
          <button
            onClick={fetchAll}
            className="text-xs border border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors active:scale-95"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">

          {/* ── Error banner ── */}
          {error && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-400">
              ⚠️ {error}
            </div>
          )}

          {/* ── Prediction hero ── */}
          <div className={`rounded-2xl p-5 border ${cs.bg}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1">🔮 Predicted Month-End Total</p>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-2 truncate">
                  {inr(predictedTotal)}
                </p>
                <p className="text-xs text-gray-500">
                  {inr(dailyAvg, 0)}/day avg · {daysRemaining} days left ·{' '}
                  {hasApiPrediction ? 'AI prediction' : 'linear estimate'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <p className={`text-sm font-semibold capitalize ${cs.text}`}>
                  {confidence ?? '—'} {confidence && '●'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard icon="💸" label="Spent So Far"       value={inr(totalSpent)}           sub={`Day ${daysElapsed} of ${daysInMonth}`}    accent="text-white" />
            <StatCard icon="📅" label="Daily Average"      value={inr(dailyAvg, 0)}           sub="Per day this month"                         accent="text-blue-400" />
            <StatCard icon="🔭" label="Still to Project"   value={inr(projectedRemaining)}    sub={`Over next ${daysRemaining} days`}          accent="text-amber-400" />
            <StatCard icon="📈" label="Month Progress"     value={`${Math.round((daysElapsed / daysInMonth) * 100)}%`} sub={`${daysElapsed}/${daysInMonth} days`} accent="text-emerald-400" />
          </div>

          {/* ── Forecast chart ── */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-semibold text-white">Spending Forecast</h2>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Actual
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-0.5 inline-block" style={{ background: 'repeating-linear-gradient(90deg,#3b82f6 0,#3b82f6 3px,transparent 3px,transparent 6px)' }} /> Projected
                </span>
              </div>
            </div>
            {totalSpent === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-600 text-sm">No expense data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 16 }}>
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Day of Month', position: 'insideBottom', offset: -8, fill: '#4b5563', fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false} tickLine={false} width={48}
                    tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="actual"    name="actual"    stroke="#10b981" strokeWidth={2} fill="url(#aGrad)" dot={false} connectNulls />
                  <Area type="monotone" dataKey="projected" name="projected" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" fill="url(#pGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Weekly breakdown ── */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Weekly Breakdown</h2>
            {totalSpent === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">No data yet</p>
            ) : (
              <>
                {/* bar chart on larger screens */}
                <div className="hidden sm:block mb-4">
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={weeklyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                        formatter={v => inr(v)}
                      />
                      <Bar dataKey="spent" name="Spent" radius={[4, 4, 0, 0]}>
                        {weeklyData.map((w, i) => (
                          <Cell key={i} fill={w.over ? '#ef4444' : '#10b981'} />
                        ))}
                      </Bar>
                      <Bar dataKey="budget" name="Budget" radius={[4, 4, 0, 0]} fill="#2a2a2a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* progress bars always visible */}
                <div className="space-y-3.5">
                  {weeklyData.map((w, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-400">{w.week}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${w.over ? 'text-red-400' : 'text-gray-400'}`}>
                            {inr(w.spent)} / {inr(w.budget)}
                          </span>
                          <span className={`text-xs font-medium ${w.over ? 'text-red-400' : 'text-emerald-400'}`}>
                            {w.over ? '↑ Over' : `${Math.round(w.pct)}%`}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${w.pct}%`, background: w.over ? '#ef4444' : '#10b981' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Savings opportunities ── */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">💡 Savings Opportunities</h2>
            <div className="space-y-0 divide-y divide-[#2a2a2a]">
              {[
                { label: 'Spending pace',            value: paceLabel[0],                                          accent: paceLabel[1] },
                { label: 'Save with −10% daily',     value: inr(dailyAvg * 0.1 * daysRemaining),                  accent: 'text-emerald-400' },
                { label: 'Save with −20% daily',     value: inr(dailyAvg * 0.2 * daysRemaining),                  accent: 'text-emerald-400' },
                { label: 'Projected month-end',      value: inr(predictedTotal),                                   accent: 'text-white' },
                { label: 'Days remaining',           value: `${daysRemaining} days`,                               accent: 'text-blue-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <span className="text-xs sm:text-sm text-gray-500">{item.label}</span>
                  <span className={`text-xs sm:text-sm font-medium ${item.accent}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}