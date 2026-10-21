'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock, Pencil, Plus, Search, Trash2, Unlock } from 'lucide-react';
import { del, get, post, put } from '@/lib/client/api';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';
import { SCHEMAS, nameOf, type Field, type Refs, type Row } from './schemas';
import { useMe } from './me';

const PAGE = 20;

export function EntityTable({ entity }: { entity: string }) {
  const sc = SCHEMAS[entity];
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const isSuper = me.role === 'super_admin';
  const canWrite = sc.write.includes(me.role);
  const canEditOwnInst = entity === 'institutions' && me.role === 'inst_admin';

  const [q, setQ] = useState(sp.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries((sc.filters ?? []).map((f) => [f.k, sp.get(f.k) ?? '']).filter(([, v]) => v)));
  const [data, setData] = useState<{ items: Row[]; total: number } | null>(null);
  const [refs, setRefs] = useState<Refs>({});
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { const id = setTimeout(() => { setDebounced(q); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);

  const refNames = useMemo(() => [...new Set([...(sc.refs ?? []), ...(isSuper ? ['institutions'] : []), ...(sc.fields ?? []).filter((f) => f.ref).map((f) => f.ref!)])], [sc, isSuper]);
  useEffect(() => {
    Promise.all(refNames.map((r) => get<{ items: Row[] }>(`${r}?pageSize=200`).then((x) => [r, x.items] as const, () => [r, [] as Row[]] as const)))
      .then((pairs) => setRefs(Object.fromEntries(pairs)));
  }, [refNames]);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ q: debounced, page: String(page), pageSize: String(PAGE), ...filters });
    get<{ items: Row[]; total: number }>(`${entity}?${qs}`).then(
      (d) => { if (live) { setData(d); setError(''); } },
      (e: Error) => { if (live) setError(e.message); },
    );
    return () => { live = false; };
  }, [entity, debounced, page, filters, version]);

  const cols = sc.cols.filter((c) => !c.superOnly || isSuper);
  const filterDefs = [...(isSuper && sc.scoped ? [{ k: 'institutionId', label: 'Muassasa', ref: 'institutions' }] : []), ...(sc.filters ?? [])];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE));

  async function remove(row: Row) {
    const label = String(row.name ?? row.title ?? row.fullName ?? row.username ?? row.id);
    if (!confirm(`«${label}» o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.${entity === 'institutions' ? '\n\nDIQQAT: muassasaning barcha guruhlari, foydalanuvchilari va darslari ham o‘chiriladi!' : ''}`)) return;
    if (entity === 'institutions' && prompt('Tasdiqlash uchun muassasa nomini kiriting:') !== row.name) { toast('Nom mos kelmadi — bekor qilindi', 'warn'); return; }
    try { await del(`${entity}/${row.id}`); toast('O‘chirildi', 'ok'); load(); } catch (e) { toast((e as Error).message, 'bad'); }
  }
  async function toggleBlock(row: Row) {
    const next = row.status === 'active' ? 'blocked' : 'active';
    if (next === 'blocked' && !confirm(`${row.username} bloklansinmi? Uning barcha seanslari tugatiladi.`)) return;
    try { await put(`users/${row.id}`, { status: next }); toast(next === 'blocked' ? 'Bloklandi' : 'Kirish tiklandi', 'ok'); load(); } catch (e) { toast((e as Error).message, 'bad'); }
  }
  const edit = (row: Row | 'new') => (entity === 'lessons' ? router.push(`/admin/lessons/${row === 'new' ? 'new' : row.id}`) : setEditing(row));

  return (
    <>
      <PageHeader title={sc.title} description={sc.description} actions={canWrite && !sc.readOnly ? <button className="btn btn-primary" onClick={() => edit('new')}><Plus size={16} />Qo‘shish</button> : undefined} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" type="search" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
          </div>
          {filterDefs.map((f) => (
            <select key={f.k} className="input !w-auto min-w-40" value={filters[f.k] ?? ''} aria-label={f.label}
              onChange={(e) => { setPage(1); setFilters((x) => { const n = { ...x, [f.k]: e.target.value }; if (!e.target.value) delete n[f.k]; return n; }); }}>
              <option value="">{f.label}: barchasi</option>
              {(f.ref ? (refs[f.ref] ?? []).map((r) => [r.id, nameOf([r], r.id)]) : Object.entries(f.options ?? {})).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
        {error && <p className="m-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>{cols.map((c) => <th key={c.k} className="px-4 py-3 whitespace-nowrap">{c.label}</th>)}<th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data && <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-slate-400">Yuklanmoqda…</td></tr>}
              {data?.items.length === 0 && <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-slate-400">Ma’lumot topilmadi</td></tr>}
              {data?.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  {cols.map((c) => <td key={c.k} className="px-4 py-3 align-top text-slate-700">{c.render ? c.render(r[c.k], r, refs) : String(r[c.k] ?? '—')}</td>)}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      {entity === 'users' && canWrite && r.id !== me.id && <button className="btn btn-sm" onClick={() => toggleBlock(r)} title={r.status === 'active' ? 'Bloklash' : 'Tiklash'}>{r.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}</button>}
                      {entity === 'lessons' && <Link className="btn btn-sm" href={`/admin/lessons/${r.id}`} title="Ko‘rish / tahrirlash"><Pencil size={14} /></Link>}
                      {entity !== 'lessons' && (canWrite || (canEditOwnInst && r.id === me.institutionId)) && !sc.readOnly && <button className="btn btn-sm" onClick={() => edit(r)} title="Tahrirlash"><Pencil size={14} /></button>}
                      {canWrite && !sc.readOnly && <button className="btn btn-sm btn-danger" onClick={() => remove(r)} title="O‘chirish"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{data?.total ?? 0} ta yozuv</span>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Oldingi"><ChevronLeft size={16} /></button>
          <span className="tabular-nums">{page} / {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Keyingi"><ChevronRight size={16} /></button>
        </div>
      </div>
      {editing && sc.fields && (
        <EntityForm entity={entity} row={editing === 'new' ? null : editing} refs={refs} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast('Saqlandi', 'ok'); load(); }} />
      )}
    </>
  );
}

function EntityForm({ entity, row, refs, onClose, onSaved }: { entity: string; row: Row | null; refs: Refs; onClose: () => void; onSaved: () => void }) {
  const sc = SCHEMAS[entity];
  const me = useMe();
  const isSuper = me.role === 'super_admin';
  const isAdmin = isSuper || me.role === 'inst_admin';
  let fields: Field[] = (sc.fields ?? []).filter((f) => !f.adminOnly || isAdmin);
  if (entity === 'users' && !isSuper) {
    fields = fields.map((f) => (f.k === 'role' ? { ...f, options: Object.fromEntries(Object.entries(f.options ?? {}).filter(([k]) => k !== 'super_admin')) } : f));
  }
  if (entity === 'institutions' && me.role === 'inst_admin') fields = fields.filter((f) => ['name', 'city', 'languages'].includes(f.k));
  const instField: Field[] = isSuper && sc.scoped && !row ? [{ k: 'institutionId', label: 'Muassasa', type: 'ref', ref: 'institutions', req: true }] : [];
  const all = [...instField, ...fields];
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(all.map((f) => [f.k, row?.[f.k] ?? (f.k === 'role' ? 'teacher' : f.type === 'select' ? Object.keys(f.options ?? {})[0] : '')])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const instOf = String(values.institutionId ?? row?.institutionId ?? me.institutionId ?? '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body: Record<string, unknown> = {};
    for (const f of all) {
      const v = values[f.k];
      if (f.type === 'tags') body[f.k] = typeof v === 'string' ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : v;
      else if (f.type === 'password') { if (v) body.password = v; }
      else if (f.type === 'file') { if (v) { body.fileData = v; body.fileName = values.__fileName; } }
      else body[f.k] = v === '' && f.optional ? null : v;
    }
    try {
      if (row) await put(`${entity}/${row.id}`, body); else await post(entity, body);
      onSaved();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <Modal open title={`${row ? 'Tahrirlash' : 'Yangi yozuv'} · ${sc.title}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {all.map((f) => {
          const v = values[f.k];
          const set = (x: unknown) => setValues((s) => ({ ...s, [f.k]: x }));
          let input: React.ReactNode;
          if (f.type === 'select') input = <select className="input" value={String(v ?? '')} onChange={(e) => set(e.target.value)} required={f.req}>{Object.entries(f.options ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
          else if (f.type === 'ref') {
            const list = (refs[f.ref!] ?? []).filter((r) => f.ref === 'institutions' || !instOf || r.institutionId === instOf);
            input = <select className="input" value={String(v ?? '')} onChange={(e) => set(e.target.value)} required={f.req}><option value="">—</option>{list.map((r) => <option key={r.id} value={r.id}>{nameOf([r], r.id)}</option>)}</select>;
          } else if (f.type === 'password') input = <input className="input" type="password" autoComplete="new-password" minLength={8} required={!row && entity === 'users'} value={String(v ?? '')} onChange={(e) => set(e.target.value)} />;
          else if (f.type === 'tags') input = <input className="input" value={Array.isArray(v) ? v.join(', ') : String(v ?? '')} onChange={(e) => set(e.target.value)} />;
          else if (f.type === 'file') input = (
            <input className="input py-2" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { setError('Fayl 5 MB dan katta'); return; }
              const r = new FileReader();
              r.onload = () => setValues((s) => ({ ...s, fileData: r.result, __fileName: file.name }));
              r.readAsDataURL(file);
            }} />
          );
          else input = <input className="input" type={f.type ?? 'text'} value={String(v ?? '')} onChange={(e) => set(e.target.value)} required={f.req} />;
          return <label key={f.k} className={`label ${f.full ? 'sm:col-span-2' : ''}`}>{f.label}{f.req ? ' *' : ''}{input}</label>;
        })}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy}>Saqlash</button>
        </div>
      </form>
    </Modal>
  );
}
