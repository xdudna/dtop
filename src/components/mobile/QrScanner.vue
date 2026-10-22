<script setup lang="ts">
import jsQR from 'jsqr';
import { onBeforeUnmount, onMounted, ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import ModalShell from '@/components/ModalShell.vue';
import type { ParsedOtpAuth } from '@/utils/otpauth';
import { parseOtpauthUri } from '@/utils/otpauth';

const emit = defineEmits<{
  close: [];
  detected: [value: ParsedOtpAuth];
  manual: [];
}>();

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const status = ref<'starting' | 'scanning' | 'error'>('starting');
const message = ref('正在启动相机…');

let stream: MediaStream | null = null;
let timer: number | undefined;
let stopped = false;
let scanPaused = false;
let detected = false;

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return '相机权限被拒绝，请在浏览器设置中允许访问相机，或从相册选择';
    }
    if (error.name === 'NotFoundError') {
      return '未找到可用相机，请从相册选择图片';
    }
    if (error.name === 'NotReadableError') {
      return '相机被其他应用占用，请关闭后重试';
    }
  }
  return '无法启动相机，请检查 HTTPS 与相机权限，或从相册选择';
}

async function startCamera(): Promise<void> {
  scanPaused = false;
  status.value = 'starting';
  message.value = '正在启动相机…';

  if (!navigator.mediaDevices?.getUserMedia) {
    fail('当前浏览器不支持相机，请从相册选择或手动输入');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
  } catch (error) {
    // 某些设备不支持 facingMode 约束，退回默认相机
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch {
      fail(describeCameraError(error));
      return;
    }
  }

  if (stopped) {
    stopStream();
    return;
  }

  if (!video.value) return;

  video.value.srcObject = stream;
  try {
    await video.value.play();
  } catch {
    // 自动播放失败时仍会尝试抓帧
  }

  status.value = 'scanning';
  message.value = '将二维码放入取景框内';
  schedule();
}

function schedule(): void {
  if (stopped || scanPaused || status.value !== 'scanning') return;
  timer = window.setTimeout(scanFrame, 220);
}

function scanFrame(): void {
  if (stopped || scanPaused) return;

  const videoEl = video.value;
  const canvasEl = canvas.value;
  if (!videoEl || !canvasEl || videoEl.readyState < 2 || !videoEl.videoWidth) {
    schedule();
    return;
  }

  const width = Math.min(videoEl.videoWidth, 640);
  const height = Math.round((videoEl.videoHeight * width) / videoEl.videoWidth);
  canvasEl.width = width;
  canvasEl.height = height;

  const context = canvasEl.getContext('2d', { willReadFrequently: true });
  if (!context) {
    schedule();
    return;
  }

  context.drawImage(videoEl, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const result = jsQR(image.data, width, height, { inversionAttempts: 'attemptBoth' });

  if (result?.data) {
    const parsed = parseOtpauthUri(result.data);
    if (parsed) {
      finish(parsed);
      return;
    }
    message.value = '识别到二维码，但不是有效的 TOTP / Steam 链接';
  }

  schedule();
}

function finish(parsed: ParsedOtpAuth): void {
  if (detected) return;
  detected = true;
  stopCamera();
  emit('detected', parsed);
}

function fail(text: string): void {
  status.value = 'error';
  message.value = text;
  stopStream();
}

function stopStream(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video.value) video.value.srcObject = null;
}

function stopCamera(): void {
  stopped = true;
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  stopStream();
}

function retry(): void {
  stopCamera();
  stopped = false;
  detected = false;
  void startCamera();
}

function pickFile(): void {
  fileInput.value?.click();
}

async function handleFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  scanPaused = true;
  message.value = '正在识别图片…';

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvasEl = canvas.value;
    if (!canvasEl) throw new Error('canvas unavailable');

    canvasEl.width = width;
    canvasEl.height = height;
    const context = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('canvas context unavailable');

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const image = context.getImageData(0, 0, width, height);
    const result = jsQR(image.data, width, height, { inversionAttempts: 'attemptBoth' });

    if (result?.data) {
      const parsed = parseOtpauthUri(result.data);
      if (parsed) {
        finish(parsed);
        return;
      }
      message.value = '图片中的二维码不是有效的 TOTP / Steam 链接';
    } else {
      message.value = '未识别到二维码，请换一张清晰、完整的图片';
    }
  } catch {
    message.value = '图片读取失败，请换一张 JPG / PNG 图片';
  }

  scanPaused = false;
  schedule();
}

function close(): void {
  stopCamera();
  emit('close');
}

onMounted(() => {
  void startCamera();
});

onBeforeUnmount(() => {
  stopCamera();
});
</script>

<template>
  <ModalShell
    title="扫码添加验证码"
    subtitle="对准 otpauth:// 二维码，识别后会自动填入表单"
    :close-on-backdrop="false"
    @close="close"
  >
    <div class="scanner">
      <div class="preview" :class="{ 'is-error': status === 'error' }">
        <video ref="video" class="video" playsinline muted autoplay></video>

        <div v-if="status !== 'error'" class="overlay" aria-hidden="true">
          <span class="corner top-left"></span>
          <span class="corner top-right"></span>
          <span class="corner bottom-left"></span>
          <span class="corner bottom-right"></span>
          <span v-if="status === 'scanning'" class="scan-line"></span>
        </div>

        <div v-if="status === 'error'" class="error-overlay">
          <span class="error-icon"><AppIcon name="warning" :size="26" /></span>
          <p>{{ message }}</p>
          <button type="button" class="btn ghost small" @click="retry">重试相机</button>
        </div>
      </div>

      <p v-if="status !== 'error'" class="scanner-status" aria-live="polite">
        <AppIcon name="scan" :size="15" />
        <span>{{ message }}</span>
      </p>

      <div class="scanner-actions">
        <button type="button" class="btn ghost" @click="pickFile">
          <AppIcon name="upload" :size="15" />
          从相册选择
        </button>
        <button type="button" class="btn ghost" @click="emit('manual')">手动输入</button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        hidden
        @change="handleFile"
      />
    </div>

    <canvas ref="canvas" class="canvas" aria-hidden="true"></canvas>
  </ModalShell>
</template>

<style scoped>
.scanner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview {
  position: relative;
  aspect-ratio: 1 / 1;
  max-height: 52vh;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: #0b0e14;
}

.video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.9);
}

.top-left {
  top: 16%;
  left: 14%;
  border-right: 0;
  border-bottom: 0;
  border-radius: 6px 0 0 0;
}

.top-right {
  top: 16%;
  right: 14%;
  border-left: 0;
  border-bottom: 0;
  border-radius: 0 6px 0 0;
}

.bottom-left {
  bottom: 16%;
  left: 14%;
  border-right: 0;
  border-top: 0;
  border-radius: 0 0 0 6px;
}

.bottom-right {
  bottom: 16%;
  right: 14%;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 6px 0;
}

.scan-line {
  position: absolute;
  left: 16%;
  right: 16%;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #8b8bff, transparent);
  box-shadow: 0 0 12px rgba(139, 139, 255, 0.8);
  animation: scan-sweep 2.2s ease-in-out infinite;
}

@keyframes scan-sweep {
  0% {
    top: 20%;
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    top: 80%;
    opacity: 0;
  }
}

.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  background: rgba(10, 13, 20, 0.92);
  color: #e9edf5;
}

.error-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(248, 113, 113, 0.16);
  color: #f87171;
}

.error-overlay p {
  margin: 0;
  max-width: 280px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #b8c2d3;
}

.scanner-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.scanner-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.scanner-actions .btn {
  justify-content: center;
}

.canvas {
  display: none;
}
</style>
