import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/axios'

import {
  FileText,
  ExternalLink,
  Clock,
} from 'lucide-react'

const CATEGORY_COLORS = {
  Food:
    'bg-emerald-900/40 text-emerald-400 border-emerald-800/40',

  Transport:
    'bg-blue-900/40 text-blue-400 border-blue-800/40',

  Shopping:
    'bg-pink-900/40 text-pink-400 border-pink-800/40',

  Bills:
    'bg-amber-900/40 text-amber-400 border-amber-800/40',

  Health:
    'bg-red-900/40 text-red-400 border-red-800/40',

  Entertainment:
    'bg-purple-900/40 text-purple-400 border-purple-800/40',

  Education:
    'bg-cyan-900/40 text-cyan-400 border-cyan-800/40',

  Other:
    'bg-gray-800 text-gray-400 border-gray-700',
}

export default function ReceiptHistory() {
  const [receipts, setReceipts] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    fetchReceipts()
  }, [])

  const fetchReceipts = async () => {
    try {
      const res = await api.get(
        '/ocr/history'
      )

      setReceipts(res.data)
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex bg-[#111111] min-h-screen text-white">
      <Navbar />

      <main className="md:ml-56 flex-1 pb-20 md:pb-0">

        {/* Topbar */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-4">
          <h1 className="text-base font-semibold text-white">
            Receipt History
          </h1>

          <p className="text-xs text-gray-500 mt-0.5">
            All your AI-scanned receipt archive
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-600">
              Loading receipts...
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText
                size={40}
                className="text-gray-700 mb-3"
              />

              <p className="text-gray-500 text-sm">
                No receipts scanned yet.
              </p>

              <p className="text-gray-600 text-xs mt-1">
                Go to Receipt Scanner to upload your first receipt.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 hover:border-emerald-900/50 transition-colors"
                >

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-white text-sm truncate">
                        {receipt.title ||
                          'Unknown'}
                      </h2>

                      {receipt.created_at && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock
                            size={10}
                            className="text-gray-600"
                          />

                          <p className="text-xs text-gray-600">
                            {new Date(
                              receipt.created_at
                            ).toLocaleDateString(
                              'en-IN'
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border font-medium ml-2 flex-shrink-0 ${
                        CATEGORY_COLORS[
                          receipt.category
                        ] ||
                        CATEGORY_COLORS.Other
                      }`}
                    >
                      {receipt.category}
                    </span>
                  </div>

                  {/* Amount */}
                  <p className="text-2xl font-bold text-white mb-4">
                    ₹
                    {Number(
                      receipt.amount || 0
                    ).toLocaleString(
                      'en-IN'
                    )}
                  </p>

                  {/* Open receipt link */}
                  {receipt.image_url && (
                    <a
                      href={`http://127.0.0.1:8000${receipt.image_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mb-4 transition-colors"
                    >
                      <ExternalLink
                        size={12}
                      />

                      Open Receipt File
                    </a>
                  )}

                  {/* OCR Text */}
                  {receipt.raw_text && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-600 mb-1.5">
                        OCR Text
                      </h3>

                      <div className="bg-[#111] border border-[#2a2a2a] p-3 rounded-xl text-xs text-gray-500 max-h-28 overflow-y-auto whitespace-pre-wrap">
                        {receipt.raw_text}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}