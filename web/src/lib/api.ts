const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
if (!API_BASE_URL) throw new Error('Missing VITE_API_BASE_URL');

// Carries the HTTP status alongside the message so callers can branch on
// specific codes (e.g. 409 conflict from the Decision unique constraint)
// without parsing the message string.
//
// status === 0 is reserved for a network-level failure — the request never
// reached the server (offline, DNS, CORS, server down), so fetch() itself
// rejected rather than returning a response with a status.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
    // The server's own error string, when it sent one worth showing a user.
    // Zod validation failures send an object here instead, which we ignore.
    public readonly serverMessage?: string,
  ) {
    super(message ?? `API error: ${status}`);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  // Single source of truth for plain-language, end-user-facing copy. Screens
  // should render this rather than inventing their own wording, so the same
  // failure reads the same everywhere. Prefers the server's intentional 4xx
  // message; never surfaces a raw 5xx (those are generic by construction).
  get userMessage(): string {
    if (this.isNetworkError) {
      return "We couldn't reach the server. Check your internet connection and try again.";
    }
    if (this.status >= 500) {
      return 'The server ran into a problem. This is usually temporary — please try again.';
    }
    if (this.serverMessage) return this.serverMessage;
    if (this.status === 401) return 'Your session has expired. Please sign in again.';
    if (this.status === 403) return "You don't have access to this.";
    if (this.status === 404) return "We couldn't find what you were looking for.";
    if (this.status === 429) return 'Too many requests right now — wait a moment and try again.';
    return 'Something went wrong with that request. Please try again.';
  }
}

// Pulls a human-readable message out of an error response body, if the server
// sent a string `error`. Returns undefined for object errors (Zod flatten),
// empty, or non-JSON bodies, so userMessage falls back to status-based copy.
async function readServerMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as unknown;
    if (body && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  } catch {
    // non-JSON or empty body — nothing usable to show
  }
  return undefined;
}

export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  } catch {
    // fetch only rejects on a network-level failure, never on a 4xx/5xx
    // response — those come back as a Response with res.ok === false below.
    throw new ApiError(0, `Network request to ${path} failed`);
  }

  if (!res.ok) {
    const serverMessage = await readServerMessage(res);
    throw new ApiError(res.status, serverMessage ?? `API error: ${res.status}`, serverMessage);
  }
  // 204 No Content has no body — calling .json() on it would throw.
  // Callers that expect void from a 204 endpoint just get undefined cast
  // to T, which TypeScript can verify via the generic.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
