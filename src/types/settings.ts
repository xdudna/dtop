export type ThemeMode = 'auto' | 'light' | 'dark';

export type DesktopView = 'cards' | 'table';

export type MobileColumns = 1 | 2;

export interface AppSettings {
  /** 主题模式 */
  theme: ThemeMode;
  /** 是否隐藏列表中的验证码（悬停 / 点击临时显示） */
  hideCodes: boolean;
  /** 复制验证码后多少秒清空剪贴板，0 表示不清空 */
  clipboardClearSeconds: number;
  /** 桌面端首页布局：多列卡片或表格 */
  desktopView: DesktopView;
  /** 移动端每行卡片数 */
  mobileColumns: MobileColumns;
  /** 桌面端侧边栏是否收起 */
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  hideCodes: false,
  clipboardClearSeconds: 0,
  desktopView: 'cards',
  mobileColumns: 2,
  sidebarCollapsed: false
};

export const CLIPBOARD_CLEAR_OPTIONS = [0, 15, 30, 60];
