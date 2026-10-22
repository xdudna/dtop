export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

function extractMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.error_description === 'string') return record.error_description;
  return '';
}

function describeError(status: number, data: unknown): string {
  const detail = extractMessage(data);
  const suffix = detail ? `（${detail}）` : '';

  switch (status) {
    case 400:
      return `请求参数无效${suffix}`;
    case 401:
      return '认证失败：PAT 无效或已过期';
    case 403:
      return `请求被拒绝：权限不足或触发频率限制${suffix}`;
    case 404:
      return '远端资源不存在';
    case 422:
      return `请求参数无效${suffix}`;
    default:
      return `请求失败（HTTP ${status}）${suffix}`;
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const data = await readBody(response);
    if (!response.ok) {
      throw new ApiError(describeError(response.status, data), response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络或 API 地址');
    }
    throw new ApiError('网络请求失败，请检查网络、API 地址或浏览器 CORS 限制');
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function requestText(url: string, options: HttpOptions = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { ...options.headers },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new ApiError(`读取远端文件失败（HTTP ${response.status}）`, response.status);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络或 API 地址');
    }
    throw new ApiError('网络请求失败，无法读取远端文件');
  } finally {
    window.clearTimeout(timeout);
  }
}
