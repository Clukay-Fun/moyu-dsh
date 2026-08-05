// 汇总画布 · .moyuboard 单文件容器（F-009 S5）
//
// 设计决策 D-1：自定义容器。无新依赖、图片零膨胀、读写完全可控。
//
// 布局（小端）：
//   偏移  长度  内容
//   0     10    魔数 "MOYUBOARD\0"
//   10    2     容器版本（uint16）
//   12    4     场景 JSON 字节数（uint32）
//   16    N     场景 JSON（UTF-8）
//   16+N  …     资源二进制，按 JSON 中 assetOrder 的顺序依次拼接
//
// 场景 JSON 内每个 asset 额外带 { offset, length }，均相对**资源区起点**。
//
// 解析纪律：任何一处不自洽都必须抛错，**绝不返回半个场景**。
// 半个场景比打不开更危险——用户会以为文件只是"少了几张图"，
// 然后在残缺状态上继续编辑并保存，把原文件彻底覆盖掉。

import { validateScene, migrateScene } from './scene.js'

export const MOYUBOARD_MAGIC = 'MOYUBOARD\0'
/**
 * 容器版本。随场景版本一起升到 2（U2 引入 locked/rotation/scale/originalAssetId）。
 * 低版本文件仍可打开——旧场景在 validateScene 之前先过 migrateScene()。
 */
export const MOYUBOARD_VERSION = 2
const HEADER_BYTES = 16
/** 单个文件上限，防止误开超大文件把内存打满 */
export const MOYUBOARD_MAX_BYTES = 512 * 1024 * 1024

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * 打包场景与资源为 .moyuboard 字节。
 * @param {object} scene 场景图（不含二进制）
 * @param {{ get: (id: string) => Uint8Array | undefined }} store 资源仓库
 */
export function packBoard(scene, store) {
  validateScene(scene)

  // 数据区顺序固定为字典序，保证同一场景每次打包字节一致；
  // 但 assets **对象的键序保持场景原样**，这样往返后 JSON 逐字节可比。
  const assetOrder = Object.keys(scene.assets).sort()
  const offsets = new Map()
  let cursor = 0
  for (const assetId of assetOrder) {
    const meta = scene.assets[assetId]
    offsets.set(assetId, cursor)
    cursor += meta.byteLength
  }

  const blobs = []
  const assets = {}
  cursor = 0
  for (const assetId of assetOrder) {
    const bytes = store.get(assetId)
    if (!bytes) throw new Error(`打包失败：资源二进制缺失 ${assetId}`)
    if (!(bytes instanceof Uint8Array)) throw new Error(`打包失败：资源 ${assetId} 不是 Uint8Array`)
    const meta = scene.assets[assetId]
    if (bytes.byteLength !== meta.byteLength) {
      throw new Error(
        `打包失败：资源 ${assetId} 长度与元数据不符（${bytes.byteLength} ≠ ${meta.byteLength}）`
      )
    }
    blobs.push(bytes)
    cursor += bytes.byteLength
  }
  // 按场景原键序写入 assets，附上各自的偏移
  for (const assetId of Object.keys(scene.assets)) {
    const meta = scene.assets[assetId]
    assets[assetId] = { ...meta, offset: offsets.get(assetId), length: meta.byteLength }
  }

  const payload = { ...scene, assets, assetOrder }
  const json = encoder.encode(JSON.stringify(payload))
  const total = HEADER_BYTES + json.byteLength + cursor
  if (total > MOYUBOARD_MAX_BYTES) {
    throw new Error(`打包失败：文件将达 ${(total / 1024 / 1024).toFixed(1)} MB，超过上限`)
  }

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  out.set(encoder.encode(MOYUBOARD_MAGIC), 0)
  view.setUint16(10, MOYUBOARD_VERSION, true)
  view.setUint32(12, json.byteLength, true)
  out.set(json, HEADER_BYTES)
  let at = HEADER_BYTES + json.byteLength
  for (const blob of blobs) {
    out.set(blob, at)
    at += blob.byteLength
  }
  return out
}

/**
 * 解析 .moyuboard 字节。
 * 返回 { scene, assets: Map<assetId, Uint8Array> }。
 * 任何不自洽一律抛错。
 */
export function unpackBoard(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('打开失败：数据不是 Uint8Array')
  if (bytes.byteLength > MOYUBOARD_MAX_BYTES) {
    throw new Error('打开失败：文件超过体积上限')
  }
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error('打开失败：文件头不完整，可能已损坏')
  }

  const magic = new TextDecoder('utf-8').decode(bytes.subarray(0, MOYUBOARD_MAGIC.length))
  if (magic !== MOYUBOARD_MAGIC) {
    throw new Error('打开失败：不是 .moyuboard 文件')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = view.getUint16(10, true)
  if (version > MOYUBOARD_VERSION) {
    throw new Error(`打开失败：文件版本 ${version} 高于本程序支持的 ${MOYUBOARD_VERSION}，请升级后再打开`)
  }

  const jsonLength = view.getUint32(12, true)
  const jsonEnd = HEADER_BYTES + jsonLength
  if (jsonEnd > bytes.byteLength) {
    throw new Error('打开失败：场景数据长度越界，文件可能被截断')
  }

  let payload
  try {
    payload = JSON.parse(decoder.decode(bytes.subarray(HEADER_BYTES, jsonEnd)))
  } catch (error) {
    throw new Error(`打开失败：场景数据无法解析（${error.message}）`)
  }

  const assetOrder = Array.isArray(payload.assetOrder) ? payload.assetOrder : []
  const region = bytes.subarray(jsonEnd)
  const assets = new Map()
  const sceneAssets = {}

  // 先按 assetOrder 校验并切出二进制
  for (const assetId of assetOrder) {
    const meta = payload.assets?.[assetId]
    if (!meta) throw new Error(`打开失败：assetOrder 含未登记的资源 ${assetId}`)
    const { offset, length } = meta
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0) {
      throw new Error(`打开失败：资源 ${assetId} 的偏移或长度无效`)
    }
    if (offset + length > region.byteLength) {
      throw new Error(
        `打开失败：资源 ${assetId} 偏移越界（需要 ${offset + length} 字节，实际 ${region.byteLength}）`
      )
    }
    if (length !== meta.byteLength) {
      throw new Error(`打开失败：资源 ${assetId} 长度与元数据不符`)
    }
    // slice 而非 subarray：让还原后的资源持有独立内存，
    // 避免整份文件缓冲被少量资源长期钉住。
    assets.set(assetId, region.slice(offset, offset + length))
  }

  // 再按 payload.assets 的原键序重建场景元数据，保持往返键序一致
  for (const [assetId, meta] of Object.entries(payload.assets || {})) {
    if (!assets.has(assetId)) continue
    const { offset: _o, length: _l, ...rest } = meta
    sceneAssets[assetId] = rest
  }

  // 元数据里出现、但 assetOrder 没列出的资源属于不自洽
  for (const assetId of Object.keys(payload.assets || {})) {
    if (!assets.has(assetId)) {
      throw new Error(`打开失败：资源 ${assetId} 在元数据中但缺少数据区`)
    }
  }

  const { assetOrder: _order, ...sceneRest } = payload
  // 先迁移再严格校验：validateScene 用的是版本**严格相等**，
  // 老工程不先升版就会被自己的校验挡在门外。
  const migrated = migrateScene({ ...sceneRest, assets: sceneAssets })
  const scene = validateScene(migrated)
  return { scene, assets }
}

/** 读取文件头，用于"是不是本程序的文件"这类快速判断。 */
export function peekBoardHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES) return null
  const magic = new TextDecoder('utf-8').decode(bytes.subarray(0, MOYUBOARD_MAGIC.length))
  if (magic !== MOYUBOARD_MAGIC) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { version: view.getUint16(10, true), jsonLength: view.getUint32(12, true) }
}
