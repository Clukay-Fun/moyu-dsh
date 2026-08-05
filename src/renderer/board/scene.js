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

/** 节点类型。S3 加 edge（边单独存在 scene.edges，不占 nodes）。 */
export const NODE_TYPES = { IMAGE: 'image', TEXT: 'text', TEXTBOX: 'textbox' }

/** 文本默认样式，两类文本节点共用。 */
export const TEXT_DEFAULTS = {
  fontSize: 20,
  fill: '#171820',
  fontWeight: 'normal',
  textAlign: 'left',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
}

/** 文本框特有样式。纯文字节点无边框无底色。 */
export const TEXTBOX_DEFAULTS = {
  backgroundColor: '#ffffff',
  borderColor: '#d8dae5',
  borderWidth: 1,
  padding: 10
}

/** 文本框默认宽度。这是**节点尺寸**不是样式，故不放进 style。 */
export const TEXTBOX_DEFAULT_WIDTH = 260

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

/**
 * 纯文字节点：无边框无底色，宽高由文本内容决定（由渲染层量测后回填）。
 */
export function addTextNode(scene, { text = '双击编辑文字', x = 0, y = 0, style = {} }) {
  const node = {
    id: nextBoardId('t'),
    type: NODE_TYPES.TEXT,
    text: String(text),
    x,
    y,
    // 初始尺寸为估算值，渲染层量测后会通过 setNodeMetrics 回填真实值
    width: Math.max(1, String(text).length * (style.fontSize ?? TEXT_DEFAULTS.fontSize) * 0.6),
    height: (style.fontSize ?? TEXT_DEFAULTS.fontSize) * 1.4,
    rotation: 0,
    zIndex: scene.nodes.length,
    style: { ...TEXT_DEFAULTS, ...style }
  }
  scene.nodes.push(node)
  normalizeZIndex(scene)
  return node
}

/**
 * 文本框节点：有边框/底色/内边距，宽度由用户设定，高度随换行增长。
 */
export function addTextBoxNode(scene, { text = '双击编辑文本框', x = 0, y = 0, width, style = {} }) {
  const merged = { ...TEXT_DEFAULTS, ...TEXTBOX_DEFAULTS, ...style }
  const node = {
    id: nextBoardId('tb'),
    type: NODE_TYPES.TEXTBOX,
    text: String(text),
    x,
    y,
    width: width ?? TEXTBOX_DEFAULT_WIDTH,
    height: merged.fontSize * 1.4 + merged.padding * 2,
    rotation: 0,
    zIndex: scene.nodes.length,
    style: merged
  }
  scene.nodes.push(node)
  normalizeZIndex(scene)
  return node
}

export function isTextNode(node) {
  return node?.type === NODE_TYPES.TEXT || node?.type === NODE_TYPES.TEXTBOX
}

/** 改文本内容。宽高由渲染层量测后经 setNodeMetrics 回填。 */
export function setNodeText(scene, id, text) {
  const node = findNode(scene, id)
  if (!isTextNode(node)) throw new Error(`节点 ${id} 不是文本节点`)
  node.text = String(text)
  return node
}

/** 改文本样式（只允许白名单字段，避免把任意属性写进场景图）。 */
const TEXT_STYLE_KEYS = new Set([
  'fontSize', 'fill', 'fontWeight', 'textAlign', 'fontFamily',
  'backgroundColor', 'borderColor', 'borderWidth', 'padding'
])

export function setNodeStyle(scene, id, patch) {
  const node = findNode(scene, id)
  if (!isTextNode(node)) throw new Error(`节点 ${id} 不是文本节点`)
  for (const [key, value] of Object.entries(patch)) {
    if (!TEXT_STYLE_KEYS.has(key)) throw new Error(`不支持的文本样式：${key}`)
    node.style[key] = value
  }
  return node
}

/**
 * 渲染层量测回填。
 * 文本的真实宽高只有排版后才知道，量测结果必须写回场景图，
 * 否则包围盒、连接线锚点、导出尺寸都会用错值。
 */
export function setNodeMetrics(scene, id, { width, height }) {
  const node = findNode(scene, id)
  if (Number.isFinite(width) && width > 0) node.width = width
  if (Number.isFinite(height) && height > 0) node.height = height
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
 *
 * 资源按引用计数从 **scene.assets 元数据**中移除，但**二进制留在仓库里**。
 * 原因：撤销删除时必须能把图片放回去（S4）。仓库因此是会话级缓存，
 * 未被引用的字节由 compactAssetStore() 在保存/导出前统一回收。
 *
 * 级联删除引用该节点的连接线。
 */
export function removeNode(scene, id) {
  const node = findNode(scene, id)
  scene.nodes = scene.nodes.filter((n) => n.id !== id)
  scene.edges = scene.edges.filter((edge) => edge.from?.nodeId !== id && edge.to?.nodeId !== id)
  if (node.assetId && assetRefCount(scene, node.assetId) === 0) {
    delete scene.assets[node.assetId]
  }
  normalizeZIndex(scene)
  return node
}

export function removeNodes(scene, ids) {
  return ids.map((id) => removeNode(scene, id))
}

/**
 * 回收仓库中未被当前场景引用的二进制。
 * **只应在保存 / 导出前调用**——一旦调用，之前的撤销步骤就无法还原被回收的图片。
 */
export function compactAssetStore(scene, store) {
  const alive = new Set(Object.keys(scene.assets))
  const removed = []
  for (const assetId of [...store.bytes.keys()]) {
    if (!alive.has(assetId)) {
      store.delete(assetId)
      removed.push(assetId)
    }
  }
  return removed
}

/** 撤销还原后，把快照里出现、但仓库缺失的资源列出来（应恒为空）。 */
export function missingAssets(scene, store) {
  return Object.keys(scene.assets).filter((assetId) => !store.has(assetId))
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
    if (isTextNode(node)) {
      if (typeof node.text !== 'string') throw new Error(`节点 ${node.id} 的 text 非字符串`)
      if (!node.style || typeof node.style !== 'object') {
        throw new Error(`节点 ${node.id} 缺少 style`)
      }
      for (const key of Object.keys(node.style)) {
        if (!TEXT_STYLE_KEYS.has(key)) throw new Error(`节点 ${node.id} 含不支持的样式 ${key}`)
      }
    }
    if (!Object.values(NODE_TYPES).includes(node.type)) {
      throw new Error(`节点 ${node.id} 类型未知：${node.type}`)
    }
    for (const key of ['x', 'y', 'width', 'height', 'zIndex']) {
      if (!Number.isFinite(node[key])) throw new Error(`节点 ${node.id} 的 ${key} 非有限数`)
    }
  }
  const edgeIds = new Set()
  for (const edge of scene.edges) {
    if (edgeIds.has(edge.id)) throw new Error(`连接线 id 重复：${edge.id}`)
    edgeIds.add(edge.id)
    for (const side of ['from', 'to']) {
      if (!edge[side]?.nodeId) throw new Error(`连接线 ${edge.id} 缺少 ${side}.nodeId`)
      if (!ids.has(edge[side].nodeId)) {
        throw new Error(`连接线 ${edge.id} 指向不存在的节点 ${edge[side].nodeId}`)
      }
      if (!EDGE_ANCHORS.includes(edge[side].anchor)) {
        throw new Error(`连接线 ${edge.id} 的 ${side} 锚点无效：${edge[side].anchor}`)
      }
    }
  }
  return scene
}

// ── 连接线（S3）──────────────────────────────────────────────
//
// 设计决策 D-3：只做五个固定锚点，自由锚点入冰箱。
// 边不占 nodes，单独存在 scene.edges 里——它没有 z 序也不参与层级操作。

export const EDGE_ANCHORS = ['top', 'right', 'bottom', 'left', 'center']

export const EDGE_DEFAULTS = {
  stroke: '#6978e6',
  strokeWidth: 2,
  arrow: 'end', // none | end | both
  shape: 'line' // line | elbow
}

/**
 * 锚点在画布上的绝对坐标。
 * 五个公式各自独立，harness 会逐一断言。
 */
export function anchorPoint(node, anchor) {
  if (!EDGE_ANCHORS.includes(anchor)) throw new Error(`未知锚点：${anchor}`)
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  switch (anchor) {
    case 'top': return { x: cx, y: node.y }
    case 'right': return { x: node.x + node.width, y: cy }
    case 'bottom': return { x: cx, y: node.y + node.height }
    case 'left': return { x: node.x, y: cy }
    default: return { x: cx, y: cy }
  }
}

export function addEdge(scene, { fromNodeId, fromAnchor = 'right', toNodeId, toAnchor = 'left', style = {} }) {
  if (fromNodeId === toNodeId) throw new Error('连接线不能连到自身')
  findNode(scene, fromNodeId)
  findNode(scene, toNodeId)
  for (const anchor of [fromAnchor, toAnchor]) {
    if (!EDGE_ANCHORS.includes(anchor)) throw new Error(`未知锚点：${anchor}`)
  }
  const merged = { ...EDGE_DEFAULTS, ...style }
  if (!['none', 'end', 'both'].includes(merged.arrow)) {
    throw new Error(`未知箭头样式：${merged.arrow}`)
  }
  if (!['line', 'elbow'].includes(merged.shape)) {
    throw new Error(`未知连线形状：${merged.shape}`)
  }
  const edge = {
    id: nextBoardId('e'),
    from: { nodeId: fromNodeId, anchor: fromAnchor },
    to: { nodeId: toNodeId, anchor: toAnchor },
    style: merged
  }
  scene.edges.push(edge)
  return edge
}

export function removeEdge(scene, id) {
  const at = scene.edges.findIndex((edge) => edge.id === id)
  if (at < 0) throw new Error(`连接线不存在：${id}`)
  return scene.edges.splice(at, 1)[0]
}

export function setEdgeStyle(scene, id, patch) {
  const edge = scene.edges.find((e) => e.id === id)
  if (!edge) throw new Error(`连接线不存在：${id}`)
  const next = { ...edge.style, ...patch }
  if (!['none', 'end', 'both'].includes(next.arrow)) throw new Error(`未知箭头样式：${next.arrow}`)
  if (!['line', 'elbow'].includes(next.shape)) throw new Error(`未知连线形状：${next.shape}`)
  edge.style = next
  return edge
}

/** 求某条边当前的两个端点坐标。节点移动/缩放后调用即可得到新位置。 */
export function edgeEndpoints(scene, edge) {
  const from = scene.nodes.find((n) => n.id === edge.from.nodeId)
  const to = scene.nodes.find((n) => n.id === edge.to.nodeId)
  if (!from || !to) throw new Error(`连接线 ${edge.id} 端点节点缺失`)
  return { start: anchorPoint(from, edge.from.anchor), end: anchorPoint(to, edge.to.anchor) }
}

/**
 * 折线路径点。直线为两点，折线为 Z 字形三段（水平-垂直-水平的中点折返）。
 */
export function edgePathPoints(scene, edge) {
  const { start, end } = edgeEndpoints(scene, edge)
  if (edge.style.shape !== 'elbow') return [start, end]
  const midX = (start.x + end.x) / 2
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
}

/** 引用某节点的全部边。 */
export function edgesOfNode(scene, nodeId) {
  return scene.edges.filter((edge) => edge.from.nodeId === nodeId || edge.to.nodeId === nodeId)
}

/** 悬空引用检查：边的两端必须都指向存在的节点。 */
export function danglingEdges(scene) {
  const ids = new Set(scene.nodes.map((n) => n.id))
  return scene.edges.filter((edge) => !ids.has(edge.from.nodeId) || !ids.has(edge.to.nodeId))
}
