/**
 * Trips.jsx — Trip Expense Tracker main page
 * Lists all trips, creation modal, search/filter, quick stats
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, MapPin, Calendar, Wallet, TrendingUp, Trash2, X, ChevronRight, Plane, AlertTriangle } from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { useTheme } from '../context/ThemeContext'

const STATUS_COLORS = {
  active:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Active' },
  completed: { bg: 'bg-blue-500/20',    text: 'text-blue-400',    label: 'Completed' },
  cancelled: { bg: 'bg-gray-500/20',    text: 'text-gray-400',    label: 'Cancelled' },
}

const ALERT_STYLES = {
  exceeded: { bar: 'bg-red-500',    text: 'text-red-400',    banner: 'bg-red-900/20 border-red-800/40' },
  '90':     { bar: 'bg-orange-500', text: 'text-orange-400', banner: 'bg-orange-900/20 border-orange-800/40' },
  '80':     { bar: 'bg-amber-500',  text: 'text-amber-400',  banner: 'bg-amber-900/20 border-amber-800/40' },
  null:     { bar: 'bg-emerald-500', text: 'text-emerald-400', banner: '' },
}

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Trips() {
  const { dark } = useTheme()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const [form, setForm] = useState({
    name: '', destination: '', description: '',
    budget_limit: '', start_date: '', end_date: '',
  })
  const [formErrors, setFormErrors] = useState({})

  // ── Theme ──
  const bg       = dark ? 'bg-[#0d0d0d]'         : 'bg-gray-50'
  const card     = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar   = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const tp       = dark ? 'text-white'            : 'text-gray-900'
  const tm       = dark ? 'text-gray-400'         : 'text-gray-500'
  const inputBg  = dark ? 'bg-[#111] border-[#333] text-gray-200 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
  const modalBg  = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const border   = dark ? 'border-[#2a2a2a]'     : 'border-gray-200'
  const hov      = dark ? 'hover:bg-[#252525]'   : 'hover:bg-gray-50'

  // ── Data ──
  const fetchTrips = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/trips/summary/all')
      setTrips(res.data)
    } catch { showToast('Failed to load trips', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Filtering ──
  const filtered = trips.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                        t.destination.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  // ── Form validation ──
  const validateForm = () => {
    const errs = {}
    if (!form.name.trim())         errs.name        = 'Trip name is required'
    if (!form.destination.trim())  errs.destination  = 'Destination is required'
    if (!form.budget_limit || Number(form.budget_limit) <= 0)
                                   errs.budget_limit = 'Enter a valid budget'
    if (!form.start_date)          errs.start_date   = 'Start date required'
    if (!form.end_date)            errs.end_date     = 'End date required'
    if (form.start_date && form.end_date && form.end_date < form.start_date)
                                   errs.end_date     = 'End date must be after start'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Create Trip ──
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setCreating(true)
    try {
      await api.post('/trips/', {
        ...form,
        budget_limit: Number(form.budget_limit),
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
      })
      setShowCreate(false)
      setForm({ name: '', destination: '', description: '', budget_limit: '', start_date: '', end_date: '' })
      setFormErrors({})
      fetchTrips()
      showToast('✈️ Trip created successfully!')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to create trip', 'error')
    } finally { setCreating(false) }
  }

  // ── Delete ──
  const handleDelete = async (id) => {
    try {
      await api.delete(`/trips/${id}`)
      setDeleteId(null)
      fetchTrips()
      showToast('Trip deleted')
    } catch { showToast('Failed to delete trip', 'error') }
  }

  const totalBudget = trips.reduce((s, t) => s + t.budget_limit, 0)
  const totalSpent  = trips.reduce((s, t) => s + t.total_spent, 0)
  const activeCount = trips.filter(t => t.status === 'active').length

  return (
    <div className={`flex ${bg} min-h-screen ${tp}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-24 md:pb-0">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
            ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* ── Delete Confirm Modal ── */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`${modalBg} border rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <p className={`font-semibold ${tp}`}>Delete Trip?</p>
                  <p className={`text-xs ${tm}`}>All expenses will be permanently removed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className={`flex-1 text-sm border ${border} ${tm} py-2.5 rounded-xl ${hov} transition-colors`}>
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Trip Modal ── */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={`${modalBg} border rounded-t-3xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
              <div className="flex items-center justify-between p-5 border-b border-inherit sticky top-0 bg-inherit z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Plane size={15} className="text-emerald-400" />
                  </div>
                  <p className={`font-semibold ${tp}`}>New Trip</p>
                </div>
                <button onClick={() => { setShowCreate(false); setFormErrors({}) }} className={`${tm} hover:text-red-400 transition-colors`}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 space-y-4">
                {/* Trip Name */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Trip Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Goa Beach Trip"
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                  {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                </div>

                {/* Destination */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Destination *</label>
                  <input
                    value={form.destination}
                    onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                    placeholder="e.g. Goa, India"
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                  {formErrors.destination && <p className="text-red-400 text-xs mt-1">{formErrors.destination}</p>}
                </div>

                {/* Budget */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Total Budget (₹) *</label>
                  <input
                    type="number" min="1"
                    value={form.budget_limit}
                    onChange={e => setForm(f => ({ ...f, budget_limit: e.target.value }))}
                    placeholder="e.g. 25000"
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                  {formErrors.budget_limit && <p className="text-red-400 text-xs mt-1">{formErrors.budget_limit}</p>}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Start Date *</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className={`w-full text-sm ${inputBg} border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    />
                    {formErrors.start_date && <p className="text-red-400 text-xs mt-1">{formErrors.start_date}</p>}
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${tm} mb-1.5 block`}>End Date *</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className={`w-full text-sm ${inputBg} border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    />
                    {formErrors.end_date && <p className="text-red-400 text-xs mt-1">{formErrors.end_date}</p>}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Description (optional)</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Trip notes, itinerary hints…"
                    rows={2}
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating…</>
                  ) : (
                    <><Plus size={16} /> Create Trip</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className={`${topbar} border-b px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20`}>
          <div>
            <h1 className={`text-base font-semibold ${tp}`}>Trip Expenses</h1>
            <p className={`text-xs ${tm} mt-0.5`}>{activeCount} active trip{activeCount !== 1 ? 's' : ''} · {trips.length} total</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> New Trip
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Total Budget', value: formatINR(totalBudget), icon: '💼', color: 'text-blue-400' },
              { label: 'Total Spent',  value: formatINR(totalSpent),  icon: '💸', color: 'text-rose-400' },
              { label: 'Saved',        value: formatINR(totalBudget - totalSpent), icon: '✅', color: 'text-emerald-400' },
            ].map(c => (
              <div key={c.label} className={`${card} border rounded-2xl p-4`}>
                <p className={`text-xs ${tm} mb-2`}>{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-lg mt-1">{c.icon}</p>
              </div>
            ))}
          </div>

          {/* ── Search + Filter ── */}
          <div className="flex flex-wrap gap-2">
            <div className={`flex items-center gap-2 flex-1 min-w-[180px] ${inputBg} border rounded-xl px-3 py-2`}>
              <Search size={14} className={tm} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search trips…"
                className="bg-transparent text-sm focus:outline-none flex-1"
              />
            </div>
            <div className="flex gap-1">
              {['all', 'active', 'completed', 'cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-2 rounded-xl capitalize transition-colors border ${
                    statusFilter === s
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : `${border} ${tm} ${hov}`
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Trips Grid ── */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`${card} border rounded-2xl p-5 animate-pulse`}>
                  <div className={`h-4 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'} rounded w-2/3 mb-3`} />
                  <div className={`h-3 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'} rounded w-1/2 mb-4`} />
                  <div className={`h-2 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'} rounded-full mb-4`} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`h-8 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'} rounded-lg`} />
                    <div className={`h-8 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'} rounded-lg`} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={`${card} border rounded-2xl p-12 text-center`}>
              <div className="text-5xl mb-4">✈️</div>
              <p className={`font-semibold ${tp} mb-2`}>{search ? 'No trips found' : 'No trips yet'}</p>
              <p className={`text-sm ${tm} mb-6`}>{search ? 'Try a different search.' : 'Create your first trip to start tracking expenses.'}</p>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                  + New Trip
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(trip => {
                const alertStyle = ALERT_STYLES[trip.alert_level] || ALERT_STYLES.null
                const statusStyle = STATUS_COLORS[trip.status] || STATUS_COLORS.active
                return (
                  <div key={trip.id} className={`${card} border rounded-2xl p-5 group transition-all hover:shadow-lg`}>
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`font-semibold ${tp} truncate`}>{trip.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin size={11} className={tm} />
                          <p className={`text-xs ${tm} truncate`}>{trip.destination}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                        <button
                          onClick={() => setDeleteId(trip.id)}
                          className={`${tm} hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Date range */}
                    <div className={`flex items-center gap-1 mb-3`}>
                      <Calendar size={11} className={tm} />
                      <p className={`text-[11px] ${tm}`}>{formatDate(trip.start_date)} → {formatDate(trip.end_date)}</p>
                    </div>

                    {/* Budget progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={tm}>Budget used</span>
                        <span className={`font-semibold ${alertStyle.text}`}>{trip.percentage_used}%</span>
                      </div>
                      <div className={`h-2 ${dark ? 'bg-[#2a2a2a]' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${alertStyle.bar}`}
                          style={{ width: `${Math.min(trip.percentage_used, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Alert banner */}
                    {trip.alert_level && (
                      <div className={`text-xs px-3 py-2 rounded-xl mb-3 border ${alertStyle.banner} ${alertStyle.text} flex items-center gap-2`}>
                        <AlertTriangle size={12} />
                        {trip.alert_level === 'exceeded' ? 'Budget exceeded!' : `${trip.alert_level}% of budget used`}
                      </div>
                    )}

                    {/* Amount row */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className={`${dark ? 'bg-[#111]' : 'bg-gray-50'} rounded-xl px-3 py-2`}>
                        <p className={`text-[10px] ${tm} mb-0.5`}>Spent</p>
                        <p className={`text-sm font-bold text-rose-400`}>{formatINR(trip.total_spent)}</p>
                      </div>
                      <div className={`${dark ? 'bg-[#111]' : 'bg-gray-50'} rounded-xl px-3 py-2`}>
                        <p className={`text-[10px] ${tm} mb-0.5`}>Remaining</p>
                        <p className={`text-sm font-bold ${trip.remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatINR(trip.remaining)}</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] ${tm}`}>{trip.expense_count} expense{trip.expense_count !== 1 ? 's' : ''} · Budget {formatINR(trip.budget_limit)}</p>
                      <button
                        onClick={() => navigate(`/trips/${trip.id}`)}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                      >
                        View <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}