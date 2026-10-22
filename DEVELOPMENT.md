# 多端 TOTP Web 应用 - 开发文档

## 项目概述

开发一个多平台（移动端 + 桌面端）的 TOTP（Time-based One-Time Password）Web 应用，无需服务器，采用纯静态架构。用户可以在本地管理 TOTP 认证信息，并选择性地同步到 GitHub/GitLab Gist。

**项目目录名：** `dtop`

---

## 一、技术架构

### 1.1 技术栈

```
前端框架：Vue 3 + TypeScript
构建工具：Vite（需要 Node.js + npm/pnpm）
UI 框架：Vant 4（移动端）+ Element Plus（桌面端），根据设备宽度自动切换
状态管理：Pinia
路由：Vue Router 4
TOTP 实现：自实现（基于 Web Crypto API）
存储：IndexedDB（主数据）+ localStorage（配置）
CSS 方案：SCSS，使用 CSS 变量管理主题
部署：纯静态站点（可部署到 GitHub Pages、Vercel、Netlify 等）
```

> **说明：** 项目采用 npm/pnpm 管理依赖，Vite 作为构建工具。开发完成后，`npm run build` 会将项目编译为纯静态 HTML/CSS/JS 文件，可以部署到任何静态托管服务，无需服务器。使用 npm 仅在开发和构建阶段需要，最终产物是纯静态文件。

### 1.2 项目结构
```
totp-web/
├── public/
│   └── index.html
├── src/
│   ├── api/
│   │   ├── github.ts          # GitHub Gist API
│   │   └── gitlab.ts          # GitLab Gist API
│   ├── components/
│   │   ├── common/            # 通用组件
│   │   ├── mobile/            # 移动端专用组件
│   │   └── desktop/           # 桌面端专用组件
│   ├── composables/           # 组合式函数
│   ├── constants/             # 常量定义
│   ├── crypto/                # 加密相关
│   │   ├── encrypt.ts         # 数据加密
│   │   ├── decrypt.ts         # 数据解密
│   │   └── totp.ts            # TOTP 算法实现
│   ├── layouts/               # 布局组件
│   ├── router/                # 路由配置
│   ├── stores/                # Pinia 状态管理
│   │   ├── totpStore.ts       # TOTP 数据管理
│   │   ├── syncStore.ts       # 同步配置
│   │   └── settingsStore.ts   # 应用设置
│   ├── styles/                # 样式文件
│   ├── types/                 # TypeScript 类型定义
│   ├── utils/                 # 工具函数
│   └── views/                 # 页面视图
│       ├── Home.vue           # 主页
│       ├── AddEdit.vue        # 新增/编辑页面
│       ├── Settings.vue       # 设置页面
│       └── Sync.vue           # 同步配置页面
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 二、数据模型

### 2.1 TOTP 条目类型定义

```typescript
// src/types/totp.ts

export interface TotpEntry {
  id: string;                    // 唯一 ID
  name: string;                  // TOTP 名称
  issuer: string;                // 服务商
  group: string;                 // 分组（可选，为空时归入"默认"分组）
  note: string;                  // 备注
  secret: string;                // 密钥（Base32 编码）
  advanced: TotpAdvanced;        // 高级设置
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  order: number;                 // 排序顺序
}

export interface TotpAdvanced {
  type: TotpType;                // TOTP 类型
  algorithm: HashAlgorithm;      // 哈希函数
  period: number;                // 刷新间隔（秒）
  digits: number;                // 位数
}

export type TotpType = 'TOTP' | 'STEAM';

export type HashAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

// 默认值
export const DEFAULT_ADVANCED: TotpAdvanced = {
  type: 'TOTP',
  algorithm: 'SHA1',
  period: 30,
  digits: 6
};
```

### 2.2 同步配置类型定义

```typescript
// src/types/sync.ts

export interface SyncConfig {
  enabled: boolean;              // 是否启用同步
  provider: 'github' | 'gitlab'; // 同步平台
  baseUrl: string;               // API 基础 URL（支持私有化部署）
  pat: string;                   // Personal Access Token
  gistId: string;                // Gist ID
  encryptionKey: string;         // 加密密钥（不存储，仅运行时使用）
}

// 同步数据版本文件（明文）
export interface SyncMeta {
  version: number;               // 数据版本号
  lastSyncTime: number;          // 最后同步时间
  checksum: string;              // 数据校验和
}

// 同步数据文件（加密后）
export interface SyncPayload {
  version: number;               // 数据版本
  encryptedData: string;         // 加密后的数据
  iv: string;                    // 初始化向量
  salt: string;                  // 密钥盐值
}
```

---

## 三、功能模块设计

### 3.1 TOTP 条目管理

#### 3.1.1 新增 TOTP 条目

**表单字段：**
1. **名称** (必填) - TOTP 名称
2. **服务商** (必填) - 服务商名称（如：Google、GitHub）
3. **分组** (可选) - 分类分组
4. **备注** (可选) - 备注信息
5. **密钥** (必填) - Base32 编码的密钥
6. **高级设置** (默认折叠) - 点击展开后可配置：
   - 算法类型：TOTP / STEAM
   - 哈希函数：SHA1 / SHA256 / SHA512
   - 刷新间隔：默认 30 秒
   - 位数：默认 6 位

**表单验证规则：**
- 名称：必填，最大 100 字符
- 服务商：必填，最大 100 字符
- 密钥：必填，Base32 格式验证（A-Z, 2-7）
- 刷新间隔：10-300 秒
- 位数：6 或 8

#### 3.1.2 TOTP 计算实现

```typescript
// src/crypto/totp.ts

export async function generateTotp(
  secret: string,
  options: TotpAdvanced,
  timestamp: number = Date.now()
): Promise<string> {
  // STEAM 特殊处理
  if (options.type === 'STEAM') {
    return generateSteamTotp(secret, timestamp);
  }
  
  // 标准 TOTP 实现
  const counter = Math.floor(timestamp / 1000 / options.period);
  return await hotp(secret, counter, options.digits, options.algorithm);
}

export async function hotp(
  secret: string,
  counter: number,
  digits: number,
  algorithm: HashAlgorithm
): Promise<string> {
  // 生成 HOTP 码
  const key = base32Decode(secret);
  const counterBuffer = counterToBuffer(counter);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  
  const hash = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(hash);
  
  // 动态截断
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  // 生成指定位数的码
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export async function generateSteamTotp(
  secret: string,
  timestamp: number
): Promise<string> {
  // Steam Guard 算法实现
  const time = Math.floor(timestamp / 1000 / 30);
  const key = base32Decode(secret);
  
  // STEAM 使用特定的字符集
  const steamChars = '23456789BCDFGHJKMNPQRTVWXY';
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA1' },
    false,
    ['sign']
  );
  
  const counterBuffer = counterToBuffer(time);
  const hash = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(hash);
  
  const offset = hmac[hmac.length - 1] & 0x0f;
  let fullCode = 
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += steamChars[fullCode % steamChars.length];
    fullCode = Math.floor(fullCode / steamChars.length);
  }
  
  return code;
}
```

### 3.2 数据存储

使用 IndexedDB 存储主要数据，localStorage 存储配置：

```typescript
// src/stores/totpStore.ts

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TotpEntry } from '@/types/totp';

export const useTotpStore = defineStore('totp', () => {
  const entries = ref<TotpEntry[]>([]);
  const groups = ref<string[]>([]);
  
  // 加载所有数据
  async function loadEntries() {
    // 从 IndexedDB 加载
  }
  
  // 添加条目
  async function addEntry(entry: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    // 添加到数据库
  }
  
  // 更新条目
  async function updateEntry(id: string, data: Partial<TotpEntry>) {
    // 更新数据库
  }
  
  // 删除条目
  async function deleteEntry(id: string) {
    // 从数据库删除
  }
  
  // 导出数据（用于同步）
  function exportData(): TotpEntry[] {
    return [...entries.value];
  }
  
  // 导入数据
  async function importData(data: TotpEntry[]) {
    // 导入到数据库
  }
  
  return {
    entries,
    groups,
    loadEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    exportData,
    importData
  };
});
```

---

## 四、同步功能设计

### 4.1 GitHub Gist API

```typescript
// src/api/github.ts

const GITHUB_API_URL = 'https://api.github.com';

export interface GitHubGistFile {
  filename: string;
  type: string;
  language: string;
  raw_url: string;
  size: number;
  content: string;
  truncated: boolean;
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

export class GitHubApi {
  private baseUrl: string;
  private pat: string;
  
  constructor(pat: string, baseUrl: string = GITHUB_API_URL) {
    this.baseUrl = baseUrl;
    this.pat = pat;
  }
  
  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // 创建 Gist
  async createGist(description: string, files: Record<string, { content: string }>, isPublic: boolean = false): Promise<GitHubGist> {
    return this.request('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description,
        public: isPublic,
        files
      })
    });
  }
  
  // 获取 Gist
  async getGist(gistId: string): Promise<GitHubGist> {
    return this.request(`/gists/${gistId}`);
  }
  
  // 更新 Gist
  async updateGist(gistId: string, description: string, files: Record<string, { content: string }>): Promise<GitHubGist> {
    return this.request(`/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description,
        files
      })
    });
  }
  
  // 列出用户的所有 Gist
  async listGists(): Promise<GitHubGist[]> {
    return this.request('/gists');
  }
}
```

### 4.2 GitLab Gist API

```typescript
// src/api/gitlab.ts

export class GitLabApi {
  private baseUrl: string;
  private pat: string;
  
  constructor(pat: string, baseUrl: string = 'https://gitlab.com/api/v4') {
    this.baseUrl = baseUrl;
    this.pat = pat;
  }
  
  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.pat}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // 创建 Snippet（GitLab 的 Gist 等价物）
  async createSnippet(title: string, content: string, visibility: 'private' | 'internal' | 'public' = 'private') {
    return this.request('/snippets', {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        visibility
      })
    });
  }
  
  // 获取 Snippet
  async getSnippet(snippetId: string) {
    return this.request(`/snippets/${snippetId}`);
  }
  
  // 更新 Snippet
  async updateSnippet(snippetId: string, title: string, content: string) {
    return this.request(`/snippets/${snippetId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        content
      })
    });
  }
  
  // 获取 Snippet 文件内容
  async getSnippetContent(snippetId: string, filePath: string) {
    return this.request(`/snippets/${snippetId}/files/raw?ref=main&file_path=${encodeURIComponent(filePath)}`);
  }
}
```

### 4.3 加密/解密实现

```typescript
// src/crypto/encrypt.ts

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

// 生成密钥
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // 使用 PBKDF2 派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 加密数据
export async function encryptData(
  data: string,
  password: string
): Promise<EncryptionResult> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoder.encode(data)
  );
  
  return {
    encryptedData: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

// 解密数据
export async function decryptData(
  encryptedData: string,
  iv: string,
  salt: string,
  password: string
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedData);
  const ivBuffer = base64ToArrayBuffer(iv);
  const saltBuffer = base64ToArrayBuffer(salt);
  
  const key = await deriveKey(password, new Uint8Array(saltBuffer));
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer)
    },
    key,
    encryptedBuffer
  );
  
  return new TextDecoder().decode(decryptedBuffer);
}

// 工具函数
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

### 4.4 同步流程

```typescript
// src/stores/syncStore.ts

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { GitHubApi } from '@/api/github';
import { GitLabApi } from '@/api/gitlab';
import { encryptData, decryptData } from '@/crypto/encrypt';
import { useTotpStore } from './totpStore';
import type { SyncConfig, SyncMeta, SyncPayload } from '@/types/sync';

export const useSyncStore = defineStore('sync', () => {
  const config = ref<SyncConfig>({
    enabled: false,
    provider: 'github',
    baseUrl: '',
    pat: '',
    gistId: '',
    encryptionKey: ''
  });
  
  const localVersion = ref<number>(0);
  const remoteVersion = ref<number>(0);
  
  // 初始化同步配置
  async function initSync() {
    // 从 localStorage 加载配置
    const saved = localStorage.getItem('syncConfig');
    if (saved) {
      config.value = { ...config.value, ...JSON.parse(saved) };
    }
  }
  
  // 检查远端更新
  async function checkForUpdates(): Promise<boolean> {
    if (!config.value.enabled) return false;
    
    try {
      const api = getApi();
      const gist = await api.getGist(config.value.gistId);
      
      // 获取版本文件
      const metaFile = gist.files['totp-meta.json'];
      if (!metaFile) return false;
      
      const remoteMeta: SyncMeta = JSON.parse(metaFile.content);
      remoteVersion.value = remoteMeta.version;
      
      // 本地版本从 localStorage 读取
      localVersion.value = parseInt(localStorage.getItem('localVersion') || '0');
      
      // 远端版本更大时提示更新
      return remoteVersion.value > localVersion.value;
    } catch (error) {
      console.error('检查更新失败:', error);
      return false;
    }
  }
  
  // 从远端同步数据
  async function syncFromRemote(encryptionKey: string): Promise<boolean> {
    try {
      const api = getApi();
      const gist = await api.getGist(config.value.gistId);
      
      // 获取版本信息
      const metaFile = gist.files['totp-meta.json'];
      if (!metaFile) throw new Error('版本文件不存在');
      
      const meta: SyncMeta = JSON.parse(metaFile.content);
      
      // 获取加密数据
      const dataFile = gist.files['totp-data.json'];
      if (!dataFile) throw new Error('数据文件不存在');
      
      const payload: SyncPayload = JSON.parse(dataFile.content);
      
      // 解密数据
      const decrypted = await decryptData(
        payload.encryptedData,
        payload.iv,
        payload.salt,
        encryptionKey
      );
      
      const data = JSON.parse(decrypted);
      
      // 导入数据
      const totpStore = useTotpStore();
      await totpStore.importData(data);
      
      // 更新本地版本
      localStorage.setItem('localVersion', meta.version.toString());
      
      return true;
    } catch (error) {
      console.error('同步失败:', error);
      throw error;
    }
  }
  
  // 上传数据到远端
  async function syncToRemote(encryptionKey: string): Promise<boolean> {
    try {
      const totpStore = useTotpStore();
      const data = totpStore.exportData();
      
      // 加密数据
      const encrypted = await encryptData(JSON.stringify(data), encryptionKey);
      
      // 准备同步数据
      const newVersion = localVersion.value + 1;
      const payload: SyncPayload = {
        version: newVersion,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        salt: encrypted.salt
      };
      
      const meta: SyncMeta = {
        version: newVersion,
        lastSyncTime: Date.now(),
        checksum: await calculateChecksum(JSON.stringify(data))
      };
      
      const api = getApi();
      const files = {
        'totp-meta.json': { content: JSON.stringify(meta, null, 2) },
        'totp-data.json': { content: JSON.stringify(payload, null, 2) }
      };
      
      if (config.value.gistId) {
        // 更新现有 Gist
        await api.updateGist(
          config.value.gistId,
          'TOTP Web - Encrypted Data',
          files
        );
      } else {
        // 创建新 Gist
        const gist = await api.createGist(
          'TOTP Web - Encrypted Data',
          files,
          false
        );
        config.value.gistId = gist.id;
      }
      
      // 保存本地版本
      localStorage.setItem('localVersion', newVersion.toString());
      localVersion.value = newVersion;
      
      return true;
    } catch (error) {
      console.error('上传失败:', error);
      throw error;
    }
  }
  
  // 获取 API 实例
  function getApi() {
    if (config.value.provider === 'github') {
      return new GitHubApi(config.value.pat, config.value.baseUrl || undefined);
    } else {
      return new GitLabApi(config.value.pat, config.value.baseUrl || undefined);
    }
  }
  
  // 计算校验和
  async function calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return arrayBufferToBase64(hash);
  }
  
  return {
    config,
    localVersion,
    remoteVersion,
    initSync,
    checkForUpdates,
    syncFromRemote,
    syncToRemote
  };
});
```

---

## 五、页面设计

### 5.1 主页面 (Home.vue)

**功能：**
- 显示所有 TOTP 条目列表
- 实时显示当前验证码
- 倒计时进度条
- 搜索功能
- 分组筛选
- 长按复制验证码

**布局：**
- 移动端：卡片列表，每行显示 TOTP 名称、服务商、验证码、倒计时
- 桌面端：表格布局，可显示更多列

### 5.2 新增/编辑页面 (AddEdit.vue)

**功能：**
- 完整的表单输入
- 高级设置默认折叠
- 表单验证
- 实时预览验证码

### 5.3 设置页面 (Settings.vue)

**功能：**
- 应用主题切换（浅色/深色）
- 数据导出/导入
- 同步配置入口

### 5.4 同步配置页面 (Sync.vue)

**功能：**
- 选择同步平台（GitHub/GitLab）
- 配置 API 地址（支持私有化部署）
- 输入 PAT
- 初次同步设置加密密钥
- 手动同步按钮
- 同步状态显示

---

## 六、UI/UX 设计要点

### 6.1 响应式设计

项目采用一套代码同时适配移动端和桌面端，使用 CSS 媒体查询 + 设备检测来切换 UI 组件：

```typescript
// src/composables/useDevice.ts

import { ref, onMounted } from 'vue';

export function useDevice() {
  const isMobile = ref(false);
  const isDesktop = ref(false);
  
  function updateDevice() {
    const width = window.innerWidth;
    isMobile.value = width < 768;
    isDesktop.value = width >= 768;
  }
  
  onMounted(() => {
    updateDevice();
    window.addEventListener('resize', updateDevice);
  });
  
  return { isMobile, isDesktop };
}
```

```scss
// 根据设备显示不同的布局
$breakpoints: (
  'mobile': 0,
  'tablet': 768px,
  'desktop': 1024px
);

.mobile-only {
  @media (min-width: 768px) {
    display: none !important;
  }
}

.desktop-only {
  @media (max-width: 767px) {
    display: none !important;
  }
}
```

**组件库切换策略：**
- 移动端（宽度 < 768px）：使用 Vant 4 组件，提供移动端原生体验
- 桌面端（宽度 >= 768px）：使用 Element Plus 组件，提供桌面端丰富交互
- 通过 `useDevice()` composable 动态切换组件

### 6.2 主题支持

- 支持浅色/深色主题
- 使用 CSS 变量管理主题色
- 遵循系统主题偏好

### 6.3 交互设计

- TOTP 验证码区域支持点击复制
- 长按显示完整信息
- 移动端滑动删除条目
- 动画过渡效果

---

## 七、安全考虑

### 7.1 数据安全
1. **本地存储**：敏感数据使用 IndexedDB，配置使用 localStorage
2. **内存安全**：加密密钥仅在内存中，页面刷新后清除
3. **传输安全**：使用 HTTPS，PAT 和加密数据仅在需要时传输
4. **XSS 防护**：避免使用 v-html，输入输出转义

### 7.2 加密安全
1. **算法**：使用 AES-GCM 256 位加密
2. **密钥派生**：使用 PBKDF2，迭代 100000 次
3. **随机性**：使用 crypto.getRandomValues 生成 IV 和盐值
4. **完整性**：使用 GCM 模式自带的完整性校验

### 7.3 会话安全
1. **无主密码机制**：应用不需要主密码，数据安全依赖设备本身的锁屏密码
2. **无自动锁定**：不启用自动锁定功能，保持登录状态
3. **内存安全**：加密密钥仅在内存中，页面刷新后清除
4. **Clipboard 风险**：复制验证码后定时清除剪贴板（可选）

---

## 八、开发计划

### 阶段 1：基础功能（2 周）
- [ ] 项目初始化和基础架构
- [ ] 数据模型定义
- [ ] TOTP 算法实现（TOTP + STEAM）
- [ ] IndexedDB 数据库封装
- [ ] 主页列表展示
- [ ] 新增/编辑页面
- [ ] 表单验证

### 阶段 2：同步功能（2 周）
- [ ] GitHub API 封装
- [ ] GitLab API 封装
- [ ] 加密/解密实现
- [ ] 同步配置页面
- [ ] 同步流程实现
- [ ] 错误处理和提示

### 阶段 3：优化完善（1 周）
- [ ] 响应式适配完善
- [ ] 深色模式
- [ ] 性能优化
- [ ] 测试和调试

### 阶段 4：部署上线（3 天）
- [ ] 构建优化
- [ ] 部署脚本
- [ ] 文档编写

---

## 九、部署方案

### 9.1 静态托管选项

| 平台 | 优点 | 缺点 |
|------|------|------|
| GitHub Pages | 免费、与代码仓库集成 | 国内访问可能不稳定 |
| Vercel | 免费额度充足、部署快 | 需要注册账号 |
| Netlify | 免费额度充足、功能丰富 | 需要注册账号 |
| Cloudflare Pages | 全球 CDN、免费 | 需要注册账号 |
| 自建服务器 | 完全可控 | 需要自己维护 |

### 9.2 Vite 构建配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  base: './',  // 相对路径，方便部署到任意子目录
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia', 'vue-router']
        }
      }
    }
  }
});
```

---

## 十、测试策略

### 10.1 单元测试
- TOTP 算法测试（使用 RFC 6238 测试向量）
- 加密/解密测试
- 工具函数测试

### 10.2 集成测试
- 同步流程测试
- 数据导入/导出测试

### 10.3 E2E 测试
- 主要用户流程测试
- 跨浏览器兼容性测试

---

## 十一、后续扩展

- [ ] 扫码添加 TOTP（QR Code Scanner）
- [ ] 多语言支持（i18n）
- [ ] 数据统计功能
- [ ] 备份/恢复功能增强
- [ ] WebAuthn 支持（硬件密钥）
- [ ] PWA 离线支持增强

---

## 附录

### A. Base32 编解码实现

```typescript
// src/utils/base32.ts

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const cleanInput = input.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  
  for (const char of cleanInput) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base32 character: ${char}`);
    
    buffer = (buffer << 5) | index;
    bitsLeft += 5;
    
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  
  return new Uint8Array(bytes);
}

export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  
  while (output.length % 8 !== 0) {
    output += '=';
  }
  
  return output;
}
```

### B. 错误码定义

```typescript
// src/constants/errors.ts

export const ERROR_CODES = {
  // 同步相关
  SYNC_NETWORK_ERROR: 'SYNC_001',
  SYNC_AUTH_FAILED: 'SYNC_002',
  SYNC_GIST_NOT_FOUND: 'SYNC_003',
  SYNC_DECRYPT_FAILED: 'SYNC_004',
  SYNC_VERSION_MISMATCH: 'SYNC_005',
  
  // 数据相关
  DATA_INVALID_FORMAT: 'DATA_001',
  DATA_ENCRYPT_FAILED: 'DATA_002',
  DATA_DECRYPT_FAILED: 'DATA_003',
  
  // 验证相关
  VALIDATION_SECRET_INVALID: 'VALID_001',
  VALIDATION_PERIOD_INVALID: 'VALID_002',
  VALIDATION_DIGITS_INVALID: 'VALID_003'
} as const;
```

---

## 十二、环境与开发工具

### 12.1 开发环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.0.0 | 运行 Vite 构建工具 |
| npm | >= 9.0.0 | 包管理器（或使用 pnpm/yarn） |
| 现代浏览器 | 最新版本 | Chrome/Edge/Firefox/Safari |

### 12.2 npm 说明

本项目使用 npm 管理开发依赖。npm 仅在开发和构建阶段需要：

- **开发阶段**：使用 `npm run dev` 启动开发服务器
- **构建阶段**：使用 `npm run build` 编译为纯静态文件
- **部署**：将 `dist/` 目录中的静态文件部署到任何静态托管服务

最终用户访问的是纯静态 HTML/CSS/JS 文件，无需 Node.js 环境。

### 12.3 项目初始化命令

```bash
# 克隆项目后，安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

---

## 开发文档版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2024-xx-xx | 初版完成 |
