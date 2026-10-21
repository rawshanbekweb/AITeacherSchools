import type { Role } from './types';

export interface NavItem { id: string; title: string; icon: string; roles: Role[]; group: string }

const ADM: Role[] = ['super_admin', 'inst_admin'];
const EDU: Role[] = ['super_admin', 'inst_admin', 'director', 'teacher'];

export const ADMIN_NAV: NavItem[] = [
  { id: '', title: 'Boshqaruv paneli', icon: 'LayoutDashboard', roles: [...EDU, 'technician'], group: '' },
  { id: 'institutions', title: 'Muassasalar', icon: 'School', roles: ADM, group: 'Tuzilma' },
  { id: 'departments', title: 'Fakultet / kafedralar', icon: 'Landmark', roles: ADM, group: 'Tuzilma' },
  { id: 'groups', title: 'Sinf / guruhlar', icon: 'Users', roles: EDU, group: 'Tuzilma' },
  { id: 'students', title: 'O‘quvchilar', icon: 'Backpack', roles: EDU, group: 'Tuzilma' },
  { id: 'users', title: 'Foydalanuvchilar', icon: 'KeyRound', roles: ADM, group: 'Tuzilma' },
  { id: 'subjects', title: 'Fanlar / kurslar', icon: 'BookOpen', roles: EDU, group: 'O‘quv jarayoni' },
  { id: 'lessons', title: 'Darslar', icon: 'NotebookPen', roles: EDU, group: 'O‘quv jarayoni' },
  { id: 'materials', title: 'Materiallar', icon: 'Library', roles: EDU, group: 'O‘quv jarayoni' },
  { id: 'schedule', title: 'Dars jadvali', icon: 'CalendarDays', roles: EDU, group: 'O‘quv jarayoni' },
  { id: 'reports', title: 'Hisobotlar', icon: 'ChartColumn', roles: EDU, group: 'O‘quv jarayoni' },
  { id: 'devices', title: 'Qurilmalar', icon: 'MonitorSmartphone', roles: [...ADM, 'teacher', 'technician'], group: 'Tizim' },
  { id: 'avatar', title: 'Avatar studiyasi', icon: 'UserRoundCog', roles: ADM, group: 'Tizim' },
  { id: 'audit', title: 'Audit jurnali', icon: 'ScrollText', roles: ADM, group: 'Tizim' },
  { id: 'profile', title: 'Profil va xavfsizlik', icon: 'ShieldCheck', roles: [...EDU, 'technician'], group: 'Tizim' },
];

export const navAllowed = (id: string, role: Role) => !!ADMIN_NAV.find((n) => n.id === id)?.roles.includes(role);
export const ROLE_LABEL: Record<Role, string> = { super_admin: 'Super Admin', inst_admin: 'Muassasa admini', director: 'Direktor', teacher: 'O‘qituvchi / tarbiyachi', student: 'O‘quvchi', technician: 'Texnik xodim' };
