import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts'
import Navbar from '../components/Navbar'
import api from '../api/axios'

export default function Predictions() {
  const [expenses, setExpenses] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  const fetchAll = async () => {
    try {
      const [expRes, predRes] = await Promise.all([
        api.get('/expenses/'),
        api.get(`/expenses/prediction?month=${month}&year=${year}`)
      ])
      setExpenses(expRes.data)
      setPrediction(predRes.data)
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    window.addEventListener('focus', fetchAll)
    return () => window.removeEventListener('focus', fetchAll)
  }, [])

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0
  const projectedTotal = dailyAvg * daysInMonth
  const projectedRemaining = projectedTotal - totalSpent

  // Build spending data by day
  const byDay = {}
  expenses.forEach(e => {
    const d = e.date ? new Date(e.date).getDate() : now.getDate()
    byDay[d] = (byDay[d] || 0) + e.amount
  })

  // Cumulative actual spending
  let cumulative = 0
  const chartData = []
  for (let d = 1; d <= daysInMonth; d++) {
    if (d <= daysElapsed) {
      cumulative += byDay[d] || 0
      chartData.push({
        day: d,
        actual: Math.round(cumulative),
        projected: Math.round(dailyAvg * d),
      })
    } else {
      chartData.push({
        day: d,
        projected: Math.round(dailyAvg * d),
      })
    }
  }

  // Weekly breakdown
  const weeks = [
    { label: 'Week 1', days: [1,7] },
    { label: 'Week 2', days: [8,14] },
    { label: 'Week 3', days: [15,21] },
    { label: 'Week 4', days: [22, daysInMonth] },
  ]
  const weeklyData = weeks.map(w => {
    const total = expenses
      .filter(e => {
        const d = e.date ? new Date(e.date).getDate() : 0
        return d >= w.days[0] && d <= w.days[1]
      })
      .reduce((s, e) => s + e.amount, 0)
    return { week: w.label, spent: Math.round(total), projected: Math.round(dailyAvg * 7) }
  })

  const confidenceColor = prediction?.confidence === 'high' ? 'text-emerald-400' :
    prediction?.confidence === 'medium' ? 'text-amber-400' : 'text-red-400'

  const confidenceBg = prediction?.confidence === 'high' ? 'bg-emerald-900/20 border-emerald-800/40' :
    prediction?.confidence === 'medium' ? 'bg-amber-900/20 border-amber-800/40' : 'bg-red-900/20 border-red-800/40'

  if (loading) return (
    <div className="flex bg-[#111111] min-h-screen">
      <Navbar />
      <main className="md:ml-56 flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading predictions...</p>
      </main>
    </div>
  )

  return (
    <div className="flex bg-[#111111] min-h-screen text-white">
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* Topbar */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Predictions</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered month-end forecast · {monthName}</p>
          </div>
          <button onClick={fetchAll} className="text-xs border border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors">
            ↻ Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Prediction Banner */}
          <div className={`rounded-2xl p-5 border ${prediction && !prediction.error ? confidenceBg : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">🔮 Predicted Month-End Total</p>
                <p className="text-4xl font-bold text-white mb-2">
                  ₹{prediction && !prediction.error
                    ? prediction.predicted_total?.toLocaleString('en-IN')
                    : projectedTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">
                  Based on ₹{dailyAvg.toFixed(0)}/day average · {daysRemaining} days remaining
                </p>
              </div>
              {prediction && !prediction.error && (
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Confidence</p>
                  <p className={`text-sm font-semibold capitalize ${confidenceColor}`}>
                    {prediction.confidence} ●
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Spent So Far', value: `₹${totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, sub: `Day ${daysElapsed} of ${daysInMonth}`, color: 'text-white' },
              { label: 'Daily Average', value: `₹${dailyAvg.toFixed(0)}`, sub: 'Per day this month', color: 'text-blue-400' },
              { label: 'Projected Remaining', value: `₹${projectedRemaining.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, sub: `Next ${daysRemaining} days`, color: 'text-amber-400' },
              { label: 'Month Progress', value: `${Math.round((daysElapsed / daysInMonth) * 100)}%`, sub: `${daysElapsed}/${daysInMonth} days`, color: 'text-emerald-400' },
            ].map((c, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-2">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-600 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Forecast Chart */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Spending Forecast</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                  <span className="text-xs text-gray-500">Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-blue-500 rounded border-dashed" style={{ borderTop: '2px dashed #3b82f6', background: 'none' }} />
                  <span className="text-xs text-gray-500">Projected</span>
                </div>
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Day of Month', position: 'insideBottom', offset: -2, fill: '#4b5563', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [`₹${v?.toLocaleString('en-IN')}`, name === 'actual' ? 'Actual' : 'Projected']}
                    labelFormatter={l => `Day ${l}`}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} fill="url(#actualGrad)" dot={false} connectNulls />
                  <Area type="monotone" dataKey="projected" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" fill="url(#projectedGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Weekly Breakdown */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Weekly Breakdown</h2>
            <div className="space-y-4">
              {weeklyData.map((w, i) => {
                const pct = w.projected > 0 ? Math.min((w.spent / w.projected) * 100, 100) : 0
                const over = w.spent > w.projected
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-400">{w.week}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${over ? 'text-red-400' : 'text-gray-400'}`}>
                          ₹{w.spent.toLocaleString('en-IN')} / ₹{w.projected.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-medium ${over ? 'text-red-400' : 'text-emerald-400'}`}>
                          {over ? '↑ Over' : `${Math.round(pct)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: over ? '#ef4444' : '#10b981' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Savings Opportunity */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">💡 Savings Opportunities</h2>
            <div className="space-y-3">
              {[
                {
                  label: 'If you reduce daily spend by 10%',
                  value: `Save ₹${(dailyAvg * 0.1 * daysRemaining).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                  color: 'text-emerald-400'
                },
                {
                  label: 'If you reduce daily spend by 20%',
                  value: `Save ₹${(dailyAvg * 0.2 * daysRemaining).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                  color: 'text-emerald-400'
                },
                {
                  label: 'Projected month-end total',
                  value: `₹${projectedTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                  color: 'text-white'
                },
                {
                  label: 'Days remaining this month',
                  value: `${daysRemaining} days`,
                  color: 'text-blue-400'
                },
                {
                  label: 'Spending pace',
                  value: dailyAvg > 1000 ? 'High 🔴' : dailyAvg > 500 ? 'Moderate 🟡' : 'Low 🟢',
                  color: dailyAvg > 1000 ? 'text-red-400' : dailyAvg > 500 ? 'text-amber-400' : 'text-emerald-400'
                },
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between py-2.5 border-b border-[#2a2a2a] last:border-0`}>
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}