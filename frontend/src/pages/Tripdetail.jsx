/**
 * TripDetail.jsx — Individual trip page
 * Full analytics, expense management, PDF/CSV export, real-time alerts
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, X, Download, FileText,
  RefreshCw, Edit2, Check, AlertTriangle, Wallet, TrendingUp, Calendar,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CSVLink } from 'react-csv'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { useTheme } from '../context/ThemeContext'

const CATEGORIES = ['Food', 'Travel', 'Hotel', 'Shopping', 'Fuel', 'Entertainment', 'Other']

const CAT_COLORS = {
  Food:          '#10b981',
  Travel:        '#3b82f6',
  Hotel:         '#8b5cf6',
  Shopping:      '#ec4899',
  Fuel:          '#f59e0b',
  Entertainment: '#ef4444',
  Other:         '#6b7280',
}

const CAT_ICONS = {
  Food: '🍕', Travel: '✈️', Hotel: '🏨', Shopping: '🛍️',
  Fuel: '⛽', Entertainment: '🎬', Other: '💳',
}

const formatINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

export default function TripDetail() {
  const { dark } = useTheme()
  const { id } = useParams()
  const navigate = useNavigate()

  const [trip, setTrip]         = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const prevAlertRef = useRef(null)

  // Expense form
  const [showAdd, setShowAdd]   = useState(false)
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [expForm, setExpForm]   = useState({ title: '', amount: '', category: 'Other', notes: '', date: '' })
  const [expErrors, setExpErrors] = useState({})

  // ── Theme ──
  const bg      = dark ? 'bg-[#0d0d0d]'          : 'bg-gray-50'
  const card    = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar  = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const tp      = dark ? 'text-white'             : 'text-gray-900'
  const tm      = dark ? 'text-gray-400'          : 'text-gray-500'
  const inputBg = dark ? 'bg-[#111] border-[#333] text-gray-200 placeholder-gray-600'
                       : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
  const modalBg = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const border  = dark ? 'border-[#2a2a2a]'      : 'border-gray-200'
  const hov     = dark ? 'hover:bg-[#252525]'    : 'hover:bg-gray-50'
  const tooltip = dark
    ? { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 11 }
    : { background: '#fff',    border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    try {
      const [tripRes, analyticsRes] = await Promise.all([
        api.get(`/trips/${id}`),
        api.get(`/trips/${id}/analytics`),
      ])
      setTrip(tripRes.data)
      setAnalytics(analyticsRes.data)

      // Auto-show alert toast when level changes
      const newLevel = analyticsRes.data.alert?.level
      if (newLevel && newLevel !== prevAlertRef.current) {
        prevAlertRef.current = newLevel
        setDismissed(false)
        const msgs = {
          '80':      '⚠️ 80% of trip budget used!',
          '90':      '🔴 90% of trip budget used — spend carefully!',
          exceeded:  '🚨 Trip budget exceeded!',
        }
        showToast(msgs[newLevel] || '', newLevel === 'exceeded' ? 'error' : 'warning')
      }
    } catch { showToast('Failed to load trip data', 'error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Expense form validation ──
  const validateExp = () => {
    const errs = {}
    if (!expForm.title.trim()) errs.title = 'Title required'
    if (!expForm.amount || Number(expForm.amount) <= 0) errs.amount = 'Enter valid amount'
    if (!expForm.date) errs.date = 'Date required'
    setExpErrors(errs)
    return Object.keys(errs).length === 0
  }

  const resetExpForm = () => {
    setExpForm({ title: '', amount: '', category: 'Other', notes: '', date: '' })
    setExpErrors({})
    setEditId(null)
  }

  // ── Add expense ──
  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!validateExp()) return
    setAdding(true)
    try {
      const payload = {
        ...expForm,
        amount: Number(expForm.amount),
        date: new Date(expForm.date).toISOString(),
      }
      if (editId) {
        await api.put(`/trips/${id}/expenses/${editId}`, payload)
        showToast('Expense updated ✓')
      } else {
        await api.post(`/trips/${id}/expenses`, payload)
        showToast('Expense added ✓')
      }
      setShowAdd(false)
      resetExpForm()
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to save expense', 'error')
    } finally { setAdding(false) }
  }

  const startEdit = (exp) => {
    setExpForm({
      title:    exp.title,
      amount:   String(exp.amount),
      category: exp.category,
      notes:    exp.notes || '',
      date:     exp.date ? exp.date.slice(0, 10) : '',
    })
    setEditId(exp.id)
    setShowAdd(true)
  }

  const handleDeleteExpense = async (expId) => {
    try {
      await api.delete(`/trips/${id}/expenses/${expId}`)
      setDeleteId(null)
      fetchAll()
      showToast('Expense deleted')
    } catch { showToast('Failed to delete', 'error') }
  }

  // ── PDF Export ──
  const exportPDF = () => {
    if (!trip || !analytics) return
    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.setTextColor(16, 185, 129)
    doc.text('SpendWise — Trip Report', 14, 20)
    doc.setFontSize(11); doc.setTextColor(80)
    doc.text(`${trip.name} · ${trip.destination}`, 14, 30)
    doc.text(`Budget: ₹${analytics.budget_limit.toLocaleString('en-IN')}  ·  Spent: ₹${analytics.total_spent.toLocaleString('en-IN')}  ·  Remaining: ₹${analytics.remaining.toLocaleString('en-IN')}`, 14, 38)

    autoTable(doc, {
      startY: 46,
      head: [['Title', 'Category', 'Amount (₹)', 'Date', 'Notes']],
      body: (trip.expenses || []).map(e => [
        e.title, e.category,
        e.amount.toLocaleString('en-IN'),
        e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—',
        e.notes || '—',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    })

    doc.save(`SpendWise-Trip-${trip.name.replace(/\s+/g, '-')}.pdf`)
  }

  // ── Alert banner ──
  const alertConfig = {
    exceeded: { bg: 'bg-red-900/20 border-red-800/40', text: 'text-red-400',    icon: '🚨' },
    '90':     { bg: 'bg-orange-900/20 border-orange-800/40', text: 'text-orange-400', icon: '🔴' },
    '80':     { bg: 'bg-amber-900/20 border-amber-800/40',   text: 'text-amber-400',  icon: '⚠️' },
  }

  if (loading) {
    return (
      <div className={`flex ${bg} min-h-screen ${tp}`}>
        <Navbar />
        <main className="md:ml-56 flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-sm ${tm}`}>Loading trip…</p>
          </div>
        </main>
      </div>
    )
  }

  const alertLevel = analytics?.alert?.level
  const expenses   = trip?.expenses || []
  const dailyData  = analytics?.daily_timeline?.map(d => ({ ...d, date: formatDate(d.date) })) || []

  return (
    <div className={`flex ${bg} min-h-screen ${tp}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-24 md:pb-0">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium
            ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'} text-white`}>
            {toast.msg}
          </div>
        )}

        {/* ── Delete Confirm ── */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`${modalBg} border rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
              <p className={`font-semibold ${tp} mb-2`}>Delete this expense?</p>
              <p className={`text-sm ${tm} mb-5`}>This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className={`flex-1 border ${border} ${tm} py-2.5 rounded-xl text-sm ${hov} transition-colors`}>Cancel</button>
                <button onClick={() => handleDeleteExpense(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add/Edit Expense Modal ── */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={`${modalBg} border rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl`}>
              <div className={`flex items-center justify-between p-5 border-b ${border} sticky top-0 bg-inherit z-10`}>
                <p className={`font-semibold ${tp}`}>{editId ? 'Edit Expense' : 'Add Expense'}</p>
                <button onClick={() => { setShowAdd(false); resetExpForm() }} className={`${tm} hover:text-red-400 transition-colors`}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddExpense} className="p-5 space-y-4">
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Title *</label>
                  <input value={expForm.title} onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Dinner at Shack" className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`} />
                  {expErrors.title && <p className="text-red-400 text-xs mt-1">{expErrors.title}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Amount (₹) *</label>
                    <input type="number" min="1" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="500" className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`} />
                    {expErrors.amount && <p className="text-red-400 text-xs mt-1">{expErrors.amount}</p>}
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Date *</label>
                    <input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))}
                      className={`w-full text-sm ${inputBg} border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`} />
                    {expErrors.date && <p className="text-red-400 text-xs mt-1">{expErrors.date}</p>}
                  </div>
                </div>

                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Category</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CATEGORIES.map(cat => (
                      <button type="button" key={cat} onClick={() => setExpForm(f => ({ ...f, category: cat }))}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-medium border transition-all ${
                          expForm.category === cat
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : `${border} ${tm} ${hov}`
                        }`}>
                        <span>{CAT_ICONS[cat]}</span>
                        <span>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Notes (optional)</label>
                  <input value={expForm.notes} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes…" className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`} />
                </div>

                <button type="submit" disabled={adding}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  {adding
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                    : <><Check size={16} /> {editId ? 'Update' : 'Add Expense'}</>
                  }
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Top Bar ── */}
        <div className={`${topbar} border-b px-4 md:px-6 py-4 flex items-center gap-3 sticky top-0 z-20`}>
          <button onClick={() => navigate('/trips')} className={`${tm} hover:${tp} transition-colors`}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`text-base font-semibold ${tp} truncate`}>{trip?.name}</h1>
            <p className={`text-xs ${tm}`}>{trip?.destination}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CSVLink
              data={expenses}
              filename={`trip-${trip?.name?.replace(/\s+/g, '-')}.csv`}
              className={`text-xs border ${border} ${tm} ${hov} px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors`}
            >
              <Download size={12} /> CSV
            </CSVLink>
            <button onClick={exportPDF} className={`text-xs border ${border} ${tm} ${hov} px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors`}>
              <FileText size={12} /> PDF
            </button>
            <button onClick={fetchAll} className={`text-xs border ${border} ${tm} ${hov} px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors`}>
              <RefreshCw size={12} />
            </button>
            <button onClick={() => setShowAdd(true)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5">

          {/* ── Budget Alert Banner ── */}
          {alertLevel && !dismissed && (
            <div className={`rounded-2xl p-4 border flex items-start gap-3 ${alertConfig[alertLevel].bg}`}>
              <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${alertConfig[alertLevel].text}`} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${alertConfig[alertLevel].text}`}>
                  {analytics.alert.message}
                </p>
              </div>
              <button onClick={() => setDismissed(true)} className={`${tm} text-xs flex-shrink-0`}>✕</button>
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Budget',   value: formatINR(analytics?.budget_limit),  color: 'text-blue-400',    icon: '💼' },
              { label: 'Total Spent',    value: formatINR(analytics?.total_spent),   color: 'text-rose-400',    icon: '💸' },
              { label: 'Remaining',      value: formatINR(analytics?.remaining),     color: analytics?.remaining < 0 ? 'text-red-400' : 'text-emerald-400', icon: '✅' },
              { label: 'Daily Average',  value: formatINR(analytics?.daily_average), color: 'text-amber-400',   icon: '📅' },
            ].map(c => (
              <div key={c.label} className={`${card} border rounded-2xl p-4`}>
                <p className={`text-xs ${tm} mb-2`}>{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                <p className="text-base mt-1">{c.icon}</p>
              </div>
            ))}
          </div>

          {/* ── Budget Progress ── */}
          <div className={`${card} border rounded-2xl p-5`}>
            <div className="flex justify-between items-center mb-3">
              <p className={`text-sm font-semibold ${tp}`}>Budget Progress</p>
              <span className={`text-sm font-bold ${alertLevel === 'exceeded' ? 'text-red-400' : alertLevel === '90' ? 'text-orange-400' : alertLevel === '80' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {analytics?.percentage_used}%
              </span>
            </div>
            <div className={`h-3 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  alertLevel === 'exceeded' ? 'bg-red-500'
                  : alertLevel === '90' ? 'bg-orange-500'
                  : alertLevel === '80' ? 'bg-amber-500'
                  : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(analytics?.percentage_used || 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className={tm}>{formatINR(analytics?.total_spent)} spent</span>
              <span className={tm}>{formatINR(analytics?.remaining)} left</span>
            </div>
            {analytics?.projected_total > analytics?.budget_limit && (
              <p className="text-xs text-amber-400 mt-2">
                🔮 At this rate, projected total: {formatINR(analytics?.projected_total)} — {formatINR(analytics?.projected_total - analytics?.budget_limit)} over budget
              </p>
            )}
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Daily Timeline */}
            <div className={`${card} border rounded-2xl p-5`}>
              <p className={`text-sm font-semibold ${tp} mb-4`}>Daily Spending</p>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="tripGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={dark ? '#1f1f1f' : '#f3f4f6'} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} />
                    <Tooltip contentStyle={tooltip} formatter={v => [formatINR(v), 'Spent']} />
                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#tripGrad)" dot={{ fill: '#10b981', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={`h-[180px] flex items-center justify-center text-sm ${tm}`}>No spending data yet</div>
              )}
            </div>

            {/* Category Breakdown */}
            <div className={`${card} border rounded-2xl p-5`}>
              <p className={`text-sm font-semibold ${tp} mb-4`}>Category Breakdown</p>
              {analytics?.category_breakdown?.length > 0 ? (
                <div className="flex items-start gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={analytics.category_breakdown} cx="50%" cy="50%"
                        innerRadius={38} outerRadius={58} dataKey="total" paddingAngle={3}>
                        {analytics.category_breakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltip} formatter={v => [formatINR(v), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {analytics.category_breakdown.map(c => (
                      <div key={c.category}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={tm}>{CAT_ICONS[c.category]} {c.category}</span>
                          <span className={tp + ' font-medium'}>{c.percentage}%</span>
                        </div>
                        <div className={`h-1.5 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                          <div className="h-full rounded-full" style={{ width: `${c.percentage}%`, background: c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`h-[130px] flex items-center justify-center text-sm ${tm}`}>Add expenses to see breakdown</div>
              )}
            </div>
          </div>

          {/* ── Expense List ── */}
          <div className={`${card} border rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <p className={`text-sm font-semibold ${tp}`}>All Expenses</p>
              <span className={`text-xs ${tm}`}>{expenses.length} total</span>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-3">🧾</p>
                <p className={`text-sm ${tm} mb-4`}>No expenses added yet.</p>
                <button onClick={() => setShowAdd(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                  + Add First Expense
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {expenses.map(exp => (
                  <div key={exp.id} className={`flex items-center gap-3 py-3 border-b ${dark ? 'border-[#1f1f1f]' : 'border-gray-50'} last:border-0 group`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: (CAT_COLORS[exp.category] || '#6b7280') + '22' }}>
                      {CAT_ICONS[exp.category] || '💳'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${tp} truncate`}>{exp.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: (CAT_COLORS[exp.category] || '#6b7280') + '22', color: CAT_COLORS[exp.category] || '#6b7280' }}>
                          {exp.category}
                        </span>
                        <span className={`text-[10px] ${tm}`}>{exp.date ? formatDate(exp.date) : '—'}</span>
                        {exp.notes && <span className={`text-[10px] ${tm} truncate max-w-[100px]`}>{exp.notes}</span>}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${tp} flex-shrink-0`}>-{formatINR(exp.amount)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => startEdit(exp)} className={`${tm} hover:text-blue-400 transition-colors`}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeleteId(exp.id)} className={`${tm} hover:text-red-400 transition-colors`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Trip Summary ── */}
          <div className={`${card} border rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4`}>
            {[
              { label: 'Trip Days',      value: analytics?.days_total,   sub: `${analytics?.days_elapsed} elapsed` },
              { label: 'Total Expenses', value: analytics?.expense_count, sub: 'transactions' },
              { label: 'Daily Average',  value: formatINR(analytics?.daily_average), sub: 'per day' },
              { label: 'Projected',      value: formatINR(analytics?.projected_total), sub: 'by end of trip' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${tp}`}>{s.value}</p>
                <p className={`text-xs ${tm} mt-0.5`}>{s.label}</p>
                <p className={`text-[10px] ${dark ? 'text-gray-600' : 'text-gray-400'} mt-0.5`}>{s.sub}</p>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}