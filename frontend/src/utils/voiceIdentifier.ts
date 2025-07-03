// 音量检测工具
export function isAudioActive(frameBuffer: ArrayBuffer, threshold = 0.02): boolean {
  const arr = new Int16Array(frameBuffer)
  let max = 0
  for (let i = 0; i < arr.length; i++) {
    max = Math.max(max, Math.abs(arr[i]) / 32768)
  }
  return max > threshold
}