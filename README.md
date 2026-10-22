# dtop · 多端 TOTP 验证器

纯静态、本地优先的双因素（TOTP / Steam Guard）验证器。同一个代码库自动适配移动端与桌面端，数据保存在浏览器本地，并可通过 GitHub Gist / GitLab Snippet 端到端加密同步。

> 需求与设计依据：[DEVELOPMENT.md](./DEVELOPMENT.md)

## 功能

- **TOTP**：SHA1 / SHA256 / SHA512，30 秒（可配置 10–300 秒），6 / 8 位验证码
- **Steam Guard**：5 位字符、30 秒刷新
- **条目管理**：新增 / 编辑（页内弹窗，URL 不变）/ 删除、分组、备注、搜索、分组筛选、滑动删除（移动端）
- **实时验证码**：横向轮盘（左灰上一条 / 中间大号当前 / 右灰下一条），换码时横向滚动；窄卡片自动切换为上中下布局；剩余 ≤3 秒时当前码淡红闪烁；本地 Web Crypto 计算，点击复制
- **统一时间条**：页面顶部显示当前时间与 30 秒时间窗口；30 秒模式不再显示每条单独的倒计时条，自定义周期仍保留
- **双端 UI**：< 768px 使用 Vant 4 移动端（卡片支持一行 1 / 2 条），≥ 768px 使用 Element Plus 桌面端
- **桌面布局**：侧边栏可收起为图标模式；卡片固定宽度，一行显示数量随窗口宽度自适应
- **主题**：跟随系统 / 浅色 / 深色，CSS 变量驱动
- **安全选项**：隐藏验证码（模糊显示）、复制后定时清空剪贴板
- **备份**：JSON 导出 / 导入（合并或覆盖）
- **加密同步**：AES-GCM 256 + PBKDF2（100000 次）加密后写入 GitHub Gist / GitLab Snippet，支持版本检测、手动拉取 / 推送、自动推送
- **otpauth 识别**：密钥输入框直接粘贴 `otpauth://` 链接自动填充
- **存储降级**：IndexedDB 不可用时自动回退到 localStorage

## 技术栈

Vue 3 + TypeScript + Vite · Vue Router 4 · Pinia · Vant 4 · Element Plus · SCSS · Web Crypto API · IndexedDB

## 开发

```bash
npm install       # 安装依赖
npm run dev       # 开发服务器 http://localhost:5173
npm run build     # 类型检查 + 构建静态产物到 dist/
npm run preview   # 预览构建结果
npm run test      # 运行 TOTP / 加解密 / 解析单元测试
```

构建产物是纯静态 HTML/CSS/JS，可直接部署到 GitHub Pages、Vercel、Netlify、Cloudflare Pages 或任意静态服务器（`vite.config.ts` 使用相对路径 `base: './'`，支持子目录部署）。

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`，推送到 `main` 后自动构建并发布。

1. 在 GitHub 新建一个空仓库，然后关联并推送：

   ```bash
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. 进入仓库 **Settings → Pages → Build and deployment**，把 **Source** 设为 **GitHub Actions**。
3. 在 **Actions** 页等待 `Deploy to GitHub Pages` 执行完成，访问 `https://<你的用户名>.github.io/<仓库名>/`。
4. 之后每次推送 `main` 都会自动更新；也可以在 Actions 页手动运行 `Run workflow`。

说明：

- Vite 使用 `base: './'` 和 hash 路由（`#/`），部署在 `/<仓库名>/` 子路径下无需额外改配置。
- 工作流使用官方 Pages Actions 上传 `dist/`，不需要 `gh-pages` 分支，也不需要把构建产物提交到仓库。

## 同步配置

1. 准备 Token：
   - GitHub：Settings → Developer settings → Personal access tokens，勾选 `gist` 权限
   - GitLab：Preferences → Access Tokens，勾选 `api` 权限
2. 打开「同步」页，选择平台并填入 Token。
3. 首次点击「推送到远端」会弹窗设置加密密钥（至少 8 位，可一键生成随机密钥），并自动创建**私有** Gist / Snippet、回填 ID。
4. 其他设备填入相同的 Token，点击「拉取覆盖本地」后在弹窗输入密钥；解密成功才会导入。
5. 推送时同样在弹窗输入密钥，系统会先用远端最新密文验证密钥，一致后才加密本地数据并上传。

说明：

- 加密密钥只保存在内存中，刷新页面即清除，不会写入 localStorage 或上传远端。
- 同步范围包括名称、服务商、分组、**备注**与高级参数；备注会随条目一起加密同步，并非仅本地保存。
- 远端只保存 `totp-meta.json`（版本、时间、校验和）与 `totp-data.json`（AES-GCM 密文）；GitLab 将两者合并为单个 Snippet 文件。
- 推送前会比对远端版本，远端更新时默认拒绝覆盖，需要二次确认强制推送。
- 一旦绑定远端（Gist / Snippet），在解除关联前不能切换同步平台，API 地址、PAT、Gist / Snippet ID 也会锁定，避免误改。
- 加密密钥不再保存在配置表单中，而是在拉取 / 推送时通过弹窗输入；拉取用于解密远端数据，推送时先解密远端最新数据校验密钥，验证通过才上传。
- PAT 会保存在本机 localStorage 以便下次使用；如使用共享设备，请在使用后解除远端关联并清除 Token。

## 安全说明

- 验证码由浏览器本地计算，密钥不经过任何服务器。
- 同步数据使用 AES-GCM 256 位加密，密钥通过 PBKDF2-SHA256（100000 次迭代）派生，随机盐与 IV。
- 导出备份包含**明文密钥**，请妥善保管。
- 本应用没有主密码与自动锁定，安全边界依赖设备本身（锁屏密码、系统账户）。
- 输入输出不使用 `v-html`，避免 XSS 注入。

## 目录结构

```
src/
├── api/            # GitHub / GitLab API 与 HTTP 封装
├── components/     # 通用组件、移动端组件、桌面端表单
├── composables/    # useDevice / useTotpCode / useEntryForm / useNow
├── constants/      # 应用常量与错误码
├── crypto/         # TOTP 算法与 AES-GCM 加解密
├── db/             # IndexedDB 封装（含 localStorage 降级）
├── layouts/        # 移动端 / 桌面端布局
├── router/         # 路由（首页 / 同步 / 设置）
├── stores/         # totp / settings / sync / ui 状态
├── styles/         # 主题变量与全局样式
├── types/          # 数据模型
├── utils/          # Base32、剪贴板、otpauth、备份、格式化等
└── views/          # 首页 / 设置 / 同步（新增与编辑为首页弹窗）
tests/              # RFC 6238 等单元测试
scripts/            # 测试运行器（esbuild 打包后执行）
```

## 测试

`npm run test` 覆盖：

- Base32 编解码与校验
- RFC 6238 测试向量（SHA1 / SHA256 / SHA512，8 位）
- TOTP 自定义周期、Steam Guard 字符集
- AES-GCM 加解密、错误密钥、随机盐 / IV
- otpauth URI 解析、高级设置规范化
