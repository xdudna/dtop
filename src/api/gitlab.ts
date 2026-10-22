import { ApiError, requestJson, requestText } from './http';
import type { HttpOptions } from './http';

const DEFAULT_BASE_URL = 'https://gitlab.com/api/v4';

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
}

export interface GitLabSnippetFile {
  path: string;
  raw_url: string;
}

export interface GitLabSnippet {
  id: number;
  title: string;
  description: string;
  visibility: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  files: GitLabSnippetFile[];
}

/** 兼容 gitlab.com、私有化部署和已带 /api/v4 的地址 */
export function normalizeGitLabBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE_URL;
  if (/\/api\/v\d+$/i.test(trimmed)) return trimmed;
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v4`;
  return `${trimmed}/api/v4`;
}

export class GitLabApi {
  private readonly baseUrl: string;

  constructor(
    private readonly pat: string,
    baseUrl = ''
  ) {
    this.baseUrl = normalizeGitLabBaseUrl(baseUrl);
  }

  private headers(): Record<string, string> {
    // GitLab 的 Personal Access Token 使用 PRIVATE-TOKEN 头
    return { 'PRIVATE-TOKEN': this.pat };
  }

  private request<T>(path: string, options: HttpOptions = {}): Promise<T> {
    return requestJson<T>(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options.headers }
    });
  }

  getUser(): Promise<GitLabUser> {
    return this.request<GitLabUser>('/user');
  }

  getSnippet(snippetId: string): Promise<GitLabSnippet> {
    return this.request<GitLabSnippet>(`/snippets/${encodeURIComponent(snippetId)}`);
  }

  listSnippets(perPage = 100): Promise<GitLabSnippet[]> {
    return this.request<GitLabSnippet[]>(`/snippets?per_page=${perPage}`);
  }

  async createSnippet(
    title: string,
    content: string,
    filePath = 'dtop-sync.json',
    visibility: 'private' | 'internal' | 'public' = 'private'
  ): Promise<GitLabSnippet> {
    return this.request<GitLabSnippet>('/snippets', {
      method: 'POST',
      body: {
        title,
        description: 'dtop TOTP - Encrypted Data',
        visibility,
        files: [{ file_path: filePath, content }]
      }
    });
  }

  async updateSnippet(
    snippetId: string,
    title: string,
    content: string,
    filePath = 'dtop-sync.json'
  ): Promise<GitLabSnippet> {
    const path = `/snippets/${encodeURIComponent(snippetId)}`;
    try {
      return await this.request<GitLabSnippet>(path, {
        method: 'PUT',
        body: {
          title,
          files: [{ file_path: filePath, content, action: 'update' }]
        }
      });
    } catch (error) {
      // 旧版 GitLab 只支持 content / file_name，做一次兼容回退
      if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
        return await this.request<GitLabSnippet>(path, {
          method: 'PUT',
          body: { title, content, file_name: filePath }
        });
      }
      throw error;
    }
  }

  /** 读取 Snippet 文件内容（私有 Snippet 需要带 Token） */
  async getSnippetContent(snippetId: string): Promise<string> {
    const snippet = await this.getSnippet(snippetId);
    const file = snippet.files?.[0];
    if (!file) {
      throw new ApiError('远端 Snippet 中没有文件');
    }

    const rawUrl = file.raw_url
      ? file.raw_url
      : `${this.baseUrl}/snippets/${encodeURIComponent(snippetId)}/files/HEAD/${encodeURIComponent(file.path)}/raw`;

    return requestText(rawUrl, { headers: this.headers() });
  }
}
