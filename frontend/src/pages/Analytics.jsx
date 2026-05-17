import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import Navbar from '../components/Navbar'
import api from '../api/axios'

const COLORS = ['#10b981','#3b82f6','#ec4899','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#6b7280']

export default function Analytics() {
  const [expenses, setExpenses] = useState([])
  const [insights, setInsights] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const fetchAll = async () => {
    try {
      const [expRes, insRes, predRes] = await Promise.all([
        api.get('/expenses/'),
        api.get(`/expenses/insights?month=${month}&year=${year}`),
        api.get(`/expenses/prediction?month=${month}&year=${year}`)
      ])
      setExpenses(expRes.data)
      setInsights(insRes.data.insights || [])
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

  const categoryData = Object.values(
    expenses.reduce((acc, e) => {
      if (!acc[e.category]) acc[e.category] = { name: e.category, value: 0 }
      acc[e.category].value += e.amount
      return acc
    }, {})
  ).sort((a, b) => b.value - a.value)

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const avgPerTx = expenses.length > 0 ? totalExpenses / expenses.length : 0
  const topCategory = categoryData.length > 0 ? categoryData[0].name : 'N/A'

  const byDate = {}
  expenses.forEach(e => {
    const day = e.date || new Date().toISOString().split('T')[0]
    byDate[day] = (byDate[day] || 0) + e.amount
  })
  const lineData = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, total]) => ({ date: date.slice(0, 10).slice(5), total }))

  if (loading) return (
    <div className="flex bg-[#111111] min-h-screen">
      <Navbar />
      <main className="md:ml-56 flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading analytics...</p>
      </main>
    </div>
  )

  return (
    <div className="flex bg-[#111111] min-h-screen text-white">
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Smart Insights</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered analysis of your spending patterns</p>
          </div>
          <button onClick={fetchAll} className="text-xs border border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors">
            ↻ Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Total Spent', value: `₹${totalExpenses.toLocaleString('en-IN')}` },
              { label: 'Transactions', value: expenses.length },
              { label: 'Avg per Transaction', value: `₹${avgPerTx.toFixed(0)}` },
              { label: 'Top Category', value: topCategory, color: 'text-emerald-400' },
            ].map((c, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color || 'text-white'}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {insights.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-emerald-400 mb-3">✨ AI Insights</h2>
              <div className="space-y-2.5">
                {insights.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">→</span>
                    <p className="text-sm text-emerald-300/80">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Category Breakdown</h2>
              {categoryData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={v => [`₹${v.toLocaleString('en-IN')}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categoryData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        {d.name} · ₹{d.value.toLocaleString('en-IN')}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Spending by Category</h2>
              {categoryData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Spent']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Spending Trend (Last 14 days)</h2>
            {lineData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={lineData}>
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Spent']} />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">📊 Financial Summary</h2>
            <div className="space-y-3">
              {[
                { label: 'Highest spending category', value: topCategory, color: 'text-emerald-400' },
                { label: 'Total tracked expenses', value: `₹${totalExpenses.toLocaleString('en-IN')}`, color: 'text-white' },
                { label: 'Average per transaction', value: `₹${avgPerTx.toFixed(2)}`, color: 'text-white' },
                { label: 'Total transactions', value: `${expenses.length}`, color: 'text-white' },
                { label: 'Financial health', value: totalExpenses < 5000 ? 'Excellent 🟢' : totalExpenses < 15000 ? 'Moderate 🟡' : 'High Spending 🔴', color: totalExpenses < 5000 ? 'text-emerald-400' : totalExpenses < 15000 ? 'text-amber-400' : 'text-red-400' },
                { label: 'AI Recommendation', value: categoryData.length > 0 ? `Reduce ${topCategory} expenses to improve savings` : 'Add expenses for personalized insights', color: 'text-blue-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
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