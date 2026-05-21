const fs = require('fs');
const panel = `
          {/* -- History Tab -- */}
          {activeTab === 'history' && (
            <div className={\`\${card} border rounded-2xl p-5\`}>
              <div className="flex items-center justify-between mb-4">
                <p className={\`text-sm font-semibold \${tp}\`}>Expense History</p>
                <button onClick={fetchHistory} className={\`text-xs border \${border} \${tm} px-2 py-1 rounded-lg \${hov} transition-colors\`}>↺ Refresh</button>
              </div>
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">📋</p>
                  <p className={\`text-sm \${tm}\`}>No history yet. Add, edit or delete expenses to see the log.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className={\`absolute left-4 top-0 bottom-0 w-px \${dark ? 'bg-[#2a2a2a]' : 'bg-gray-200'}\`} />
                  <div className="space-y-4 pl-10">
                    {history.map((h) => {
                      const actionColor = h.action === 'added' ? 'bg-emerald-500' : h.action === 'updated' ? 'bg-blue-500' : 'bg-red-500'
                      const actionLabel = h.action === 'added' ? 'Added' : h.action === 'updated' ? 'Updated' : 'Deleted'
                      const dt = h.changed_at ? new Date(h.changed_at) : null
                      const timeStr = dt ? dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                      return (
                        <div key={h.id} className="relative">
                          <div className={\`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full \${actionColor} ring-2 \${dark ? 'ring-[#0a0a0a]' : 'ring-white'}\`} />
                          <div className={\`rounded-xl border p-3 \${dark ? 'bg-[#111] border-[#1f1f1f]' : 'bg-gray-50 border-gray-100'}\`}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={\`text-[10px] font-semibold px-1.5 py-0.5 rounded-full \${actionColor} text-white\`}>{actionLabel}</span>
                              <span className={\`text-sm font-medium \${tp} truncate\`}>{h.title || '—'}</span>
                              <span className={\`text-[10px] \${tm} ml-auto\`}>{timeStr}</span>
                            </div>
                            {h.action === 'added' && (
                              <p className={\`text-xs \${tm}\`}>
                                <span className="text-emerald-400 font-medium">{formatINR(h.new_amount)}</span>
                                {h.new_category ? <span> · {h.new_category}</span> : null}
                                {h.new_notes ? <span> · {h.new_notes}</span> : null}
                              </p>
                            )}
                            {h.action === 'updated' && (
                              <div className={\`text-xs \${tm} space-y-0.5\`}>
                                {h.old_amount !== h.new_amount && h.old_amount != null && (
                                  <p>Amount: <span className="line-through text-red-400">{formatINR(h.old_amount)}</span> → <span className="text-emerald-400 font-medium">{formatINR(h.new_amount)}</span></p>
                                )}
                                {h.old_category !== h.new_category && h.old_category != null && (
                                  <p>Category: <span className="line-through text-red-400">{h.old_category}</span> → <span className="text-blue-400">{h.new_category}</span></p>
                                )}
                                {h.old_notes !== h.new_notes && (
                                  <p>Notes: <span className="line-through text-red-400">{h.old_notes || 'none'}</span> → <span className="text-blue-400">{h.new_notes || 'none'}</span></p>
                                )}
                              </div>
                            )}
                            {h.action === 'deleted' && (
                              <p className={\`text-xs \${tm}\`}>
                                <span className="text-red-400 font-medium">{formatINR(h.old_amount)}</span>
                                {h.old_category ? <span> · {h.old_category}</span> : null}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}`;
fs.writeFileSync('history_panel.txt', panel);
