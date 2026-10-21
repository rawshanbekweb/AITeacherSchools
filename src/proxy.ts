import { NextResponse, type NextRequest } from 'next/server';

// Fast redirect for signed-out visitors. This is only a UX shortcut: every page and API route
// still verifies the session and permissions on the server.
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();
  if (req.cookies.has('ait_session')) return NextResponse.next();
  const to = pathname.startsWith('/admin') ? '/admin/login' : '/login';
  const url = new URL(to, req.url);
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/classroom/:path*', '/admin/:path*'] };
