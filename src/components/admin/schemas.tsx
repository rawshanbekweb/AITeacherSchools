// Declarative admin screens: columns, filters and form fields per entity.
import type { Role } from '@/lib/core/types';
import { VISUAL_IDS } from '@/lib/core/visual-ids';
import { ROLE_LABEL } from '@/lib/core/admin-nav';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type Row = Record<string, unknown> & { id: string };
export type Refs = Record<string, Row[]>;

export interface Field {
  k: string;
  label: string;
  type?: 'text' | 'select' | 'ref' | 'tags' | 'password' | 'file' | 'time' | 'number';
  options?: Record<string, string>;
  ref?: string;
  req?: boolean;
  full?: boolean;
  optional?: boolean;
  adminOnly?: boolean;
}
export interface Column { k: string; label: string; render?: (v: unknown, row: Row, refs: Refs) => React.ReactNode; superOnly?: boolean }
export interface Filter { k: string; label: string; options?: Record<string, string>; ref?: string }
export interface Schema {
  title: string;
  description?: string;
  scoped: boolean;
  write: Role[];
  cols: Column[];
  fields?: Field[];
  filters?: Filter[];
  refs?: string[];
  readOnly?: boolean;
}

export const TYPE: Record<string, string> = { kindergarten: 'Bog‘cha', school: 'Maktab', university: 'Universitet / institut' };
const ADM: Role[] = ['super_admin', 'inst_admin'];
export const nameOf = (rows: Row[] | undefined, id: unknown) => {
  const r = rows?.find((x) => x.id === id);
  return (r?.name ?? r?.title ?? r?.fullName ?? '—') as string;
};
const badge = (v: unknown) => <StatusBadge value={String(v)} />;
const inst: Column = { k: 'institutionId', label: 'Muassasa', render: (v, _r, refs) => nameOf(refs.institutions, v), superOnly: true };
const KIND: Record<string, string> = { camera: '📷 kamera', microphone: '🎙 mikrofon', speaker: '🔊 karnay', panel: '🖥 interaktiv panel', agent: '🧩 lokal agent' };

export const SCHEMAS: Record<string, Schema> = {
  institutions: {
    title: 'Muassasalar', description: 'Bitta platforma — bog‘cha, maktab va universitetlar uchun turli rejimlar.', scoped: false, write: ['super_admin'],
    cols: [{ k: 'name', label: 'Nomi' }, { k: 'type', label: 'Turi', render: (v) => TYPE[String(v)] }, { k: 'city', label: 'Shahar' }, { k: 'languages', label: 'Tillar', render: (v) => ((v as string[]) ?? []).join(', ').toUpperCase() }, { k: 'status', label: 'Holat', render: badge }],
    fields: [{ k: 'name', label: 'Nomi', req: true, full: true }, { k: 'type', label: 'Turi', type: 'select', options: TYPE, req: true }, { k: 'city', label: 'Shahar' }, { k: 'languages', label: 'Tillar (vergul bilan: uz, ru, en)', type: 'tags' }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', inactive: 'nofaol' } }],
    filters: [{ k: 'type', label: 'Turi', options: TYPE }],
  },
  departments: {
    title: 'Fakultet / kafedralar', scoped: true, write: ADM,
    cols: [inst, { k: 'name', label: 'Nomi' }],
    fields: [{ k: 'name', label: 'Nomi', req: true, full: true }],
  },
  groups: {
    title: 'Sinf / guruhlar', scoped: true, write: ADM, refs: ['departments'],
    cols: [inst, { k: 'name', label: 'Nomi' }, { k: 'level', label: 'Daraja' }, { k: 'room', label: 'Auditoriya' }, { k: 'departmentId', label: 'Bo‘lim', render: (v, _r, refs) => (v ? nameOf(refs.departments, v) : '—') }],
    fields: [{ k: 'name', label: 'Nomi', req: true }, { k: 'level', label: 'Daraja / yosh' }, { k: 'room', label: 'Auditoriya' }, { k: 'departmentId', label: 'Bo‘lim', type: 'ref', ref: 'departments', optional: true }],
  },
  students: {
    title: 'O‘quvchilar', description: 'Faqat minimal zarur ma’lumot saqlanadi (ism va guruh). Biometrik ma’lumotlar saqlanmaydi.', scoped: true, write: ADM, refs: ['groups'],
    cols: [inst, { k: 'fullName', label: 'F.I.Sh.' }, { k: 'groupId', label: 'Guruh', render: (v, _r, refs) => nameOf(refs.groups, v) }, { k: 'status', label: 'Holat', render: badge }],
    fields: [{ k: 'fullName', label: 'F.I.Sh.', req: true, full: true }, { k: 'groupId', label: 'Guruh', type: 'ref', ref: 'groups', req: true }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', inactive: 'nofaol' } }],
    filters: [{ k: 'groupId', label: 'Guruh', ref: 'groups' }, { k: 'status', label: 'Holat', options: { active: 'faol', inactive: 'nofaol' } }],
  },
  users: {
    title: 'Foydalanuvchilar', description: 'Rollar va kirish huquqlari. Bloklangan foydalanuvchining barcha seanslari darhol tugatiladi.', scoped: true, write: ADM,
    cols: [inst, { k: 'username', label: 'Login', render: (v) => <code className="text-xs">{String(v)}</code> }, { k: 'fullName', label: 'F.I.Sh.' }, { k: 'role', label: 'Rol', render: (v) => ROLE_LABEL[v as Role] }, { k: 'status', label: 'Holat', render: badge }, { k: 'totpEnabled', label: 'MFA', render: (v) => (v ? <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">yoqilgan</span> : <span className="text-slate-400">—</span>) }, { k: 'lastLoginAt', label: 'Oxirgi kirish', render: (v) => (v ? new Date(String(v)).toLocaleString('uz-UZ') : '—') }],
    fields: [{ k: 'username', label: 'Login', req: true }, { k: 'fullName', label: 'F.I.Sh.', req: true }, { k: 'role', label: 'Rol', type: 'select', options: ROLE_LABEL, req: true }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', blocked: 'bloklangan' } }, { k: 'password', label: 'Parol (kamida 8 belgi; tahrirlashda bo‘sh qoldiring)', type: 'password', full: true }],
    filters: [{ k: 'role', label: 'Rol', options: ROLE_LABEL }, { k: 'status', label: 'Holat', options: { active: 'faol', blocked: 'bloklangan' } }],
  },
  subjects: {
    title: 'Fanlar / kurslar', scoped: true, write: ADM,
    cols: [inst, { k: 'name', label: 'Nomi' }, { k: 'code', label: 'Kod' }],
    fields: [{ k: 'name', label: 'Nomi', req: true }, { k: 'code', label: 'Kod' }],
  },
  lessons: {
    title: 'Darslar', description: 'Dars rejasi: bo‘limlar, AI aytadigan matn, materiallar, nazorat savollari va tasdiqlangan javoblar.', scoped: true, write: ['super_admin', 'inst_admin', 'teacher'], refs: ['subjects', 'groups'],
    cols: [inst, { k: 'title', label: 'Mavzu' }, { k: 'subjectId', label: 'Fan', render: (v, _r, refs) => nameOf(refs.subjects, v) }, { k: 'groupIds', label: 'Guruhlar', render: (v, _r, refs) => ((v as string[]) ?? []).map((g) => nameOf(refs.groups, g)).join(', ') }, { k: 'language', label: 'Til', render: (v) => String(v).toUpperCase() }, { k: 'sections', label: 'Bo‘limlar', render: (v) => (v as unknown[]).length }, { k: 'status', label: 'Holat', render: badge }],
    filters: [{ k: 'status', label: 'Holat', options: { published: 'nashr', draft: 'qoralama' } }, { k: 'language', label: 'Til', options: { uz: 'UZ', ru: 'RU', en: 'EN' } }],
  },
  materials: {
    title: 'Materiallar', description: 'O‘qituvchi yuklagan material moderatsiyadan o‘tgach darsda ishlatiladi.', scoped: true, write: ['super_admin', 'inst_admin', 'teacher'],
    cols: [inst, { k: 'title', label: 'Nomi', render: (v, r) => <span>{String(v)}{r.hasFile ? <a className="ml-2 text-xs text-brand-700 underline" href={`/api/files/${r.id}`} target="_blank" rel="noreferrer">fayl</a> : null}</span> }, { k: 'subject', label: 'Fan' }, { k: 'topic', label: 'Mavzu' }, { k: 'level', label: 'Daraja' }, { k: 'language', label: 'Til' }, { k: 'type', label: 'Turi' }, { k: 'rights', label: 'Huquqlar' }, { k: 'status', label: 'Holat', render: badge }],
    fields: [{ k: 'title', label: 'Nomi', req: true, full: true }, { k: 'subject', label: 'Fan' }, { k: 'topic', label: 'Mavzu' }, { k: 'level', label: 'Yosh / daraja' }, { k: 'language', label: 'Til', type: 'select', options: { uz: 'uz', ru: 'ru', en: 'en' } }, { k: 'type', label: 'Turi', type: 'select', options: { animation: 'animatsiya', image: 'rasm', pdf: 'PDF', presentation: 'taqdimot', scheme: 'sxema' } }, { k: 'visual', label: 'Kutubxona animatsiyasi', type: 'select', options: Object.fromEntries([['', '—'], ...VISUAL_IDS.map((v) => [v, v])]) }, { k: 'source', label: 'Manba' }, { k: 'rights', label: 'Foydalanish huquqi' }, { k: 'status', label: 'Moderatsiya', type: 'select', options: { pending: 'moderatsiyada', approved: 'tasdiqlangan', rejected: 'rad etilgan' }, adminOnly: true }, { k: 'fileData', label: 'Fayl (rasm yoki PDF, maks. 5 MB)', type: 'file', full: true }],
    filters: [{ k: 'status', label: 'Holat', options: { approved: 'tasdiqlangan', pending: 'moderatsiyada', rejected: 'rad etilgan' } }, { k: 'language', label: 'Til', options: { uz: 'UZ', ru: 'RU', en: 'EN' } }],
  },
  schedule: {
    title: 'Dars jadvali', scoped: true, write: ADM, refs: ['groups', 'lessons'],
    cols: [inst, { k: 'day', label: 'Kun' }, { k: 'time', label: 'Vaqt' }, { k: 'groupId', label: 'Guruh', render: (v, _r, refs) => nameOf(refs.groups, v) }, { k: 'lessonId', label: 'Dars', render: (v, _r, refs) => nameOf(refs.lessons, v) }, { k: 'room', label: 'Xona' }],
    fields: [{ k: 'day', label: 'Kun' }, { k: 'time', label: 'Vaqt', type: 'time' }, { k: 'groupId', label: 'Guruh', type: 'ref', ref: 'groups', req: true }, { k: 'lessonId', label: 'Dars', type: 'ref', ref: 'lessons', req: true }, { k: 'room', label: 'Xona' }],
    filters: [{ k: 'groupId', label: 'Guruh', ref: 'groups' }],
  },
  devices: {
    title: 'Qurilmalar', description: 'Auditoriyaga biriktirilgan kamera, mikrofon, karnay va panellar holati.', scoped: true, write: ['super_admin', 'inst_admin', 'technician'],
    cols: [inst, { k: 'room', label: 'Auditoriya' }, { k: 'kind', label: 'Turi', render: (v) => KIND[String(v)] ?? String(v) }, { k: 'model', label: 'Model' }, { k: 'status', label: 'Holat', render: badge }],
    fields: [{ k: 'room', label: 'Auditoriya', req: true }, { k: 'kind', label: 'Turi', type: 'select', options: { camera: 'kamera', microphone: 'mikrofon', speaker: 'karnay', panel: 'interaktiv panel', agent: 'lokal agent' }, req: true }, { k: 'model', label: 'Model' }, { k: 'status', label: 'Holat', type: 'select', options: { online: 'onlayn', offline: 'oflayn' } }],
    filters: [{ k: 'kind', label: 'Turi', options: { camera: 'kamera', microphone: 'mikrofon', speaker: 'karnay', panel: 'panel', agent: 'agent' } }, { k: 'status', label: 'Holat', options: { online: 'onlayn', offline: 'oflayn' } }],
  },
  audit: {
    title: 'Audit jurnali', description: 'Kirishlar va muhim administrativ amallar. Parollar va shaxsiy ma’lumotlar jurnalga yozilmaydi.', scoped: true, write: [], readOnly: true,
    cols: [{ k: 'at', label: 'Vaqt', render: (v) => new Date(String(v)).toLocaleString('uz-UZ') }, { k: 'username', label: 'Foydalanuvchi' }, { k: 'action', label: 'Amal', render: (v) => <span className={`badge ring-1 ring-inset ${/fail|delete/.test(String(v)) ? 'bg-red-50 text-red-700 ring-red-600/15' : 'bg-slate-100 text-slate-700 ring-slate-500/15'}`}>{String(v)}</span> }, { k: 'entity', label: 'Obyekt' }, { k: 'details', label: 'Tafsilot' }],
    filters: [{ k: 'action', label: 'Amal', options: { 'auth.login': 'kirish', 'auth.login_failed': 'muvaffaqiyatsiz kirish', 'sessions.start': 'dars boshlandi', 'sessions.complete': 'dars yakunlandi', 'attendance.correct': 'davomat tuzatildi', 'avatar.update': 'avatar' } }],
  },
};
