export function Logo({ subtitle, dark = false, size = 40 }: { subtitle?: string; dark?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid place-items-center rounded-xl font-extrabold text-ink-950"
        style={{ width: size, height: size, background: 'conic-gradient(from 210deg,#ffb547,#ff6b6b,#6c8cff,#3ddc97,#ffb547)', fontSize: size * 0.36 }}
      >
        AI
      </span>
      <div className="leading-tight">
        <b className={`block text-[1.05rem] ${dark ? 'text-white' : 'text-slate-900'}`}>AI Teacher</b>
        {subtitle && <small className={dark ? 'text-slate-400' : 'text-slate-500'}>{subtitle}</small>}
      </div>
    </div>
  );
}
