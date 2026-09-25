import React, { useState } from 'react';
import { askCopilot } from '../services/api';
import { Bot, Send, X, FileText, ChevronRight } from 'lucide-react';

interface CopilotChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteAction: (action: string) => void;
}

export const CopilotChatDrawer: React.FC<CopilotChatDrawerProps> = ({ isOpen, onClose, onExecuteAction }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; data?: any }>>([
    {
      sender: 'bot',
      text: "Hello! I am your **Logistics Operations Copilot**. Ask me about vehicle maintenance flags, VRP route replanning, or cold-chain protocols."
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!query.trim()) return;
    const userMsg = query;
    setQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await askCopilot(userMsg);
      setMessages((prev) => [...prev, { sender: 'bot', text: res.answer, data: res }]);
    } catch (e) {
      setMessages((prev) => [...prev, { sender: 'bot', text: "Error processing RAG query." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] glass-panel border-l border-gray-800 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white">LogiMind RAG Copilot</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`p-3.5 rounded-2xl max-w-[88%] space-y-2 ${
                m.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-br-none'
                  : 'bg-gray-900/90 text-gray-200 border border-gray-800 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.data?.suggested_actions?.map((act: any, aIdx: number) => (
                <button
                  key={aIdx}
                  onClick={() => onExecuteAction(act.action)}
                  className="mt-2 w-full px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-semibold transition-all flex items-center justify-between border border-purple-500/30"
                >
                  <span>{act.label}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Copilot SOP or vehicle questions..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
