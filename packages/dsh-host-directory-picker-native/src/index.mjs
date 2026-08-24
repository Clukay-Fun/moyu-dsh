// Moyu 用 DSH 原生 OS 目录选择器替换 fixed provider：经系统对话框（macOS
// osascript / Linux Zenity / Windows COM）选择任意目录作为 workspace 根，而非强制
// 固定 $DSH_HOME/workspace。本插件只注册 directoryPicker 能力 seam；workspace 的
// 创建由 directory-flow（ui-workspace）在 pick 结果返回后负责。
import NativeDirectoryPicker from '@deepseek-ai/dsh-host-directory-picker-native'

export const name = 'moyu-directory-picker-native'
export const inject = []

export async function apply(ctx) {
  new NativeDirectoryPicker(ctx)
}
