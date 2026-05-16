import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api/axios'
import { ScanText, Upload, CheckCircle } from 'lucide-react'

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other']

export default function OCRScanner() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleUpload = async () => {
    if (!file) return alert('Please upload a receipt first')
    const formData = new FormData()
    formData.append('file', file)
    try {
      setLoading(true)
      const res = await api.post('/ocr/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (err) {
      alert('OCR Scan Failed. Make sure the backend OCR service is running.')
    } finally {
      setLoading(false)
    }
  }

  const addExpense = async () => {
    try {
      setSaving(true)
      await api.post('/expenses/', {
        title: result.title,
        amount: Number(result.amount),
        category: result.category,
      })
      navigate('/dashboard')
    } catch (err) {
      alert('Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex bg-[#111111] min-h-screen text-white">
      <Navbar />
      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* Topbar */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-4">
          <h1 className="text-base font-semibold text-white">AI Receipt Scanner</h1>
          <p className="text-xs text-gray-500 mt-0.5">Upload receipt image or PDF — AI extracts the details automatically</p>
        </div>

        <div className="p-6 max-w-2xl space-y-6">

          {/* Upload Area */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <ScanText size={16} className="text-emerald-400" /> Upload Receipt
            </h2>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files[0]) }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-emerald-500 bg-emerald-900/10' : 'border-[#2a2a2a] hover:border-emerald-800'
              }`}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <Upload size={28} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-400">
                {file ? file.name : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Supports JPG, PNG, PDF</p>
              <input
                id="fileInput"
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-3 py-2">
                <CheckCircle size={13} /> {file.name} selected
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 disabled:text-emerald-700 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ScanText size={16} />
              {loading ? 'Scanning receipt...' : 'Scan Receipt with AI'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Extracted Details</h2>
                <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 px-2.5 py-1 rounded-full">
                  ✓ OCR Success
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Title</label>
                  <input
                    type="text"
                    value={result.title}
                    onChange={e => setResult({ ...result, title: e.target.value })}
                    className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Amount (₹)</label>
                    <input
                      type="number"
                      value={result.amount}
                      onChange={e => setResult({ ...result, amount: e.target.value })}
                      className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Category</label>
                    <select
                      value={result.category}
                      onChange={e => setResult({ ...result, category: e.target.value })}
                      className="w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {CATEGORIES.map(c => <option key={c} className="bg-[#1a1a1a]">{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={addExpense}
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900/40 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? 'Adding to dashboard...' : '+ Add to Dashboard'}
              </button>

              {result.raw_text && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2">Raw OCR Text</h3>
                  <pre className="bg-[#111] border border-[#2a2a2a] p-4 rounded-xl text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {result.raw_text}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}