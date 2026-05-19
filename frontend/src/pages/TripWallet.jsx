/**
 * TripWallet.jsx — Trip Wallet & Deposit Management
 * Features:
 *   - Create wallet & assign manager
 *   - Wallet dashboard (balance, deposits, expenses)
 *   - Add deposits per member
 *   - Mark deposit as received / pending
 *   - Delete deposits
 *   - Transaction history
 *   - Full dark mode support
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, X, Check, RefreshCw,
  Wallet, Users, TrendingUp, TrendingDown, Clock,
  ChevronDown, CheckCircle, Circle, AlertCircle,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { useTheme } from '../context/ThemeContext'

const formatINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

const TX_ICONS = { deposit: '⬇️', expense: '⬆️', settlement: '🤝' }
const TX_LABELS = { deposit: 'Deposit', expense: 'Expense', settlement: 'Settlement' }

export default function TripWallet() {
  const { dark } = useTheme()
  const { id }   = useParams()
  const navigate = useNavigate()

  // ── Data state ──
  const [trip,    setTrip]    = useState(null)
  const [wallet,  setWallet]  = useState(null)   // null = not created yet
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)

  // ── Wallet creation ──
  const [creating,       setCreating]       = useState(false)
  const [managerForm,    setManagerForm]    = useState('')   // member id string

  // ── Deposit form ──
  const [showAddDeposit, setShowAddDeposit] = useState(false)
  const [addingDeposit,  setAddingDeposit]  = useState(false)
  const [depositForm,    setDepositForm]    = useState({ member_id: '', amount: '', notes: '', deposit_date: '' })
  const [depositErrors,  setDepositErrors]  = useState({})

  // ── Manager change ──
  const [showManagerEdit,  setShowManagerEdit]  = useState(false)
  const [newManagerId,     setNewManagerId]     = useState('')
  const [savingManager,    setSavingManager]    = useState(false)

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('deposits')

  // ── Theme helpers ──
  const bg      = dark ? 'bg-[#0d0d0d]'                  : 'bg-gray-50'
  const card    = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const topbar  = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const tp      = dark ? 'text-white'                     : 'text-gray-900'
  const tm      = dark ? 'text-gray-400'                  : 'text-gray-500'
  const inputBg = dark
    ? 'bg-[#111] border-[#333] text-gray-200 placeholder-gray-600'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
  const modalBg = dark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'
  const border  = dark ? 'border-[#2a2a2a]'               : 'border-gray-200'
  const hov     = dark ? 'hover:bg-[#252525]'             : 'hover:bg-gray-50'

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    try {
      const [tripRes, membersRes] = await Promise.all([
        api.get(`/trips/${id}`),
        api.get(`/trips/${id}/members`),
      ])
      setTrip(tripRes.data)
      setMembers(membersRes.data)

      try {
        const walletRes = await api.get(`/trips/${id}/wallet`)
        setWallet(walletRes.data)
      } catch (err) {
        if (err?.response?.status === 404) {
          setWallet(null)   // wallet not created yet
        } else throw err
      }
    } catch {
      showToast('Failed to load wallet data', 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Create Wallet ──
  const handleCreateWallet = async () => {
    setCreating(true)
    try {
      await api.post(`/trips/${id}/wallet`, {
        manager_member_id: managerForm ? Number(managerForm) : null,
      })
      await fetchAll()
      showToast('Wallet created ✓')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to create wallet', 'error')
    } finally { setCreating(false) }
  }

  // ── Update Manager ──
  const handleSaveManager = async () => {
    setSavingManager(true)
    try {
      await api.patch(`/trips/${id}/wallet/manager`, {
        manager_member_id: newManagerId ? Number(newManagerId) : null,
      })
      setShowManagerEdit(false)
      await fetchAll()
      showToast('Manager updated ✓')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to update manager', 'error')
    } finally { setSavingManager(false) }
  }

  // ── Add Deposit ──
  const validateDeposit = () => {
    const errs = {}
    if (!depositForm.member_id)                              errs.member_id = 'Select a member'
    if (!depositForm.amount || Number(depositForm.amount) <= 0) errs.amount = 'Enter valid amount'
    setDepositErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAddDeposit = async () => {
    if (!validateDeposit()) return
    setAddingDeposit(true)
    try {
      await api.post(`/trips/${id}/wallet/deposits`, {
        member_id:    Number(depositForm.member_id),
        amount:       Number(depositForm.amount),
        notes:        depositForm.notes || null,
        deposit_date: depositForm.deposit_date ? new Date(depositForm.deposit_date).toISOString() : null,
      })
      setShowAddDeposit(false)
      setDepositForm({ member_id: '', amount: '', notes: '', deposit_date: '' })
      setDepositErrors({})
      await fetchAll()
      showToast('Deposit added ✓')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to add deposit', 'error')
    } finally { setAddingDeposit(false) }
  }

  // ── Mark Deposit Received / Pending ──
  const handleToggleDepositStatus = async (depositId, currentStatus) => {
    const newStatus = currentStatus === 'received' ? 'pending' : 'received'
    try {
      await api.patch(`/trips/${id}/wallet/deposits/${depositId}/status`, { status: newStatus })
      await fetchAll()
      showToast(newStatus === 'received' ? 'Deposit marked as received ✓' : 'Deposit marked as pending')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to update deposit', 'error')
    }
  }

  // ── Delete Deposit ──
  const handleDeleteDeposit = async (depositId) => {
    try {
      await api.delete(`/trips/${id}/wallet/deposits/${depositId}`)
      await fetchAll()
      showToast('Deposit deleted')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to delete deposit', 'error')
    }
  }

  // ── Helpers ──
  const getMemberName = (memberId) => {
    const m = members.find(m => m.id === memberId)
    return m ? m.name : `Member #${memberId}`
  }

  const managerName = wallet?.manager_member_id
    ? getMemberName(wallet.manager_member_id)
    : 'Not assigned'

  const deposits     = wallet?.deposits     || []
  const transactions = wallet?.transactions || []
  const received     = deposits.filter(d => d.status === 'received')
  const pending      = deposits.filter(d => d.status === 'pending')

  // ── Loading ──
  if (loading) return (
    <div className={`flex ${bg} min-h-screen ${tp}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${tm}`}>Loading wallet…</p>
        </div>
      </main>
    </div>
  )

  return (
    <div className={`flex ${bg} min-h-screen ${tp}`}>
      <Navbar />
      <main className="md:ml-56 flex-1 pb-24 md:pb-0">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
            {toast.msg}
          </div>
        )}

        {/* ── Add Deposit Modal ── */}
        {showAddDeposit && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={`${modalBg} border rounded-t-3xl md:rounded-2xl w-full md:max-w-md shadow-2xl`}>
              <div className={`flex items-center justify-between p-5 border-b ${border}`}>
                <p className={`font-semibold ${tp}`}>Add Deposit</p>
                <button onClick={() => { setShowAddDeposit(false); setDepositErrors({}) }}
                  className={`${tm} hover:text-red-400`}><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">

                {/* Member */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Member *</label>
                  <div className="relative">
                    <select
                      value={depositForm.member_id}
                      onChange={e => setDepositForm(f => ({ ...f, member_id: e.target.value }))}
                      className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none`}
                    >
                      <option value="">Select member…</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className={`absolute right-3 top-3 ${tm} pointer-events-none`} />
                  </div>
                  {depositErrors.member_id && <p className="text-red-400 text-xs mt-1">{depositErrors.member_id}</p>}
                </div>

                {/* Amount */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Amount (₹) *</label>
                  <input
                    type="number" min="1"
                    value={depositForm.amount}
                    onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g. 5000"
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {depositErrors.amount && <p className="text-red-400 text-xs mt-1">{depositErrors.amount}</p>}
                </div>

                {/* Date */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Date (optional)</label>
                  <input
                    type="date"
                    value={depositForm.deposit_date}
                    onChange={e => setDepositForm(f => ({ ...f, deposit_date: e.target.value }))}
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>Notes (optional)</label>
                  <input
                    value={depositForm.notes}
                    onChange={e => setDepositForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Cash handed to manager"
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowAddDeposit(false); setDepositErrors({}) }}
                    className={`flex-1 border ${border} ${tm} py-2.5 rounded-xl text-sm ${hov} transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDeposit}
                    disabled={addingDeposit}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {addingDeposit
                      ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Adding…</>
                      : <><Check size={14} /> Add Deposit</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Change Manager Modal ── */}
        {showManagerEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`${modalBg} border rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`font-semibold ${tp}`}>Change Wallet Manager</p>
                <button onClick={() => setShowManagerEdit(false)} className={`${tm} hover:text-red-400`}>
                  <X size={16} />
                </button>
              </div>
              <p className={`text-xs ${tm} mb-4`}>
                Current: <span className="text-blue-400 font-semibold">{managerName}</span>
              </p>
              <div className="mb-5">
                <label className={`text-xs font-medium ${tm} mb-1.5 block`}>New Manager</label>
                <div className="relative">
                  <select
                    value={newManagerId}
                    onChange={e => setNewManagerId(e.target.value)}
                    className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none`}
                  >
                    <option value="">None (no manager)</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={`absolute right-3 top-3.5 ${tm} pointer-events-none`} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowManagerEdit(false)}
                  className={`flex-1 border ${border} ${tm} py-2.5 rounded-xl text-sm ${hov} transition-colors`}>
                  Cancel
                </button>
                <button onClick={handleSaveManager} disabled={savingManager}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  {savingManager
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                    : <><Check size={14} /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Top Bar ── */}
        <div className={`${topbar} border-b px-4 md:px-6 py-4 flex items-center gap-3 sticky top-0 z-20`}>
          <button onClick={() => navigate(`/trips/${id}`)} className={`${tm} transition-colors`}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`text-base font-semibold ${tp} truncate`}>
              💳 Trip Wallet
            </h1>
            <p className={`text-xs ${tm}`}>{trip?.name} · {trip?.destination}</p>
          </div>
          <button onClick={fetchAll}
            className={`text-xs border ${border} ${tm} ${hov} px-3 py-1.5 rounded-xl transition-colors`}>
            <RefreshCw size={12} />
          </button>
          {wallet && (
            <button
              onClick={() => setShowAddDeposit(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Add Deposit
            </button>
          )}
        </div>

        <div className="p-4 md:p-6 space-y-5">

          {/* ── No Wallet Yet ── */}
          {!wallet ? (
            <div className={`${card} border rounded-2xl p-8 text-center`}>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Wallet size={28} className="text-blue-400" />
              </div>
              <p className={`text-base font-semibold ${tp} mb-2`}>No Wallet Yet</p>
              <p className={`text-sm ${tm} mb-6 max-w-xs mx-auto`}>
                Create a wallet to manage deposits, track payments, and see who's contributed to this trip.
              </p>

              {members.length > 0 && (
                <div className="mb-5 text-left max-w-xs mx-auto">
                  <label className={`text-xs font-medium ${tm} mb-1.5 block`}>
                    Assign a Trip Manager (optional)
                  </label>
                  <div className="relative">
                    <select
                      value={managerForm}
                      onChange={e => setManagerForm(e.target.value)}
                      className={`w-full text-sm ${inputBg} border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none`}
                    >
                      <option value="">No manager</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className={`absolute right-3 top-3 ${tm} pointer-events-none`} />
                  </div>
                </div>
              )}

              {members.length === 0 && (
                <div className={`mb-5 p-3 rounded-xl ${dark ? 'bg-amber-900/20 border border-amber-800/30' : 'bg-amber-50 border border-amber-200'} flex items-center gap-2`}>
                  <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-400">
                    Add trip members first before creating a wallet so you can assign deposits to them.
                  </p>
                </div>
              )}

              <button
                onClick={handleCreateWallet}
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto transition-colors"
              >
                {creating
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating…</>
                  : <><Wallet size={16} /> Create Wallet</>}
              </button>
            </div>
          ) : (
            <>
              {/* ── Wallet Dashboard ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Wallet Balance',
                    value: formatINR(wallet.balance),
                    color: wallet.balance >= 0 ? 'text-blue-400' : 'text-red-400',
                    icon: <Wallet size={16} className={wallet.balance >= 0 ? 'text-blue-400' : 'text-red-400'} />,
                    sub: 'received − expenses',
                  },
                  {
                    label: 'Total Received',
                    value: formatINR(wallet.total_deposits_received),
                    color: 'text-emerald-400',
                    icon: <TrendingUp size={16} className="text-emerald-400" />,
                    sub: `${received.length} deposit${received.length !== 1 ? 's' : ''}`,
                  },
                  {
                    label: 'Pending Deposits',
                    value: formatINR(wallet.total_deposits_pending),
                    color: 'text-amber-400',
                    icon: <Clock size={16} className="text-amber-400" />,
                    sub: `${pending.length} awaiting`,
                  },
                  {
                    label: 'Total Expenses',
                    value: formatINR(wallet.total_expenses),
                    color: 'text-rose-400',
                    icon: <TrendingDown size={16} className="text-rose-400" />,
                    sub: 'from wallet',
                  },
                ].map(c => (
                  <div key={c.label} className={`${card} border rounded-2xl p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs ${tm}`}>{c.label}</p>
                      {c.icon}
                    </div>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                    <p className={`text-[10px] ${tm} mt-1`}>{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Manager Card ── */}
              <div className={`${card} border rounded-2xl p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Users size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className={`text-xs ${tm}`}>Wallet Manager / Treasurer</p>
                    <p className={`text-sm font-semibold ${tp}`}>{managerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setNewManagerId(String(wallet.manager_member_id || '')); setShowManagerEdit(true) }}
                  className={`text-xs border ${border} ${tm} ${hov} px-3 py-1.5 rounded-xl transition-colors`}
                >
                  Change
                </button>
              </div>

              {/* ── Tabs ── */}
              <div className="flex gap-2">
                {[
                  { key: 'deposits',     label: `💰 Deposits (${deposits.length})` },
                  { key: 'transactions', label: `📋 Transactions (${transactions.length})` },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`text-xs px-3 py-2 rounded-xl transition-colors border ${
                      activeTab === t.key ? 'bg-blue-600 text-white border-blue-600' : `${border} ${tm} ${hov}`
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Deposits Tab ── */}
              {activeTab === 'deposits' && (
                <div className="space-y-3">

                  {/* Legend */}
                  <div className={`flex gap-4 text-xs ${tm}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Received
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pending
                    </span>
                  </div>

                  {deposits.length === 0 ? (
                    <div className={`${card} border rounded-2xl p-10 text-center`}>
                      <p className="text-3xl mb-3">💰</p>
                      <p className={`text-sm ${tm} mb-4`}>No deposits yet.</p>
                      <button
                        onClick={() => setShowAddDeposit(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl"
                      >
                        + Add First Deposit
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Summary by member */}
                      <div className={`${card} border rounded-2xl p-5`}>
                        <p className={`text-sm font-semibold ${tp} mb-3`}>Member Contributions</p>
                        <div className="space-y-2">
                          {members.map(m => {
                            const mDeposits  = deposits.filter(d => d.member_id === m.id)
                            const mReceived  = mDeposits.filter(d => d.status === 'received').reduce((s, d) => s + d.amount, 0)
                            const mPending   = mDeposits.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0)
                            if (mDeposits.length === 0) return null
                            return (
                              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${dark ? 'bg-[#111]' : 'bg-gray-50'}`}>
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                  {m.name[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${tp}`}>{m.name}</p>
                                  <p className={`text-xs ${tm}`}>
                                    {mReceived > 0 && <span className="text-emerald-400">{formatINR(mReceived)} received</span>}
                                    {mReceived > 0 && mPending > 0 && ' · '}
                                    {mPending > 0 && <span className="text-amber-400">{formatINR(mPending)} pending</span>}
                                  </p>
                                </div>
                                <p className={`text-sm font-semibold ${tp}`}>{formatINR(mReceived + mPending)}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* All Deposits list */}
                      <div className={`${card} border rounded-2xl p-5`}>
                        <div className="flex items-center justify-between mb-4">
                          <p className={`text-sm font-semibold ${tp}`}>All Deposits</p>
                          <button
                            onClick={() => setShowAddDeposit(true)}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                          >
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {deposits.map(dep => {
                            const isReceived = dep.status === 'received'
                            return (
                              <div
                                key={dep.id}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                  isReceived
                                    ? dark ? 'bg-emerald-900/10 border-emerald-900/30' : 'bg-emerald-50 border-emerald-100'
                                    : dark ? 'bg-amber-900/10 border-amber-900/30'    : 'bg-amber-50 border-amber-100'
                                }`}
                              >
                                {/* Status toggle button */}
                                <button
                                  onClick={() => handleToggleDepositStatus(dep.id, dep.status)}
                                  title={isReceived ? 'Mark as pending' : 'Mark as received'}
                                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                    isReceived
                                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                      : dark ? 'border-2 border-amber-700 text-amber-500 hover:bg-amber-900/20' : 'border-2 border-amber-300 text-amber-500 hover:bg-amber-50'
                                  }`}
                                >
                                  {isReceived ? <CheckCircle size={18} /> : <Circle size={18} />}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-semibold ${tp}`}>
                                      {getMemberName(dep.member_id)}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                      isReceived
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                      {isReceived ? 'Received' : 'Pending'}
                                    </span>
                                  </div>
                                  <p className={`text-xs ${tm} mt-0.5`}>
                                    {dep.deposit_date ? formatDate(dep.deposit_date) : '—'}
                                    {dep.notes && ` · ${dep.notes}`}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <p className={`text-sm font-bold ${isReceived ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {formatINR(dep.amount)}
                                  </p>
                                  <button
                                    onClick={() => handleDeleteDeposit(dep.id)}
                                    className={`${tm} hover:text-red-400 transition-colors`}
                                    title="Delete deposit"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* How it works hint */}
                      <div className={`${card} border rounded-2xl p-4`}>
                        <p className={`text-xs font-semibold ${tp} mb-1.5`}>💡 How deposits work</p>
                        <p className={`text-xs ${tm} leading-relaxed`}>
                          Add a deposit when a member promises to contribute. Click ○ to mark it as <span className="text-emerald-400">Received</span> once the manager has collected the cash — this adds it to the wallet balance. Pending deposits don't count toward the balance.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Transactions Tab ── */}
              {activeTab === 'transactions' && (
                <div className={`${card} border rounded-2xl p-5`}>
                  <p className={`text-sm font-semibold ${tp} mb-4`}>Transaction History</p>
                  {transactions.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-3">📋</p>
                      <p className={`text-sm ${tm}`}>No transactions yet. Mark deposits as received to see them here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map(tx => (
                        <div key={tx.id}
                          className={`flex items-center gap-3 p-3 rounded-xl ${dark ? 'bg-[#111]' : 'bg-gray-50'}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                            tx.tx_type === 'deposit'
                              ? dark ? 'bg-emerald-900/30' : 'bg-emerald-50'
                              : tx.tx_type === 'expense'
                              ? dark ? 'bg-red-900/30' : 'bg-red-50'
                              : dark ? 'bg-blue-900/30' : 'bg-blue-50'
                          }`}>
                            {TX_ICONS[tx.tx_type] || '💳'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${tp} truncate`}>
                              {TX_LABELS[tx.tx_type] || tx.tx_type}
                            </p>
                            <p className={`text-xs ${tm}`}>
                              {tx.description || '—'}
                              {tx.created_at && ` · ${formatDate(tx.created_at)} ${formatTime(tx.created_at)}`}
                            </p>
                          </div>
                          <p className={`text-sm font-semibold flex-shrink-0 ${
                            tx.tx_type === 'deposit' ? 'text-emerald-400'
                            : tx.tx_type === 'expense' ? 'text-red-400'
                            : 'text-blue-400'
                          }`}>
                            {tx.tx_type === 'deposit' ? '+' : '-'}{formatINR(tx.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}