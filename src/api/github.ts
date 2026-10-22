import { requestJson } from './http';
import type { HttpOptions } from './http';

const DEFAULT_BASE_URL = 'https://api.github.com';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubGistFile {
  filename: string;
  type: string;
  language: string | null;
  raw_url: string;
  size: number;
  content?: string;
  truncated?: boolean;
}

export interface GitHubGist {
  id: string;
  html_url: string;
  description: string;
  public: boolean;
  created_at: string;
  updated_at: string;
  files: Record<string, GitHubGistFile>;
}

export interface GitHubGistFileInput {
  content: string;
}

/** 兼容 github.com、私有化部署和已带 /api/v3 的地址 */
export function normalizeGitHubBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE_URL;
  if (/^https?:\/\/api\.github\.com$/i.test(trimmed)) return trimmed;
  if (/\/api\/v3$/i.test(trimmed)) return trimmed;
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v3`;
  return `${trimmed}/api/v3`;
}

export class GitHubApi {
  private readonly baseUrl: string;

  constructor(
    private readonly pat: string,
    baseUrl = ''
  ) {
    this.baseUrl = normalizeGitHubBaseUrl(baseUrl);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  private request<T>(path: string, options: HttpOptions = {}): Promise<T> {
    return requestJson<T>(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options.headers }
    });
  }

  getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  getGist(gistId: string): Promise<GitHubGist> {
    return this.request<GitHubGist>(`/gists/${encodeURIComponent(gistId)}`);
  }

  listGists(perPage = 100): Promise<GitHubGist[]> {
    return this.request<GitHubGist[]>(`/gists?per_page=${perPage}`);
  }

  createGist(
    description: string,
    files: Record<string, GitHubGistFileInput>,
    isPublic = false
  ): Promise<GitHubGist> {
    return this.request<GitHubGist>('/gists', {
      method: 'POST',
      body: { description, public: isPublic, files }
    });
  }

  updateGist(
    gistId: string,
    description: string,
    files: Record<string, GitHubGistFileInput>
  ): Promise<GitHubGist> {
    return this.request<GitHubGist>(`/gists/${encodeURIComponent(gistId)}`, {
      method: 'PATCH',
      body: { description, files }
    });
  }
}
