import Link from 'next/link';
import { BarChart3, Bot, Clapperboard, Mic, PlayCircle, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { HeroAvatar } from '@/components/landing/HeroAvatar';

const FEATURES = [
  { icon: Bot, title: 'Jonli avatar', text: 'Bitta portretdan: lab sinxronizatsiyasi, ko‘z qisish, nigoh, bosh harakati, tabassum va nafas olish.' },
  { icon: Mic, title: 'Ovozli muloqot', text: 'Savol ovoz yoki matn bilan; dars pauzaga qo‘yiladi, javob beriladi va aynan shu joydan davom etadi.' },
  { icon: Clapperboard, title: 'Animatsion materiallar', text: 'Har bir bo‘limga mos interaktiv sahnalar: Quyosh tizimi, fotosintez, kasrlar, neyron tarmoqlar.' },
  { icon: BarChart3, title: 'Hisobot va tahlil', text: 'Davomat, o‘tilgan bo‘limlar, test natijalari va o‘qituvchiga yo‘naltirilgan savollar.' },
  { icon: ShieldCheck, title: 'Xavfsizlik', text: 'Rollar va huquqlar serverda tekshiriladi, muassasalar ajratilgan, audit jurnali yuritiladi.' },
  { icon: Sparkles, title: 'Uch xil rejim', text: 'Bog‘cha, maktab va universitet — bitta platformada, har biri o‘z interfeysi va uslubi bilan.' },
];

export default function Home() {
  return (
    <div className="dark-surface min-h-screen bg-[radial-gradient(1200px_700px_at_10%_0%,#24336b_0,transparent_60%),radial-gradient(900px_600px_at_100%_100%,#3d2412_0,transparent_60%)]">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6">
        <header className="flex items-center justify-between">
          <Logo dark subtitle="Bog‘cha · Maktab · Universitet" />
          <nav className="flex gap-2">
            <Link href="/admin" className="btn btn-ghost hidden sm:inline-flex">Admin</Link>
            <Link href="/classroom" className="btn btn-primary">Classroom</Link>
          </nav>
        </header>
        <section className="grid items-center gap-8 lg:min-h-[80vh] lg:grid-cols-[1.1fr_.9fr]">
          <div className="pt-10 lg:pt-0">
            <span className="badge bg-white/5 text-brand-400 ring-1 ring-white/10">✦ Virtual o‘qituvchi platformasi</span>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
              Darsni olib boradigan <span className="bg-gradient-to-r from-brand-400 to-rose-400 bg-clip-text text-transparent">sun’iy intellekt ustoz</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
              Jonli ko‘rinishdagi virtual o‘qituvchi o‘quv reja bo‘yicha dars o‘tadi, savollarga ovoz bilan javob beradi, mavzuga mos animatsiyalarni ko‘rsatadi, bilimni tekshiradi va hisobot tayyorlaydi. O‘qituvchi har doim nazoratda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/classroom" className="btn btn-primary btn-lg"><PlayCircle size={20} /> Darsni boshlash</Link>
              <Link href="/admin" className="btn btn-lg"><Settings2 size={20} /> Boshqaruv paneli</Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">Demo: <code className="text-slate-300">teacher / Teacher#2026</code> · Admin: <code className="text-slate-300">superadmin / Admin#2026</code></p>
          </div>
          <HeroAvatar />
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
              <Icon className="text-brand-400" size={26} />
              <h3 className="mt-3 font-bold text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
