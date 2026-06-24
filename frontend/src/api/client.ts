export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "");

export type QueryValue = string | number | boolean | Date | null | undefined;

export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: QueryParams;
  parseJson?: boolean;
};

type ErrorPayload = {
  detail?: unknown;
  message?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, options: { status: number; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.details = options.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, query, parseJson = true, ...init } = options;
  const requestHeaders = new Headers(headers);
  const requestBody = buildRequestBody(body, requestHeaders);

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, query), {
      ...init,
      body: requestBody,
      headers: requestHeaders
    });
  } catch (error) {
    throw new ApiError(getUnknownErrorMessage(error, "Network request failed."), {
      status: 0,
      details: error
    });
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (response.status === 204 || !parseJson) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildApiUrl(path: string, query?: QueryParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = buildQueryString(query);
  return `${API_BASE_URL}${normalizedPath}${queryString}`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildRequestBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

function buildQueryString(query?: QueryParams): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item === null || item === undefined) {
        return;
      }
      params.append(key, item instanceof Date ? item.toISOString() : String(item));
    });
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

async function buildApiError(response: Response): Promise<ApiError> {
  const fallback = `Request failed with status ${response.status}.`;
  const details = await readErrorDetails(response);

  return new ApiError(getErrorMessage(details, fallback), {
    status: response.status,
    details
  });
}

async function readErrorDetails(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch {
    return null;
  }
}

function getErrorMessage(details: unknown, fallback: string): string {
  if (typeof details === "string") {
    return details || fallback;
  }

  if (!details || typeof details !== "object") {
    return fallback;
  }

  const payload = details as ErrorPayload;
  return getDetailMessage(payload.detail) ?? getDetailMessage(payload.message) ?? fallback;
}

function getDetailMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }
        return undefined;
      })
      .filter((item): item is string => Boolean(item));
    return messages[0];
  }

  return undefined;
}

function getUnknownErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
