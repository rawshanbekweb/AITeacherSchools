'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { get, post, put } from '@/lib/client/api';
import type { Lesson } from '@/lib/core/types';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';
import { useMe } from './me';
import type { Row } from './schemas';

type Draft = Omit<Lesson, 'id' | 'institutionId'> & { institutionId?: string };
const EMPTY: Draft = { title: '', subjectId: null, language: 'uz', durationMin: 30, status: 'draft', greeting: '', groupIds: [], sections: [{ title: '', sentences: [], materialId: undefined }], quiz: [], faq: [], sampleQuestions: [] };

export function LessonEditor({ lesson, readOnly }: { lesson: Lesson | null; readOnly: boolean }) {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const [L, setL] = useState<Draft>(() => (lesson ? structuredClone(lesson) : { ...EMPTY, institutionId: me.institutionId ?? undefined }));
  const [refs, setRefs] = useState<{ subjects: Row[]; groups: Row[]; materials: Row[]; institutions: Row[] }>({ subjects: [], groups: [], materials: [], institutions: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // free-text editors for list fields, parsed on save
  const [texts, setTexts] = useState(() => ({
    sections: (lesson?.sections ?? EMPTY.sections).map((s) => s.sentences.join('\n')),
    quiz: (lesson?.quiz ?? []).map((q) => q.options.map((o, k) => (k === q.answer ? '*' : '') + o).join('\n')),
    faq: (lesson?.faq ?? []).map((f) => `${f.keys.join(', ')} | ${f.a}`).join('\n'),
    samples: (lesson?.sampleQuestions ?? []).join('\n'),
  }));

  useEffect(() => {
    const names = ['subjects', 'groups', 'materials', ...(me.role === 'super_admin' ? ['institutions'] : [])] as const;
    Promise.all(names.map((n) => get<{ items: Row[] }>(`${n}?pageSize=200`).then((r) => [n, r.items] as const))).then((p) => setRefs((x) => ({ ...x, ...Object.fromEntries(p) })));
  }, [me.role]);

  const inst = L.institutionId ?? lesson?.institutionId;
  const own = (rows: Row[]) => rows.filter((r) => !inst || r.institutionId === inst);
  const up = (patch: Partial<Draft>) => setL((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    setError('');
    const quiz = L.quiz.map((q, i) => {
      const lines = (texts.quiz[i] ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
      return { ...q, options: lines.map((l) => l.replace(/^\*/, '')), answer: Math.max(0, lines.findIndex((l) => l.startsWith('*'))) };
    });
    const body = {
      ...L,
      sections: L.sections.map((s, i) => ({ ...s, materialId: s.materialId || undefined, sentences: (texts.sections[i] ?? '').split('\n').map((x) => x.trim()).filter(Boolean) })),
      quiz,
      faq: texts.faq.split('\n').map((l) => l.split('|')).filter((p) => p.length >= 2).map(([k, ...a]) => ({ keys: k.split(',').map((x) => x.trim()).filter(Boolean), a: a.join('|').trim() })),
      sampleQuestions: texts.samples.split('\n').map((x) => x.trim()).filter(Boolean),
    };
    try {
      if (lesson) await put(`lessons/${lesson.id}`, body);
      else {
        const { item } = await post<{ item: { id: string } }>('lessons', body);
        router.replace(`/admin/lessons/${item.id}`);
      }
      toast('Dars saqlandi', 'ok');
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= L.sections.length) return;
    const s = [...L.sections];
    [s[i], s[j]] = [s[j], s[i]];
    const t = [...texts.sections];
    [t[i], t[j]] = [t[j], t[i]];
    up({ sections: s });
    setTexts((x) => ({ ...x, sections: t }));
  };

  return (
    <>
      <PageHeader title={lesson ? L.title || 'Dars' : 'Yangi dars'} description="AI har bir bo‘limdagi gaplarni ketma-ket aytadi va mos materialni ko‘rsatadi. Savollarga faqat shu material va tasdiqlangan javoblar asosida javob beradi."
        actions={!readOnly && <button className="btn btn-primary" onClick={save} disabled={busy}><Save size={16} />Saqlash</button>} />
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={readOnly} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            {me.role === 'super_admin' && !lesson && (
              <label className="label sm:col-span-2">Muassasa *
                <select className="input" value={L.institutionId ?? ''} onChange={(e) => up({ institutionId: e.target.value, groupIds: [], subjectId: null })} required>
                  <option value="">—</option>{refs.institutions.map((i) => <option key={i.id} value={i.id}>{String(i.name)}</option>)}
                </select>
              </label>
            )}
            <label className="label sm:col-span-2">Mavzu *<input className="input" value={L.title} onChange={(e) => up({ title: e.target.value })} required /></label>
            <label className="label">Fan<select className="input" value={L.subjectId ?? ''} onChange={(e) => up({ subjectId: e.target.value || null })}><option value="">—</option>{own(refs.subjects).map((s) => <option key={s.id} value={s.id}>{String(s.name)}</option>)}</select></label>
            <label className="label">Til<select className="input" value={L.language} onChange={(e) => up({ language: e.target.value })}><option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option></select></label>
            <label className="label sm:col-span-2">Salomlashish (AI dars boshida aytadi)<textarea className="input" value={L.greeting} onChange={(e) => up({ greeting: e.target.value })} /></label>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Bo‘limlar</h2>
            {L.sections.map((s, i) => (
              <div key={i} className="card grid gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                  <input className="input min-w-48 flex-1" placeholder="Bo‘lim sarlavhasi" value={s.title} onChange={(e) => up({ sections: L.sections.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
                  <select className="input !w-auto min-w-48" value={s.materialId ?? ''} onChange={(e) => up({ sections: L.sections.map((x, k) => (k === i ? { ...x, materialId: e.target.value || undefined } : x)) })}>
                    <option value="">— material —</option>{own(refs.materials).filter((m) => m.status === 'approved').map((m) => <option key={m.id} value={m.id}>{String(m.title)}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" onClick={() => move(i, -1)} aria-label="Yuqoriga"><ArrowUp size={14} /></button>
                  <button type="button" className="btn btn-sm" onClick={() => move(i, 1)} aria-label="Pastga"><ArrowDown size={14} /></button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => { up({ sections: L.sections.filter((_, k) => k !== i) }); setTexts((x) => ({ ...x, sections: x.sections.filter((_, k) => k !== i) })); }} aria-label="O‘chirish"><Trash2 size={14} /></button>
                </div>
                <textarea className="input min-h-32" placeholder="Har bir gap alohida qatorda — AI ularni ketma-ket aytadi" value={texts.sections[i] ?? ''} onChange={(e) => setTexts((x) => ({ ...x, sections: x.sections.map((t, k) => (k === i ? e.target.value : t)) }))} />
              </div>
            ))}
            <button type="button" className="btn w-fit" onClick={() => { up({ sections: [...L.sections, { title: '', sentences: [] }] }); setTexts((x) => ({ ...x, sections: [...x.sections, ''] })); }}><Plus size={16} />Bo‘lim qo‘shish</button>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Nazorat savollari</h2>
            {L.quiz.map((q, i) => (
              <div key={i} className="card grid gap-3 p-4">
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Savol" value={q.q} onChange={(e) => up({ quiz: L.quiz.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                  <button type="button" className="btn btn-sm btn-danger self-center" onClick={() => { up({ quiz: L.quiz.filter((_, k) => k !== i) }); setTexts((x) => ({ ...x, quiz: x.quiz.filter((_, k) => k !== i) })); }} aria-label="O‘chirish"><Trash2 size={14} /></button>
                </div>
                <textarea className="input" placeholder={'Variantlar — har biri alohida qatorda. To‘g‘ri javob oldiga * qo‘ying'} value={texts.quiz[i] ?? ''} onChange={(e) => setTexts((x) => ({ ...x, quiz: x.quiz.map((t, k) => (k === i ? e.target.value : t)) }))} />
                <input className="input" placeholder="Izoh (javobdan keyin aytiladi)" value={q.explain ?? ''} onChange={(e) => up({ quiz: L.quiz.map((x, k) => (k === i ? { ...x, explain: e.target.value } : x)) })} />
              </div>
            ))}
            <button type="button" className="btn w-fit" onClick={() => { up({ quiz: [...L.quiz, { q: '', options: [], answer: 0, explain: '' }] }); setTexts((x) => ({ ...x, quiz: [...x.quiz, ''] })); }}><Plus size={16} />Savol qo‘shish</button>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="card grid gap-4 p-5">
            <label className="label">Holat<select className="input" value={L.status} onChange={(e) => up({ status: e.target.value as Draft['status'] })}><option value="draft">Qoralama</option><option value="published">Nashr (Classroom’da ko‘rinadi)</option></select></label>
            <label className="label">Davomiyligi (daq.)<input className="input" type="number" min={5} max={240} value={L.durationMin} onChange={(e) => up({ durationMin: Number(e.target.value) })} /></label>
            <div className="label">Guruhlar
              <div className="flex flex-wrap gap-2">
                {own(refs.groups).map((g) => (
                  <label key={g.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700">
                    <input type="checkbox" checked={L.groupIds.includes(g.id)} onChange={(e) => up({ groupIds: e.target.checked ? [...L.groupIds, g.id] : L.groupIds.filter((x) => x !== g.id) })} />{String(g.name)}
                  </label>
                ))}
              </div>
            </div>
          </section>
          <section className="card grid gap-3 p-5">
            <label className="label">Tasdiqlangan javoblar (oflayn AI)<span className="text-xs font-normal text-slate-400">Har qatorda: kalit so‘zlar | javob</span><textarea className="input min-h-40" value={texts.faq} onChange={(e) => setTexts((x) => ({ ...x, faq: e.target.value }))} /></label>
            <label className="label">Namuna savollar<span className="text-xs font-normal text-slate-400">Har qatorda bittadan — Classroom’da tezkor tugma bo‘ladi</span><textarea className="input" value={texts.samples} onChange={(e) => setTexts((x) => ({ ...x, samples: e.target.value }))} /></label>
          </section>
        </aside>
      </fieldset>
    </>
  );
}
