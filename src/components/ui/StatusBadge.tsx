const MAP: Record<string, [string, string]> = {
  active: ['bg-emerald-50 text-emerald-700 ring-emerald-600/15', 'faol'],
  blocked: ['bg-red-50 text-red-700 ring-red-600/15', 'bloklangan'],
  inactive: ['bg-amber-50 text-amber-700 ring-amber-600/15', 'nofaol'],
  approved: ['bg-emerald-50 text-emerald-700 ring-emerald-600/15', 'tasdiqlangan'],
  pending: ['bg-amber-50 text-amber-700 ring-amber-600/15', 'moderatsiyada'],
  rejected: ['bg-red-50 text-red-700 ring-red-600/15', 'rad etilgan'],
  published: ['bg-emerald-50 text-emerald-700 ring-emerald-600/15', 'nashr'],
  draft: ['bg-slate-100 text-slate-600 ring-slate-500/15', 'qoralama'],
  online: ['bg-emerald-50 text-emerald-700 ring-emerald-600/15', 'onlayn'],
  offline: ['bg-red-50 text-red-700 ring-red-600/15', 'oflayn'],
  completed: ['bg-sky-50 text-sky-700 ring-sky-600/15', 'yakunlangan'],
};

export function StatusBadge({ value }: { value: string }) {
  const [cls, label] = MAP[value] ?? ['bg-slate-100 text-slate-600 ring-slate-500/15', value];
  return <span className={`badge ring-1 ring-inset ${cls}`}>{label}</span>;
}
