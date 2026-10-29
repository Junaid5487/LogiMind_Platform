import React, { useEffect, useState, useCallback } from 'react';
import { fetchActivityChanges, triggerActivityChange } from '../services/api';
import type { ActivityChangeItem } from '../types';
import { RefreshCw, Clock, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';

function classify(desc: string): { color: string; icon: React.ReactNode } {
  const d = (desc || '').toLowerCase();
  if (d.startsWith('added')) return { color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> };
  if (d.startsWith('removed')) return { color: 'text-rose-400', icon: <MinusCircle className="w-4 h-4 text-rose-400" /> };
  if (d.includes('failed')) return { color: 'text-red-400', icon: <AlertCircle className="w-4 h-4 text-red-400" /> };
  return { color: 'text-gray-400', icon: <Clock className="w-4 h-4 text-gray-400" /> };
}

export const LiveChanges: React.FC = () => {
  const [items, setItems] = useState<ActivityChangeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActivityChanges(100);
      setItems(data);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerActivityChange();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to trigger activity');
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Changes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Background simulator applies one random add/remove mutation every 5 minutes across vehicles, warehouses, inventory and orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <span className="text-xs text-gray-500">Last refresh: {lastRefresh}</span>}
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm text-white disabled:opacity-50"
          >
            {triggering ? 'Running…' : 'Run now'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded">{error}</div>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent activity ({items.length})</h2>
          <span className="text-xs text-gray-500">Auto-refresh every 15s</span>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No activity recorded yet. The simulator records its first change ~5 minutes after backend startup.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/60">
            {items.map((it, idx) => {
              const { color, icon } = classify(it.description);
              return (
                <li key={idx} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-800/40">
                  <div className="mt-0.5">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${color} truncate`}>{it.description}</div>
                    {it.error && <div className="text-xs text-red-400 mt-0.5">{it.error}</div>}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(it.timestamp).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LiveChanges;