// 汇总画布 · 场景图数据模型（F-009）
//
// 本模块**不依赖 DOM 与 fabric**，可在 Node 侧直接测试。
// fabric 只负责把场景图画出来与接收交互，真值永远在这里。
//
// 关键约束：
//   · 图片二进制**不进场景图**。场景图只存 assetId 与元数据，
//     二进制放在独立的 AssetStore 里。这是快照式撤销（D-2 方案 A）
//     与 .moyuboard 容器（D-1 方案 A）都能成立的前提。
//   · zIndex 始终规范化为 0..n-1 的连续整数，不留空洞。

export const BOARD_SCENE_VERSION = 1

/** 节点类型。S2 会加 text / textbox，S3 加 edge。 */
export const NODE_TYPES = { IMAGE: 'image' }

let idCounter = 0
/** 生成场景内唯一 id。测试可通过 resetBoardIds() 复位以获得确定性输出。 */
export function nextBoardId(prefix) {
  idCounter += 1
  return `${prefix}_${idCounter.toString(36)}`
}
export function resetBoardIds() {
  idCounter = 0
}

export function createScene() {
  return {
    version: BOARD_SCENE_VERSION,
    nodes: [],
    edges: [],
    assets: {}
  }
}

/**
 * 资源仓库：assetId → 二进制。
 * 与场景图分离，确保场景图可安全序列化进快照。
 */
export class AssetStore {
  constructor() {
    this.bytes = new Map()
  }

  put(assetId, data) {
    if (!(data instanceof Uint8Array)) {
      throw new Error('资源必须是 Uint8Array')
    }
    this.bytes.set(assetId, data)
    return assetId
  }

  get(assetId) {
    return this.bytes.get(assetId)
  }

  has(assetId) {
    return this.bytes.has(assetId)
  }

  delete(assetId) {
    return this.bytes.delete(assetId)
  }

  get size() {
    return this.bytes.size
  }
}

function findNode(scene, id) {
  const node = scene.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`节点不存在：${id}`)
  return node
}

/** zIndex 规范化为 0..n-1 连续整数，保持当前相对顺序。 */
export function normalizeZIndex(scene) {
  const ordered = [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex)
  ordered.forEach((node, index) => {
    node.zIndex = index
  })
  return scene
}

/** 按 z 序返回节点（自底向上）。 */
export function nodesByZ(scene) {
  return [...scene.nodes].sort((a, b) => a.zIndex - b.zIndex)
}

// ── 资源登记 ────────────────────────────────────────────────

/**
 * 登记一张图片资源。返回 assetId。
 * 同一份二进制重复登记会得到不同 assetId —— 去重不在本片范围内。
 */
export function registerAsset(scene, store, { data, mime, width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('资源尺寸无效')
  }
  const assetId = nextBoardId('a')
  store.put(assetId, data)
  scene.assets[assetId] = {
    id: assetId,
    mime: mime || 'image/png',
    width,
    height,
    byteLength: data.byteLength
  }
  return assetId
}

/** 某资源被多少个节点引用。 */
export function assetRefCount(scene, assetId) {
  return scene.nodes.filter((node) => node.assetId === assetId).length
}

// ── 节点操作 ────────────────────────────────────────────────

export function addImageNode(scene, { assetId, x = 0, y = 0, width, height }) {
  const asset = scene.assets[assetId]
  if (!asset) throw new Error(`资源未登记：${assetId}`)
  const node = {
    id: nextBoardId('n'),
    type: NODE_TYPES.IMAGE,
    assetId,
    x,
    y,
    width: width ?? asset.width,
    height: height ?? asset.height,
    rotation: 0,
    zIndex: scene.nodes.length
  }
  scene.nodes.push(node)
  normalizeZIndex(scene)
  return node
}

export function setNodePosition(scene, id, x, y) {
  const node = findNode(scene, id)
  node.x = x
  node.y = y
  return node
}

export function moveNode(scene, id, dx, dy) {
  const node = findNode(scene, id)
  node.x += dx
  node.y += dy
  return node
}

export function moveNodes(scene, ids, dx, dy) {
  return ids.map((id) => moveNode(scene, id, dx, dy))
}

/**
 * 缩放节点。keepRatio 时以宽度为准反推高度，保证宽高比不变。
 * 这是"等比缩放（角柄）"的数据侧实现。
 */
export function resizeNode(scene, id, { width, height, keepRatio = false }) {
  const node = findNode(scene, id)
  if (keepRatio) {
    const ratio = node.height / node.width
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('节点宽高比无效')
    node.width = width
    node.height = width * ratio
  } else {
    if (width != null) node.width = width
    if (height != null) node.height = height
  }
  if (node.width <= 0 || node.height <= 0) throw new Error('节点尺寸必须为正')
  return node
}

/**
 * 删除节点。
 * 资源按引用计数回收：最后一个引用被删除时才从 scene.assets 与仓库移除。
 * S3 接入后此处会级联删除相关连接线。
 */
export function removeNode(scene, store, id) {
  const node = findNode(scene, id)
  scene.nodes = scene.nodes.filter((n) => n.id !== id)
  // 级联删除引用该节点的连接线（S3 起生效；此时 edges 恒为空）
  scene.edges = scene.edges.filter((edge) => edge.from?.nodeId !== id && edge.to?.nodeId !== id)
  if (node.assetId && assetRefCount(scene, node.assetId) === 0) {
    delete scene.assets[node.assetId]
    store?.delete(node.assetId)
  }
  normalizeZIndex(scene)
  return node
}

export function removeNodes(scene, store, ids) {
  return ids.map((id) => removeNode(scene, store, id))
}

// ── 层级 ────────────────────────────────────────────────────

export function bringToFront(scene, id) {
  const node = findNode(scene, id)
  node.zIndex = scene.nodes.length
  return normalizeZIndex(scene)
}

export function sendToBack(scene, id) {
  const node = findNode(scene, id)
  node.zIndex = -1
  return normalizeZIndex(scene)
}

export function bringForward(scene, id) {
  const node = findNode(scene, id)
  const ordered = nodesByZ(scene)
  const at = ordered.findIndex((n) => n.id === id)
  if (at < ordered.length - 1) {
    // 与上一层交换：+1.5 越过邻居后再规范化
    node.zIndex = ordered[at + 1].zIndex + 0.5
  }
  return normalizeZIndex(scene)
}

export function sendBackward(scene, id) {
  const node = findNode(scene, id)
  const ordered = nodesByZ(scene)
  const at = ordered.findIndex((n) => n.id === id)
  if (at > 0) {
    node.zIndex = ordered[at - 1].zIndex - 0.5
  }
  return normalizeZIndex(scene)
}

// ── 包围盒（S6 导出会复用）───────────────────────────────────

export function sceneBounds(scene) {
  if (!scene.nodes.length) return { x: 0, y: 0, width: 0, height: 0, empty: true }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of scene.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, empty: false }
}

// ── 序列化 ──────────────────────────────────────────────────

/**
 * 场景快照：深拷贝，且**保证不含任何二进制**。
 * S4 的撤销栈与 S5 的容器都用这个。
 */
export function snapshotScene(scene) {
  return JSON.parse(JSON.stringify(scene))
}

/** 校验场景图结构，用于打开文件与还原快照时挡住坏数据。 */
export function validateScene(scene) {
  if (!scene || typeof scene !== 'object') throw new Error('场景数据无效')
  if (scene.version !== BOARD_SCENE_VERSION) {
    throw new Error(`场景版本不支持：${scene.version}（当前 ${BOARD_SCENE_VERSION}）`)
  }
  if (!Array.isArray(scene.nodes) || !Array.isArray(scene.edges)) {
    throw new Error('场景缺少 nodes / edges')
  }
  if (!scene.assets || typeof scene.assets !== 'object') throw new Error('场景缺少 assets')
  const ids = new Set()
  for (const node of scene.nodes) {
    if (ids.has(node.id)) throw new Error(`节点 id 重复：${node.id}`)
    ids.add(node.id)
    if (node.type === NODE_TYPES.IMAGE && !scene.assets[node.assetId]) {
      throw new Error(`节点 ${node.id} 引用了不存在的资源 ${node.assetId}`)
    }
    for (const key of ['x', 'y', 'width', 'height', 'zIndex']) {
      if (!Number.isFinite(node[key])) throw new Error(`节点 ${node.id} 的 ${key} 非有限数`)
    }
  }
  return scene
}
