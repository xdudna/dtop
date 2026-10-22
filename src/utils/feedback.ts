import { ElMessage, ElMessageBox } from 'element-plus';
import { showConfirmDialog, showToast } from 'vant';

import { BREAKPOINT } from '@/constants';

export type FeedbackType = 'info' | 'success' | 'warning' | 'error';

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < BREAKPOINT;
}

/** 统一的轻提示：移动端 Vant，桌面端 Element Plus */
export function toast(message: string, type: FeedbackType = 'info'): void {
  if (isMobileViewport()) {
    const vantType = type === 'error' || type === 'warning' ? 'fail' : type === 'success' ? 'success' : 'text';
    showToast({ message, type: vantType, duration: 1800, position: 'bottom' });
    return;
  }
  ElMessage({ message, type, duration: 1800, grouping: true });
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 统一的确认弹窗，返回是否确认 */
export async function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const title = options.title ?? '确认操作';

  if (isMobileViewport()) {
    try {
      await showConfirmDialog({
        title,
        message: options.message,
        confirmButtonText: options.confirmText ?? '确定',
        cancelButtonText: options.cancelText ?? '取消',
        confirmButtonColor: options.danger ? '#dc2626' : undefined
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await ElMessageBox.confirm(options.message, title, {
      confirmButtonText: options.confirmText ?? '确定',
      cancelButtonText: options.cancelText ?? '取消',
      type: options.danger ? 'warning' : 'info',
      draggable: true
    });
    return true;
  } catch {
    return false;
  }
}
