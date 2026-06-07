const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
if (!API_BASE_URL) throw new Error('Missing VITE_API_BASE_URL');

export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  // 204 No Content has no body — calling .json() on it would throw.
  // Callers that expect void from a 204 endpoint just get undefined cast
  // to T, which TypeScript can verify via the generic.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
