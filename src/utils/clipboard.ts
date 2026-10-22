/** 复制文本，优先使用异步剪贴板 API，失败时回退到隐藏 textarea */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 继续尝试回退方案
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** 复制后延迟清空剪贴板（尽力而为，页面失焦时可能失败） */
export function scheduleClipboardClear(seconds: number): void {
  if (!seconds || seconds <= 0) return;
  window.setTimeout(() => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText('').catch(() => undefined);
  }, seconds * 1000);
}
