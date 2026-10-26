import React, { useEffect, useState } from 'react';
import { fetchDbTables, fetchDbSchema, fetchDbRows, insertDbRow, updateDbRow, deleteDbRow } from '../services/api';

interface SchemaCol { name: string; type: string; sql_type: string; nullable: boolean; primary_key: boolean; default: string | null; foreign_key: string | null; }

export const DatabaseEntry: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [schema, setSchema] = useState<SchemaCol[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pkCol = schema.find((c) => c.primary_key)?.name || 'id';
  useEffect(() => {
    (async () => {
      try {
        const t = await fetchDbTables();
        setTables(t);
        if (t.length) setSelectedTable(t[0]);
      } catch (e: any) { setError(e.message); }
    })();
  }, []);

  const loadTable = async (table: string) => {
    if (!table) return;
    setLoading(true); setError(null);
    try {
      const [sch, rws] = await Promise.all([fetchDbSchema(table), fetchDbRows(table)]);
      setSchema(sch); setRows(rws); setFormData({}); setEditingId(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedTable) loadTable(selectedTable); }, [selectedTable]);

  const handleChange = (name: string, value: any) => setFormData((prev) => ({ ...prev, [name]: value }));

  const toInputValue = (col: SchemaCol, raw: any): string => {
    if (raw === null || raw === undefined) return '';
    if (col.type === 'boolean') return raw ? 'true' : 'false';
    if (col.type === 'datetime') {
      try {
        const d = new Date(raw);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch { return String(raw); }
    }
    return String(raw);
  };

  const handleEdit = (row: any) => {
    const next: Record<string, any> = {};
    schema.forEach((col) => { next[col.name] = toInputValue(col, row[col.name]); });
    setFormData(next); setEditingId(String(row[pkCol]));
  };

  const handleCancel = () => { setFormData({}); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    const payload: Record<string, any> = {};
    schema.forEach((col) => {
      const v = formData[col.name];
      if (v === undefined || v === null || v === '') return;
      payload[col.name] = v;
    });
    try {
      if (editingId) { await updateDbRow(selectedTable, editingId, payload); setSuccess(`Row ${editingId} updated.`); }
      else { await insertDbRow(selectedTable, payload); setSuccess('Row inserted.'); }
      await loadTable(selectedTable);
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete row ${id} from ${selectedTable}?`)) return;
    setError(null); setSuccess(null);
    try { await deleteDbRow(selectedTable, id); setSuccess(`Row ${id} deleted.`); await loadTable(selectedTable); }
    catch (e: any) { setError(e.message); }
  };

  const renderInput = (col: SchemaCol) => {
    const val = formData[col.name] ?? '';
    const disabled = col.primary_key && !!editingId;
    if (col.type === 'boolean') {
      return (
        <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm" value={val} onChange={(e) => handleChange(col.name, e.target.value)} disabled={disabled}>
          <option value="">—</option><option value="true">true</option><option value="false">false</option>
        </select>
      );
    }
    const type = col.type === 'integer' || col.type === 'number' ? 'number' : col.type === 'datetime' ? 'datetime-local' : 'text';
    return (
      <input type={type} step={col.type === 'number' ? 'any' : undefined}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm" value={val}
        placeholder={col.default ? String(col.default) : col.primary_key ? 'auto' : ''}
        onChange={(e) => handleChange(col.name, e.target.value)} disabled={disabled} />
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Database Entry</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-300">Table</label>
          <select className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
            {tables.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </div>
      </div>
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded">{error}</div>}
      {success && <div className="bg-green-900/40 border border-green-700 text-green-300 px-4 py-2 rounded">{success}</div>}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">{editingId ? `Edit row ${editingId}` : 'Insert new row'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {schema.map((col) => (
            <div key={col.name} className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">
                {col.name}
                {col.primary_key && <span className="ml-1 text-sky-400">(pk)</span>}
                {col.foreign_key && <span className="ml-1 text-purple-400">fk:{col.foreign_key}</span>}
                {!col.nullable && !col.primary_key && <span className="ml-1 text-red-400">*</span>}
              </label>
              {renderInput(col)}
            </div>
          ))}
          <div className="col-span-full flex gap-3 mt-2">
            <button type="submit" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-sm font-semibold" disabled={loading}>{editingId ? 'Update' : 'Insert'}</button>
            {editingId && <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>}
          </div>
        </form>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Rows ({rows.length})</h2>
        {loading ? <div className="text-gray-400">Loading...</div> : (
          <table className="min-w-full text-xs">
            <thead><tr className="text-gray-400 border-b border-gray-800">
              {schema.map((col) => (<th key={col.name} className="text-left px-2 py-1 font-semibold">{col.name}</th>))}
              <th className="text-left px-2 py-1 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                  {schema.map((col) => (
                    <td key={col.name} className="px-2 py-1 max-w-[200px] truncate" title={String(row[col.name] ?? '')}>
                      {row[col.name] === null || row[col.name] === undefined ? '' : String(row[col.name])}
                    </td>
                  ))}
                  <td className="px-2 py-1 flex gap-2">
                    <button onClick={() => handleEdit(row)} className="text-sky-400 hover:text-sky-300">Edit</button>
                    <button onClick={() => handleDelete(String(row[pkCol]))} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DatabaseEntry;

