// Thin JSON client for the platform API (cookies carry the session).
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/' + path, {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Tarmoq bilan aloqa yo‘q');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || res.statusText);
  return data as T;
}

export const get = <T = unknown>(p: string) => api<T>('GET', p);
export const post = <T = unknown>(p: string, b?: unknown) => api<T>('POST', p, b);
export const put = <T = unknown>(p: string, b?: unknown) => api<T>('PUT', p, b);
export const del = <T = unknown>(p: string) => api<T>('DELETE', p);
