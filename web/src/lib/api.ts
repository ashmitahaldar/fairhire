const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
if (!API_BASE_URL) throw new Error('Missing VITE_API_BASE_URL');

// Carries the HTTP status alongside the message so callers can branch on
// specific codes (e.g. 409 conflict from the Decision unique constraint)
// without parsing the message string.
export class ApiError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `API error: ${status}`);
    this.name = 'ApiError';
  }
}

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
  if (!res.ok) throw new ApiError(res.status);
  // 204 No Content has no body — calling .json() on it would throw.
  // Callers that expect void from a 204 endpoint just get undefined cast
  // to T, which TypeScript can verify via the generic.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
