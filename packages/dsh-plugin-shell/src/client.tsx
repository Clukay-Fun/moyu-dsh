import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

type Mod = {
  id: string
  version: string
  displayName: string
  enabled: boolean
  permissions: string[]
  integrity: 'ok' | 'missing' | 'error'
}

type KernelProbe = { status: 'passed' | 'failed'; reason?: string | null; at: string }
type KernelInfo = { version: string; dshVersion: string; channel?: string | null; notes?: string | null; probe?: KernelProbe | null; metadataUrl?: string; signatureUrl?: string; payloadUrl?: string }
type KernelState = {
  builtinVersion: string | null
  active: string | null
  previous: string | null
  installed: KernelInfo[]
  failed: Record<string, { reason?: string }>
}

async function modsRequest(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/mods', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

async function kernelRequest(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/kernel', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

// --- MOYU 设置页重构：模态壳 + 章节 + 动效 ---
// 一层叠加 CSS，直接覆盖上游 ui-settings-general 的 obfuscated class（vendored 快照下类名稳定）。
// tokens 全部 currentColor + color-mix，深/浅自动适配。动效遵 Emil：进出场 ease-out，模态 origin=center。
// 加载顺序上 MOYU shell 插件在 upstream 之后 → 同权重规则由 MOYU 胜出，无需 !important。
const MOYU_SETTINGS_CSS = `
:root {
  /* MOYU 独立 tokens */
  --moyu-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --moyu-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --moyu-radius-xl: 20px;
  --moyu-radius-lg: 12px;
  --moyu-radius-md: 8px;
  --moyu-radius-sm: 6px;
  --moyu-hairline: color-mix(in oklab, currentColor 14%, transparent);
  --moyu-hairline-soft: color-mix(in oklab, currentColor 8%, transparent);
  --moyu-fill-subtle: color-mix(in oklab, currentColor 5%, transparent);
  --moyu-fill-hover: color-mix(in oklab, currentColor 9%, transparent);
  --moyu-fill-active: color-mix(in oklab, currentColor 13%, transparent);
  --moyu-text-dim: color-mix(in oklab, currentColor 62%, transparent);
  --moyu-text-mute: color-mix(in oklab, currentColor 42%, transparent);
  --moyu-danger: color-mix(in oklab, #e05252 92%, currentColor);
  --moyu-warn: color-mix(in oklab, #d69220 92%, currentColor);
  --moyu-ok: color-mix(in oklab, #22a565 92%, currentColor);
  --moyu-accent: color-mix(in oklab, #4a89ff 88%, currentColor);

  /* 覆盖上游 tokens：一改带动全 app 的动画 */
  /* 原 Material Standard cubic-bezier(.4,0,.2,1) 起手偏慢；换更利落曲线 */
  --ds-ease-in-out: cubic-bezier(0.5, 0, 0.15, 1);
  --ds-transition-duration-slow: 0.24s;
}

/* ===== 模态壳（覆盖 FGywRq_*） ===== */
.FGywRq_overlay {
  padding: 32px;
  animation: moyu-overlay-in 220ms var(--moyu-ease-out);
}
@keyframes moyu-overlay-in { from { opacity: 0; } }

.FGywRq_mask {
  background: color-mix(in oklab, canvas 40%, transparent);
  backdrop-filter: blur(18px) saturate(1.1);
  -webkit-backdrop-filter: blur(18px) saturate(1.1);
}

.FGywRq_panel {
  width: min(920px, 100vw - 64px);
  height: min(720px, 100vh - 64px);
  border-radius: var(--moyu-radius-xl);
  border: 1px solid var(--moyu-hairline-soft);
  box-shadow:
    0 0 0 1px color-mix(in oklab, currentColor 4%, transparent),
    0 24px 64px -12px color-mix(in oklab, currentColor 28%, transparent),
    0 8px 24px -8px color-mix(in oklab, currentColor 18%, transparent);
  animation: moyu-panel-enter 260ms var(--moyu-ease-out);
  transform-origin: center;
}
@keyframes moyu-panel-enter {
  from { opacity: 0; transform: scale(0.985); }
}

/* ===== 导航栏 ===== */
.FGywRq_nav {
  width: 208px;
  padding: 22px 12px 12px;
  gap: 20px;
  border-right: 1px solid var(--moyu-hairline-soft);
  background: var(--moyu-fill-subtle);
}
.FGywRq_navTitle {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--moyu-text-mute);
  line-height: 1.5;
}
.FGywRq_navList { gap: 2px; }
.FGywRq_navCell {
  height: 34px;
  padding: 0 12px;
  gap: 10px;
  border-radius: var(--moyu-radius-md);
  color: var(--moyu-text-dim);
  font-size: 13.5px;
  font-weight: 500;
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
  position: relative;
}
.FGywRq_navCell:hover {
  background: var(--moyu-fill-hover);
  color: inherit;
}
.FGywRq_navCell:active:not(.FGywRq_active) {
  transform: scale(0.985);
}
.FGywRq_navCell.FGywRq_active {
  background: var(--moyu-fill-active);
  color: inherit;
  font-weight: 600;
}
.FGywRq_navCell.FGywRq_active::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.7;
}
.FGywRq_navIcon { opacity: 0.72; }
.FGywRq_navCell.FGywRq_active .FGywRq_navIcon { opacity: 1; }

/* ===== 内容区 ===== */
.FGywRq_content { background: transparent; }
.FGywRq_header {
  height: 60px;
  padding: 20px 24px 8px;
  border-bottom: 1px solid var(--moyu-hairline-soft);
}
.FGywRq_close {
  width: 30px; height: 30px;
  border-radius: 999px;
  transition: background 140ms ease, transform 140ms var(--moyu-ease-out);
}
.FGywRq_close:hover { background: var(--moyu-fill-hover); }
.FGywRq_close:active { transform: scale(0.94); }

.FGywRq_options {
  padding: 24px 40px 40px;
  scrollbar-gutter: stable;
}
.FGywRq_options > * {
  animation: moyu-section-in 220ms var(--moyu-ease-out) both;
}
@keyframes moyu-section-in {
  from { opacity: 0; transform: translateY(4px); }
}

/* ===== 上游 EnterBehaviorRow 一致化（oqKHGa_*） ===== */
.oqKHGa_row {
  border-bottom: 1px solid var(--moyu-hairline-soft);
  padding: 14px 0;
  gap: 16px;
}
.oqKHGa_rowText { gap: 4px; padding-right: 24px; }
.oqKHGa_title { font-size: 14px; font-weight: 500; }
.oqKHGa_desc { color: var(--moyu-text-dim); font-size: 12.5px; line-height: 1.55; }
.oqKHGa_selector {
  background: var(--moyu-fill-subtle);
  border: 1px solid var(--moyu-hairline);
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms var(--moyu-ease-out);
}
.oqKHGa_selector:hover { background: var(--moyu-fill-hover); }
.oqKHGa_selector:active { transform: scale(0.97); }

/* ===== 触发按钮：sidebar 底部齿轮 ===== */
.FGywRq_trigger { transition: background 140ms ease, transform 140ms var(--moyu-ease-out); }
.FGywRq_trigger:active { transform: scale(0.94); }

/* ===== reduced-motion ===== */
@media (prefers-reduced-motion: reduce) {
  .FGywRq_overlay, .FGywRq_panel, .FGywRq_options > *,
  .moyu-panel, .moyu-status, .moyu-switch, .moyu-switch::before {
    animation: none !important;
    transition: none !important;
  }
}

/* ===== MOYU section 内容（去掉外框；模态就是框） ===== */
.moyu-panel {
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  animation: moyu-panel-fade 260ms var(--moyu-ease-out);
}
@keyframes moyu-panel-fade {
  from { opacity: 0; }
}
.moyu-panel + .moyu-panel { margin-top: 32px; }
.moyu-panel-title {
  font-weight: 600;
  font-size: 22px;
  letter-spacing: -0.015em;
  margin: 0;
  line-height: 1.3;
}
.moyu-panel-hint {
  font-size: 13px;
  color: var(--moyu-text-dim);
  margin-top: 8px;
  line-height: 1.6;
  max-width: 62ch;
}
.moyu-group {
  margin-top: 28px;
}
.moyu-group-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--moyu-text-mute);
  margin: 0 0 12px;
}
.moyu-current {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 20px 0 4px;
  padding: 14px 16px;
  border-radius: var(--moyu-radius-lg);
  background: var(--moyu-fill-subtle);
  border: 1px solid var(--moyu-hairline-soft);
}
.moyu-current-label { font-size: 12px; color: var(--moyu-text-dim); flex: none; }
.moyu-current-value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.moyu-current-aux { font-size: 12px; color: var(--moyu-text-dim); margin-left: auto; }

.moyu-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.moyu-row + .moyu-row { border-top: 1px solid var(--moyu-hairline-soft); }
.moyu-row-main { flex: 1; min-width: 0; }
.moyu-row-title { font-weight: 500; font-variant-numeric: tabular-nums; }
.moyu-row-meta { font-size: 12px; color: var(--moyu-text-dim); margin-top: 2px; line-height: 1.5; }
.moyu-row-actions { display: flex; gap: 6px; flex: none; }

.moyu-btn {
  font: inherit;
  padding: 5px 12px;
  border-radius: var(--moyu-radius-md);
  border: 1px solid var(--moyu-hairline);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms var(--moyu-ease-out), opacity 140ms ease, color 140ms ease;
}
.moyu-btn:hover:not(:disabled) { background: var(--moyu-fill-hover); }
.moyu-btn:active:not(:disabled) { transform: scale(0.97); background: var(--moyu-fill-active); }
.moyu-btn:disabled { opacity: 0.42; cursor: default; }
.moyu-btn:focus-visible { outline: 2px solid color-mix(in oklab, currentColor 42%, transparent); outline-offset: 2px; }
.moyu-btn--primary { background: var(--moyu-fill-subtle); border-color: var(--moyu-hairline); }
.moyu-btn--primary:hover:not(:disabled) { background: var(--moyu-fill-active); }
.moyu-btn--danger { color: var(--moyu-danger); border-color: color-mix(in oklab, var(--moyu-danger) 42%, transparent); }
.moyu-btn--danger:hover:not(:disabled) { background: color-mix(in oklab, var(--moyu-danger) 12%, transparent); }
.moyu-btn--ghost { border-color: transparent; }
.moyu-btn--ghost:hover:not(:disabled) { background: var(--moyu-fill-hover); }

.moyu-btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; align-items: center; }
.moyu-btn-row .moyu-spacer { flex: 1; }

.moyu-select {
  font: inherit;
  padding: 5px 10px;
  border-radius: var(--moyu-radius-md);
  border: 1px solid var(--moyu-hairline);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.moyu-select:hover { background: var(--moyu-fill-hover); }
.moyu-select:focus-visible { outline: 2px solid color-mix(in oklab, currentColor 42%, transparent); outline-offset: 2px; }

.moyu-switch {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--moyu-fill-hover);
  border: 1px solid var(--moyu-hairline);
  cursor: pointer;
  padding: 0;
  transition: background 180ms ease;
  flex: none;
}
.moyu-switch::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.72;
  transition: transform 220ms var(--moyu-ease-out), opacity 160ms ease;
}
.moyu-switch[data-on="true"] { background: color-mix(in oklab, var(--moyu-ok) 55%, transparent); border-color: color-mix(in oklab, var(--moyu-ok) 30%, transparent); }
.moyu-switch[data-on="true"]::before { transform: translateX(14px); opacity: 1; }
.moyu-switch:disabled { opacity: 0.42; cursor: default; }
.moyu-switch:active:not(:disabled)::before { transform: scale(0.88); }
.moyu-switch[data-on="true"]:active:not(:disabled)::before { transform: translateX(14px) scale(0.88); }
.moyu-switch:focus-visible { outline: 2px solid color-mix(in oklab, currentColor 42%, transparent); outline-offset: 2px; }

.moyu-status {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--moyu-radius-sm);
  margin-top: 10px;
  background: var(--moyu-fill-subtle);
  animation: moyu-status-in 180ms var(--moyu-ease-out);
  line-height: 1.5;
}
.moyu-status--err { background: color-mix(in oklab, var(--moyu-danger) 12%, transparent); color: var(--moyu-danger); }
.moyu-status--ok { background: color-mix(in oklab, var(--moyu-ok) 12%, transparent); color: var(--moyu-ok); }
.moyu-status--warn { background: color-mix(in oklab, var(--moyu-warn) 14%, transparent); color: var(--moyu-warn); }
@keyframes moyu-status-in {
  from { opacity: 0; transform: translateY(-2px); }
}

.moyu-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--moyu-hairline);
  color: var(--moyu-text-dim);
  vertical-align: 2px;
  margin-left: 6px;
}
.moyu-tag--ok { color: var(--moyu-ok); border-color: color-mix(in oklab, var(--moyu-ok) 34%, transparent); }
.moyu-tag--err { color: var(--moyu-danger); border-color: color-mix(in oklab, var(--moyu-danger) 34%, transparent); }

.moyu-divider { border: 0; border-top: 1px solid var(--moyu-hairline-soft); margin: 20px 0 0; }

.moyu-menu-wrap { position: relative; }
.moyu-menu-btn {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
  transition: background 140ms ease, opacity 140ms ease;
}
.moyu-menu-btn:hover { background: var(--moyu-fill-hover); opacity: 1; }
.moyu-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  min-width: 140px;
  padding: 4px;
  border-radius: var(--moyu-radius-md);
  border: 1px solid var(--moyu-hairline);
  background: var(--dsw-alias-background, color-mix(in oklab, currentColor 6%, canvas));
  box-shadow: 0 8px 24px color-mix(in oklab, currentColor 18%, transparent);
  z-index: 10;
  animation: moyu-menu-in 140ms var(--moyu-ease-out);
  transform-origin: top right;
}
@keyframes moyu-menu-in {
  from { opacity: 0; transform: scale(0.96); }
}
.moyu-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  padding: 6px 10px;
  border-radius: var(--moyu-radius-sm);
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.moyu-menu-item:hover { background: var(--moyu-fill-hover); }
.moyu-menu-item--danger { color: var(--moyu-danger); }
.moyu-menu-item--danger:hover { background: color-mix(in oklab, var(--moyu-danger) 12%, transparent); }

/* =========================================================
 * 侧栏（TQ0BVq_*）
 * ======================================================= */
.TQ0BVq_root { padding-inline: 10px; }
.TQ0BVq_iconButton {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
}
.TQ0BVq_iconButton:active:not(:disabled) { transform: scale(0.92); }
.TQ0BVq_toggle:active:not(:disabled) { transform: scale(0.92); }
.TQ0BVq_brand {
  transition: opacity 140ms ease, transform 140ms var(--moyu-ease-out);
  border-radius: var(--moyu-radius-md);
}
.TQ0BVq_brand:hover { opacity: 0.85; }
.TQ0BVq_brand:active { transform: scale(0.98); }
.TQ0BVq_brand:focus-visible {
  outline: 2px solid color-mix(in oklab, currentColor 40%, transparent);
  outline-offset: 2px;
}

/* =========================================================
 * 工作区 / 会话列表 / 顶部导航（IDS31W_* + W1OuRW_*）
 * ======================================================= */
.IDS31W_surfaceNavItem {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
  position: relative;
}
.IDS31W_surfaceNavItem:active:not(:disabled) { transform: scale(0.985); }
.IDS31W_surfaceNavItem:focus-visible {
  outline: 2px solid color-mix(in oklab, currentColor 38%, transparent);
  outline-offset: -2px;
}
.IDS31W_surfaceNavItemActive::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.72;
}
.IDS31W_sectionLabel {
  font-size: 11px !important;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--moyu-text-mute) !important;
  font-weight: 600 !important;
}
.IDS31W_searchButton {
  transition: background 140ms ease, transform 140ms var(--moyu-ease-out);
}
.IDS31W_searchButton:active:not(:disabled) { transform: scale(0.94); }
.IDS31W_iconButton {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
}
.IDS31W_iconButton:active:not(:disabled) { transform: scale(0.92); }
.IDS31W_searchInput {
  transition: background 140ms ease, border-color 140ms ease;
}
.IDS31W_empty {
  color: var(--moyu-text-dim);
  padding: 20px 12px;
  font-size: 13px;
  line-height: 1.55;
}
.IDS31W_sessionOverflowButton {
  transition: background 140ms ease, opacity 140ms ease, transform 140ms var(--moyu-ease-out);
}
.IDS31W_sessionOverflowButton:active:not(:disabled) { transform: scale(0.9); }

/* 会话行 / 项目行（W1OuRW_*） */
.W1OuRW_sessionRow, .W1OuRW_projectRow, .W1OuRW_flatSessionRow {
  transition: background 140ms ease, color 140ms ease;
}
.W1OuRW_iconButton {
  transition: background 140ms ease, color 140ms ease, opacity 140ms ease, transform 140ms var(--moyu-ease-out) !important;
}
.W1OuRW_iconButton:active:not(:disabled) { transform: scale(0.9); }

/* =========================================================
 * Composer / 新会话（_3q12Lq_*）
 * ======================================================= */
._3q12Lq_card {
  transition: border-color 180ms ease, box-shadow 220ms var(--moyu-ease-out);
}
._3q12Lq_card:focus-within {
  border-color: color-mix(in oklab, var(--moyu-accent) 55%, currentColor) !important;
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--moyu-accent) 16%, transparent),
    var(--dsw-shadow-lv2);
}
._3q12Lq_add {
  transition: background 140ms ease, transform 140ms var(--moyu-ease-out);
}
._3q12Lq_add:active:not(:disabled) { transform: scale(0.9); }
._3q12Lq_add:focus-visible {
  outline: 2px solid color-mix(in oklab, currentColor 42%, transparent);
  outline-offset: 2px;
}
._3q12Lq_select {
  transition: background-color 140ms ease, transform 140ms var(--moyu-ease-out);
}
._3q12Lq_select:active:not(:disabled) { transform: scale(0.97); }
._3q12Lq_primary {
  transition: background-color 140ms ease, transform 140ms var(--moyu-ease-out), opacity 140ms ease;
}
._3q12Lq_primary:active:not(:disabled) { transform: translateY(-2px) scale(0.94); }
._3q12Lq_primary:focus-visible {
  outline: 2px solid color-mix(in oklab, currentColor 42%, transparent);
  outline-offset: 3px;
}
._3q12Lq_retry {
  transition: background 140ms ease, border-color 140ms ease, transform 140ms var(--moyu-ease-out);
}
._3q12Lq_retry:hover { background: var(--moyu-fill-hover); }
._3q12Lq_retry:active { transform: scale(0.96); }
._3q12Lq_notice {
  animation: moyu-composer-notice-in 200ms var(--moyu-ease-out);
}
@keyframes moyu-composer-notice-in {
  from { opacity: 0; transform: translateY(-3px); }
}

/* =========================================================
 * 会话运行视图 —— 面包屑 / 底部详情面板（AYmwxq_*）
 * ======================================================= */
.AYmwxq_crumb {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
}
.AYmwxq_crumb:hover:not(.AYmwxq_crumbCurrent) {
  background: var(--moyu-fill-hover);
  color: inherit;
}
.AYmwxq_crumb:active:not(.AYmwxq_crumbCurrent) { transform: scale(0.97); }
.AYmwxq_crumb:focus-visible {
  outline: 2px solid color-mix(in oklab, currentColor 40%, transparent);
  outline-offset: 1px;
}

.AYmwxq_bottomPanel {
  border-color: var(--moyu-hairline-soft) !important;
  animation: moyu-bp-in 240ms var(--moyu-ease-out);
}
@keyframes moyu-bp-in {
  from { opacity: 0; transform: translateY(6px); }
}
.AYmwxq_bottomPanelHeader {
  border-bottom-color: var(--moyu-hairline-soft) !important;
}
.AYmwxq_bottomPanelTab {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
  border-radius: 7px;
}
.AYmwxq_bottomPanelTab:hover:not(.AYmwxq_bottomPanelTabActive) {
  background: var(--moyu-fill-hover);
}
.AYmwxq_bottomPanelTab:active:not(.AYmwxq_bottomPanelTabActive) { transform: scale(0.97); }
.AYmwxq_bottomPanelClose {
  transition: background 140ms ease, color 140ms ease, transform 140ms var(--moyu-ease-out);
}
.AYmwxq_bottomPanelClose:hover { background: var(--moyu-fill-hover); color: inherit; }
.AYmwxq_bottomPanelClose:active { transform: scale(0.92); }

/* =========================================================
 * 消息气泡（OdWf6W_*）
 * ======================================================= */
.OdWf6W_bubble {
  animation: moyu-bubble-in 260ms var(--moyu-ease-out);
  transition: border-color 180ms ease;
}
@keyframes moyu-bubble-in {
  from { opacity: 0; transform: translateY(4px); }
}

/* =========================================================
 * 工具/命令行卡片（zr3SYG_*）
 * ======================================================= */
.zr3SYG_card {
  animation: moyu-tool-in 240ms var(--moyu-ease-out);
  transition: border-color 180ms ease, box-shadow 220ms var(--moyu-ease-out);
}
@keyframes moyu-tool-in {
  from { opacity: 0; transform: translateY(3px); }
}
.zr3SYG_actionRow button, .zr3SYG_actionRow [role="button"] {
  transition: background 140ms ease, transform 140ms var(--moyu-ease-out) !important;
}
.zr3SYG_actionRow button:active, .zr3SYG_actionRow [role="button"]:active { transform: scale(0.97); }

/* 消息/工具卡进场在 reduced-motion 下关闭 */
@media (prefers-reduced-motion: reduce) {
  .OdWf6W_bubble, .zr3SYG_card, .AYmwxq_bottomPanel { animation: none !important; }
}

/* =========================================================
 * 布局框架（AgZ4Da_*）
 * ======================================================= */
.AgZ4Da_handle {
  transition: background 160ms ease;
}
.AgZ4Da_handle:hover::after {
  content: "";
  position: absolute;
  inset: 0 50%;
  width: 2px;
  border-radius: 2px;
  background: color-mix(in oklab, currentColor 32%, transparent);
  transform: translateX(-50%);
}
`

function injectStyle(): void {
  if (typeof document === 'undefined') return
  const id = 'moyu-settings-style'
  if (document.getElementById(id)) return
  const el = document.createElement('style')
  el.id = id
  el.setAttribute('data-moyu-plugin', 'shell')
  el.textContent = MOYU_SETTINGS_CSS
  document.head.appendChild(el)
}

// --- primitives ---

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }
function Btn({ variant = 'default', className, ...rest }: BtnProps): React.ReactElement {
  const cls = ['moyu-btn', variant !== 'default' && `moyu-btn--${variant}`, className].filter(Boolean).join(' ')
  return React.createElement('button', { type: 'button', ...rest, className: cls })
}

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }): React.ReactElement {
  return React.createElement('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': on,
    'aria-label': label,
    'data-on': on ? 'true' : 'false',
    className: 'moyu-switch',
    disabled,
    onClick: onChange,
  })
}

function OverflowMenu({ items }: { items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])
  return React.createElement('div', { className: 'moyu-menu-wrap', ref },
    React.createElement('button', {
      type: 'button', className: 'moyu-menu-btn', 'aria-label': '更多操作', 'aria-haspopup': 'menu', 'aria-expanded': open,
      onClick: () => setOpen((v) => !v),
    }, '⋯'),
    open && React.createElement('div', { className: 'moyu-menu', role: 'menu' },
      ...items.map((item, i) => React.createElement('button', {
        key: i, type: 'button', role: 'menuitem', disabled: item.disabled,
        className: `moyu-menu-item${item.danger ? ' moyu-menu-item--danger' : ''}`,
        onClick: () => { setOpen(false); item.onClick() },
      }, item.label)),
    ),
  )
}

function Status({ kind, text }: { kind: 'ok' | 'err' | 'warn' | 'info'; text: string }): React.ReactElement {
  const cls = kind === 'info' ? 'moyu-status' : `moyu-status moyu-status--${kind}`
  return React.createElement('div', { className: cls, role: kind === 'err' ? 'alert' : 'status' }, text)
}

// --- Mods panel ---

function ModsPanel(): React.ReactElement {
  const [mods, setMods] = React.useState<Mod[] | null>(null)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [dirty, setDirty] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setError('')
    try { setMods((await modsRequest({ operation: 'list' })).mods as Mod[]) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])

  React.useEffect(() => { void refresh() }, [refresh])

  const setEnabled = async (id: string, enabled: boolean): Promise<void> => {
    if (busy) return
    setBusy(id); setError('')
    try {
      const r = await modsRequest({ operation: 'set-enabled', id, enabled })
      setMods(r.mods as Mod[]); setDirty(true)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy('') }
  }

  const uninstall = async (id: string, name: string): Promise<void> => {
    if (busy) return
    if (!window.confirm(`卸载「${name}」？该操作将在下次重启后生效。`)) return
    setBusy(id); setError('')
    try {
      const r = await modsRequest({ operation: 'uninstall', id })
      setMods(r.mods as Mod[]); setDirty(true)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy('') }
  }

  const rows = (mods || []).map((m) => React.createElement('div', { key: m.id, className: 'moyu-row' },
    React.createElement('div', { className: 'moyu-row-main' },
      React.createElement('div', { className: 'moyu-row-title' },
        m.displayName,
        m.integrity !== 'ok' && React.createElement('span', { className: 'moyu-tag moyu-tag--err' }, m.integrity),
      ),
      React.createElement('div', { className: 'moyu-row-meta' }, `${m.id} · v${m.version}`),
    ),
    React.createElement('div', { className: 'moyu-row-actions' },
      React.createElement(Switch, {
        on: m.enabled, disabled: !!busy, label: `${m.enabled ? '禁用' : '启用'} ${m.displayName}`,
        onChange: () => void setEnabled(m.id, !m.enabled),
      }),
      React.createElement(OverflowMenu, { items: [
        { label: '卸载', danger: true, disabled: !!busy, onClick: () => void uninstall(m.id, m.displayName) },
      ] }),
    ),
  ))

  return React.createElement('section', { className: 'moyu-panel' },
    React.createElement('h2', { className: 'moyu-panel-title' }, 'Mods'),
    React.createElement('div', { className: 'moyu-panel-hint' }, '启用、禁用或卸载已安装的 Mod。改动将在下次重启 MOYU DSH 后生效。'),
    dirty && React.createElement(Status, { kind: 'warn', text: '有改动待生效，请重启应用。' }),
    error && React.createElement(Status, { kind: 'err', text: error }),
    React.createElement('div', { className: 'moyu-group' },
      mods === null
        ? React.createElement('div', { className: 'moyu-panel-hint' }, '加载中…')
        : mods.length === 0
          ? React.createElement('div', { className: 'moyu-panel-hint' }, '尚未安装任何 Mod。')
          : React.createElement('div', null, ...rows),
    ),
    React.createElement('div', { className: 'moyu-btn-row' },
      React.createElement(Btn, { variant: 'ghost', onClick: () => void refresh() }, '刷新'),
    ),
  )
}

// --- Kernel & Update panel (merged) ---

function KernelPanel(): React.ReactElement {
  const [state, setState] = React.useState<KernelState | null>(null)
  const [channel, setChannel] = React.useState<'stable' | 'beta'>('stable')
  const [available, setAvailable] = React.useState<KernelInfo[]>([])
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const refresh = React.useCallback(async () => {
    try { setState(await kernelRequest({ operation: 'status' }) as KernelState) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  React.useEffect(() => { void refresh() }, [refresh])

  const run = async (key: string, payload: Record<string, unknown>, message?: string): Promise<any> => {
    if (busy) return undefined
    setBusy(key); setError(''); setNotice('')
    try {
      const result = await kernelRequest(payload)
      if (message) setNotice(message)
      await refresh()
      return result
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return undefined }
    finally { setBusy('') }
  }

  const install = async (): Promise<void> => {
    const result = await run('install', { operation: 'install-local' })
    if (!result || result.canceled) return
    setNotice(result.status === 'already' ? '该内核已经安装。' : result.status === 'installed' ? '内核已安装，请先运行兼容探针。' : `安装被拒绝：${result.reason}`)
  }
  const check = async (): Promise<void> => {
    const result = await run('feed', { operation: 'check-feed', channel })
    if (result) { setAvailable(result.releases || []); setNotice(`已检查 ${channel} 通道。`) }
  }
  const restart = async (): Promise<void> => { await run('restart', { operation: 'restart-app' }) }
  const downloadInstall = async (item: KernelInfo): Promise<void> => {
    if (!item.metadataUrl || !item.signatureUrl || !item.payloadUrl) return
    const release = { version: item.version, metadataUrl: item.metadataUrl, signatureUrl: item.signatureUrl, payloadUrl: item.payloadUrl }
    const result = await run(`download:${item.version}`, { operation: 'download-install', release })
    if (!result) return
    setNotice(result.status === 'installed' ? `${item.version} 已安装，请运行兼容探针。` : result.status === 'already' ? `${item.version} 已安装。` : `安装被拒绝：${result.reason}`)
  }

  const activeVersion = state?.active && state.active !== 'builtin' ? state.active : `内置 ${state?.builtinVersion || '未知'}`
  const previous = state?.previous || null

  const availableList = available.length > 0
    ? React.createElement('div', null, ...available.map((item) => React.createElement('div', { key: item.version, className: 'moyu-row' },
        React.createElement('div', { className: 'moyu-row-main' },
          React.createElement('div', { className: 'moyu-row-title' }, item.version),
          React.createElement('div', { className: 'moyu-row-meta' }, item.notes || '无更新说明'),
        ),
        React.createElement('div', { className: 'moyu-row-actions' },
          React.createElement(Btn, { variant: 'primary', disabled: !!busy, onClick: () => void downloadInstall(item) }, '下载并安装'),
        ),
      )))
    : null

  const installedList = (state?.installed || []).length > 0
    ? React.createElement('div', null, ...(state?.installed || []).map((item) => {
        const isActive = state?.active === item.version
        const passed = item.probe?.status === 'passed'
        return React.createElement('div', { key: item.version, className: 'moyu-row' },
          React.createElement('div', { className: 'moyu-row-main' },
            React.createElement('div', { className: 'moyu-row-title' },
              item.version,
              isActive && React.createElement('span', { className: 'moyu-tag moyu-tag--ok' }, '当前'),
              !isActive && passed && React.createElement('span', { className: 'moyu-tag moyu-tag--ok' }, '已验证'),
              item.probe?.status === 'failed' && React.createElement('span', { className: 'moyu-tag moyu-tag--err' }, '探针失败'),
            ),
            React.createElement('div', { className: 'moyu-row-meta' },
              item.probe
                ? (item.probe.reason ? `${item.probe.status} · ${item.probe.reason}` : `探针 ${item.probe.status}`)
                : '尚未运行兼容探针',
            ),
          ),
          React.createElement('div', { className: 'moyu-row-actions' },
            React.createElement(Btn, { disabled: !!busy, onClick: () => void run(`probe:${item.version}`, { operation: 'probe', version: item.version }, '兼容探针完成。') }, '探针'),
            React.createElement(Btn, {
              variant: 'primary',
              disabled: !!busy || !passed || isActive,
              onClick: () => void run(`activate:${item.version}`, { operation: 'activate', version: item.version }, '已选择该内核，重启后生效。'),
            }, '设为当前'),
          ),
        )
      }))
    : React.createElement('div', { className: 'moyu-panel-hint' }, '尚未安装可切换的内核；当前正在运行内置版本。')

  return React.createElement('section', { className: 'moyu-panel' },
    React.createElement('h2', { className: 'moyu-panel-title' }, '内核与更新'),
    React.createElement('div', { className: 'moyu-panel-hint' }, '只接受 MOYU 签名并通过兼容探针的内核包。切换后需重启生效。'),

    React.createElement('div', { className: 'moyu-current' },
      React.createElement('span', { className: 'moyu-current-label' }, '当前内核'),
      React.createElement('span', { className: 'moyu-current-value' }, activeVersion),
      previous && React.createElement('span', { className: 'moyu-current-aux' }, `上一版本 ${previous}`),
    ),

    error && React.createElement(Status, { kind: 'err', text: error }),
    notice && React.createElement(Status, { kind: 'ok', text: notice }),

    // 在线更新
    React.createElement('div', { className: 'moyu-group' },
      React.createElement('h3', { className: 'moyu-group-title' }, '在线更新'),
      React.createElement('div', { className: 'moyu-btn-row' },
        React.createElement('select', {
          className: 'moyu-select', value: channel, disabled: !!busy,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setChannel(e.target.value as 'stable' | 'beta'),
        },
          React.createElement('option', { value: 'stable' }, '稳定通道'),
          React.createElement('option', { value: 'beta' }, '测试通道'),
        ),
        React.createElement(Btn, { disabled: !!busy, onClick: () => void check() }, '检查可用版本'),
      ),
      availableList,
    ),

    // 本地内核
    React.createElement('div', { className: 'moyu-group' },
      React.createElement('h3', { className: 'moyu-group-title' }, '本地内核'),
      installedList,
      React.createElement('div', { className: 'moyu-btn-row' },
        React.createElement(Btn, { disabled: !!busy, onClick: () => void install() }, '安装本地内核包'),
      ),
    ),

    // 运维
    React.createElement('div', { className: 'moyu-group' },
      React.createElement('h3', { className: 'moyu-group-title' }, '运维'),
      React.createElement('div', { className: 'moyu-btn-row' },
        React.createElement(Btn, {
          disabled: !!busy || !previous,
          onClick: () => void run('rollback', { operation: 'rollback' }, '已选择上一内核，重启后生效。'),
        }, '回退上一版本'),
        React.createElement(Btn, {
          disabled: !!busy || state?.active === 'builtin',
          onClick: () => void run('builtin', { operation: 'restore-builtin' }, '已恢复内置内核，重启后生效。'),
        }, '恢复内置版本'),
        React.createElement('span', { className: 'moyu-spacer' }),
        React.createElement(Btn, { variant: 'primary', disabled: !!busy, onClick: () => void restart() }, '重启应用'),
      ),
    ),

    React.createElement('hr', { className: 'moyu-divider' }),

    // 应用更新（C5 前占位；等 C5 完成后从这里升级为可操作分组）
    React.createElement('div', { className: 'moyu-group' },
      React.createElement('h3', { className: 'moyu-group-title' }, '应用更新'),
      React.createElement('div', { className: 'moyu-panel-hint' }, '当前为手动更新。自动检查与应用更新将在 C5 提供。'),
    ),
  )
}

export const name = 'moyu-shell-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  injectStyle()

  ctx.slots.inject('settings.section' as never, () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-shell-mods',
    order: 20,
    label: () => 'Mods',
  } as never, ModsPanel as never))

  ctx.slots.inject('settings.section' as never, () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-shell-kernel',
    order: 30,
    label: () => '内核与更新',
  } as never, KernelPanel as never))
}
