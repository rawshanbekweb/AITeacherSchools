import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-bold">Sahifa topilmadi yoki ruxsat yo‘q</h1>
        <Link href="/" className="btn mt-6">Bosh sahifa</Link>
      </div>
    </main>
  );
}
