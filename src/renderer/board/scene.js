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

export const BOARD_SCENE_VERSION = 2

/**
 * 场景版本历史
 *   v1 → v2（U2）：文本节点显式 scaleX/scaleY；所有节点显式 locked；
 *                  text 与 textbox 合并为单一 textbox；图片补 originalAssetId。
 *   v2 的 background / guides / grid 由 U5 补齐，仍走同一条 v1→v2 迁移。
 */

/**
 * 节点类型。
 * ⚠ `TEXT` 自 v2 起**只作为历史类型存在**：迁移会把它并入 TEXTBOX，
 *   新建入口不再产生 text 节点。保留常量是为了让迁移代码可读。
 */
export const NODE_TYPES = { IMAGE: 'image', TEXT: 'text', TEXTBOX: 'textbox' }
const LIVE_NODE_TYPES = new Set([NODE_TYPES.IMAGE, NODE_TYPES.TEXTBOX])

/** 文本默认样式，两类文本节点共用。 */
export const TEXT_DEFAULTS = {
  fontSize: 20,
  fill: '#171820',
  fontWeight: 'normal',
  textAlign: 'left',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
}

/**
 * 文本框特有样式：**默认透明、无边框**，只留文字与编辑用的内边距。
 * 白底加边框会在截图上凭空糊一块，多数场景要的只是一行标注文字。
 */
export const TEXTBOX_DEFAULTS = {
  backgroundColor: '',
  borderColor: '',
  borderWidth: 0,
  padding: 10
}

/**
 * v1 工程的历史文本框样式。**冻结，只用于 v1 → v2 迁移**。
 *
 * 产品默认值可以改，但不能反向改变用户已经保存过的内容：旧工程里那些
 * 没有显式写 style 的文本框，当年看到的就是白底加浅灰边框，迁移后必须
 * 还是那样。若直接复用 TEXTBOX_DEFAULTS，改一次默认值就会把所有历史
 * 工程的观感改一次。
 */
export const TEXTBOX_DEFAULTS_V1 = Object.freeze({
  backgroundColor: '#ffffff',
  borderColor: '#d8dae5',
  borderWidth: 1,
  padding: 10
})

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

/** 默认背景：透明。编辑区用棋盘格表示，棋盘格本身不进输出（规格 7.1）。 */
export const DEFAULT_BACKGROUND = Object.freeze({ type: 'transparent', color: '#ffffff' })
/** 网格显示与吸附是两个独立开关，默认都关。 */
export const DEFAULT_GRID = Object.freeze({ show: false, snap: false })

export function createScene() {
  return {
    version: BOARD_SCENE_VERSION,
    nodes: [],
    edges: [],
    assets: {},
    // 以下三项随工程保存（规格 7.2）。放在场景里而不是控制器上，
    // 是为了让"保存的内容"只有一个真值来源——控制器另存一份必然漂移。
    background: { ...DEFAULT_BACKGROUND },
    guides: [],
    grid: { ...DEFAULT_GRID }
  }
}

/** 背景合法性：只有透明与自定义色两种，色值必须是 #rrggbb。 */
export function validateBackground(background) {
  if (!background || typeof background !== 'object') throw new Error('场景缺少 background')
  if (background.type !== 'transparent' && background.type !== 'color') {
    throw new Error(`background.type 不支持：${background.type}`)
  }
  if (typeof background.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(background.color)) {
    throw new Error(`background.color 非法：${background.color}`)
  }
  return background
}

export function setSceneBackground(scene, background) {
  scene.background = validateBackground({ ...scene.background, ...background })
  return scene.background
}

export function setSceneGrid(scene, patch) {
  const next = { ...scene.grid, ...patch }
  scene.grid = { show: Boolean(next.show), snap: Boolean(next.snap) }
  return scene.grid
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
    locked: false,
    // 多次编辑后始终能回到首次导入/截图的原图（规格 5.3）
    originalAssetId: assetId,
    zIndex: scene.nodes.length
  }
  scene.nodes.push(node)
  normalizeZIndex(scene)
  return node
}

/**
 * 文本框节点（v2 起是唯一的文本对象）。
 *
 * width/height 存的是 **100% 时的基础排版量测值**；缩放只改 scaleX/scaleY，
 * 不动基础字号与基础宽高。这样"重置缩放"才有可回到的基准，
 * 包围盒也只有一处口径（width × scaleX）。
 */
export function addTextBoxNode(scene, { text = '双击编辑文本', x = 0, y = 0, width, style = {} }) {
  const merged = { ...TEXT_DEFAULTS, ...TEXTBOX_DEFAULTS, ...style }
  const node = {
    id: nextBoardId('tb'),
    type: NODE_TYPES.TEXTBOX,
    text: String(text),
    x,
    y,
    width: width ?? TEXTBOX_DEFAULT_WIDTH,
    height: merged.fontSize * 1.4 + merged.padding * 2,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    locked: false,
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

/**
 * 设置文本框缩放。角点等比缩放时 scaleX 与 scaleY 必须相等——
 * 校验器会拒绝不等的情况，因此这里统一入口。
 */
export function setNodeScale(scene, id, scale) {
  const node = findNode(scene, id)
  if (!isTextNode(node)) throw new Error(`节点 ${id} 不是文本节点`)
  const value = Number(scale)
  if (!Number.isFinite(value) || value <= 0) throw new Error('缩放比例必须为正有限数')
  node.scaleX = value
  node.scaleY = value
  return node
}

/** 重置文本框缩放到 100%。 */
export function resetNodeScale(scene, id) {
  return setNodeScale(scene, id, 1)
}

/** 锁定 / 解锁。锁定对象仍可选中查看，但禁止移动、缩放、旋转、删除与双击编辑。 */
export function setNodeLocked(scene, id, locked) {
  const node = findNode(scene, id)
  node.locked = Boolean(locked)
  return node
}

export function isNodeLocked(node) {
  return node?.locked === true
}

/** 旋转（度）。锁定对象不可旋转。 */
export function setNodeRotation(scene, id, degrees) {
  const node = findNode(scene, id)
  if (isNodeLocked(node)) throw new Error(`节点 ${id} 已锁定，不能旋转`)
  const value = Number(degrees)
  if (!Number.isFinite(value)) throw new Error('旋转角度必须为有限数')
  // 归一到 [0, 360)，避免历史里堆积成 720°、-1080° 这类值
  node.rotation = ((value % 360) + 360) % 360
  return node
}

export function setNodePosition(scene, id, x, y) {
  const node = findNode(scene, id)
  if (isNodeLocked(node)) return node
  node.x = x
  node.y = y
  return node
}

export function moveNode(scene, id, dx, dy) {
  const node = findNode(scene, id)
  if (isNodeLocked(node)) return node // 锁定对象在多选变换中自动跳过，不报错
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
  if (isNodeLocked(node)) throw new Error(`节点 ${id} 已锁定，不能删除`)
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

// ── 包围盒 ──────────────────────────────────────────────────
//
// ⚠ 这是**唯一**的包围盒实现。选择框、适应窗口、默认导出、零边距裁切
//   全部走这里；Fabric 层不得再维护第二套公式，否则旋转对象会被裁掉。

/**
 * 节点的显示尺寸。
 * 图片直接用 width/height；文本框的 width/height 存的是 100% 时的基础
 * 排版量测值，实际显示要乘 scaleX/scaleY。
 */
export function nodeDisplaySize(node) {
  if (isTextNode(node)) {
    return {
      width: node.width * (node.scaleX ?? 1),
      height: node.height * (node.scaleY ?? 1)
    }
  }
  return { width: node.width, height: node.height }
}

/**
 * 单个节点的旋转感知包围盒。
 * 以对象中心为旋转中心，对四个角应用 rotation，再取四角 min/max。
 */
export function nodeBounds(node) {
  const { width, height } = nodeDisplaySize(node)
  const rotation = Number(node.rotation) || 0
  if (rotation === 0) {
    return { x: node.x, y: node.y, width, height }
  }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = node.x + width / 2
  const centerY = node.y + height / 2
  const halfW = width / 2
  const halfH = height / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [dx, dy] of [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]]) {
    const x = centerX + dx * cos - dy * sin
    const y = centerY + dx * sin + dy * cos
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 一组节点的联合包围盒。 */
export function unionBounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0, empty: true }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const box = nodeBounds(node)
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, empty: false }
}

export function sceneBounds(scene) {
  return unionBounds(scene.nodes)
}

/** 两个包围盒是否相交（用于自动排版避让）。 */
export function boundsIntersect(a, b, gap = 0) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

// ── 序列化 ──────────────────────────────────────────────────

/**
 * 场景快照：深拷贝，且**保证不含任何二进制**。
 * S4 的撤销栈与 S5 的容器都用这个。
 */
export function snapshotScene(scene) {
  return JSON.parse(JSON.stringify(scene))
}

/**
 * 场景迁移链。
 *
 * ⚠ 调用顺序是硬约束：**必须先 migrateScene()，再 validateScene()**。
 *   validateScene 用的是严格版本相等，直接拿 v1 数据去校验会当场被拒，
 *   老工程就永远打不开了。
 *
 * @param {object} rawScene 未校验的原始场景
 * @param {number} fromVersion 文件里声明的版本
 */
export function migrateScene(rawScene, fromVersion = rawScene?.version) {
  if (!rawScene || typeof rawScene !== 'object') throw new Error('场景数据无效')
  let version = Number(fromVersion)
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`无法识别的场景版本：${fromVersion}`)
  }
  if (version > BOARD_SCENE_VERSION) {
    throw new Error(`场景版本 ${version} 高于本程序支持的 ${BOARD_SCENE_VERSION}`)
  }
  // 深拷贝后再改，不污染调用方传入的对象
  let scene = JSON.parse(JSON.stringify(rawScene))

  if (version === 1) {
    scene = migrateV1toV2(scene)
    version = 2
  }

  scene.version = BOARD_SCENE_VERSION
  return fillSceneDefaults(scene)
}

/** v1 → v2：补齐 U2 引入的字段，并把 text 并入 textbox。 */
function migrateV1toV2(scene) {
  scene.nodes = (scene.nodes || []).map((node) => {
    const next = { ...node }
    // 所有节点显式 locked
    if (typeof next.locked !== 'boolean') next.locked = false
    if (!Number.isFinite(next.rotation)) next.rotation = 0

    if (next.type === NODE_TYPES.IMAGE) {
      // 老工程没有原图关系，视首次资源为原图
      if (!next.originalAssetId) next.originalAssetId = next.assetId
      return next
    }

    // text 与 textbox 合并为单一 textbox，保留内容、样式、基础宽高与旋转
    if (next.type === NODE_TYPES.TEXT || next.type === NODE_TYPES.TEXTBOX) {
      next.type = NODE_TYPES.TEXTBOX
      if (!Number.isFinite(next.scaleX) || next.scaleX <= 0) next.scaleX = 1
      if (!Number.isFinite(next.scaleY) || next.scaleY <= 0) next.scaleY = 1
      // 纯文字节点原本没有边框/底色/内边距，补成文本框默认值
      next.style = { ...TEXT_DEFAULTS, ...TEXTBOX_DEFAULTS_V1, ...(next.style || {}) }
    }
    return next
  })
  scene.edges = scene.edges || []
  scene.assets = scene.assets || {}
  return scene
}

/**
 * 补齐纯新增、有明确默认值的场景级字段。
 *
 * 放在版本链**之后**且对所有版本执行：这类字段是加出来的，
 * 缺失时补默认值不会丢信息，而按版本分支写会漏掉"同版本但更早的
 * 开发期文件"。幂等——重复执行结果逐字段相同。
 */
function fillSceneDefaults(scene) {
  scene.background = scene.background
    ? validateBackground({ ...DEFAULT_BACKGROUND, ...scene.background })
    : { ...DEFAULT_BACKGROUND }
  scene.guides = Array.isArray(scene.guides) ? scene.guides : []
  const grid = { ...DEFAULT_GRID, ...(scene.grid || {}) }
  scene.grid = { show: Boolean(grid.show), snap: Boolean(grid.snap) }
  return scene
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
  validateBackground(scene.background)
  if (!Array.isArray(scene.guides)) throw new Error('场景缺少 guides')
  for (const guide of scene.guides) {
    if (guide.orientation !== 'horizontal' && guide.orientation !== 'vertical') {
      throw new Error(`参考线 ${guide.id} 方向非法：${guide.orientation}`)
    }
    if (!Number.isFinite(guide.position)) {
      throw new Error(`参考线 ${guide.id} 位置非有限数`)
    }
  }
  if (!scene.grid || typeof scene.grid !== 'object') throw new Error('场景缺少 grid')
  for (const key of ['show', 'snap']) {
    if (typeof scene.grid[key] !== 'boolean') throw new Error(`grid.${key} 必须是布尔值`)
  }
  const ids = new Set()
  for (const node of scene.nodes) {
    if (ids.has(node.id)) throw new Error(`节点 id 重复：${node.id}`)
    ids.add(node.id)
    if (node.type === NODE_TYPES.IMAGE && !scene.assets[node.assetId]) {
      throw new Error(`节点 ${node.id} 引用了不存在的资源 ${node.assetId}`)
    }
    if (typeof node.locked !== 'boolean') {
      throw new Error(`节点 ${node.id} 缺少 locked`)
    }
    if (node.type === NODE_TYPES.IMAGE && !node.originalAssetId) {
      throw new Error(`图片节点 ${node.id} 缺少 originalAssetId`)
    }
    if (isTextNode(node)) {
      if (typeof node.text !== 'string') throw new Error(`节点 ${node.id} 的 text 非字符串`)
      if (!node.style || typeof node.style !== 'object') {
        throw new Error(`节点 ${node.id} 缺少 style`)
      }
      for (const key of ['scaleX', 'scaleY']) {
        if (!Number.isFinite(node[key]) || node[key] <= 0) {
          throw new Error(`节点 ${node.id} 的 ${key} 必须为正有限数`)
        }
      }
      // 角点等比缩放，两者必须相等；不得依赖 Fabric 临时对象的 scale 作为真值
      if (node.scaleX !== node.scaleY) {
        throw new Error(`文本框 ${node.id} 的 scaleX 与 scaleY 必须相等`)
      }
      for (const key of Object.keys(node.style)) {
        if (!TEXT_STYLE_KEYS.has(key)) throw new Error(`节点 ${node.id} 含不支持的样式 ${key}`)
      }
    }
    if (!LIVE_NODE_TYPES.has(node.type)) {
      throw new Error(
        node.type === NODE_TYPES.TEXT
          ? `节点 ${node.id} 仍是历史 text 类型，应先经 migrateScene() 迁移`
          : `节点 ${node.id} 类型未知：${node.type}`
      )
    }
    for (const key of ['x', 'y', 'width', 'height', 'zIndex', 'rotation']) {
      if (!Number.isFinite(node[key])) throw new Error(`节点 ${node.id} 的 ${key} 非有限数`)
    }
    for (const key of ['width', 'height']) {
      if (node[key] <= 0) throw new Error(`节点 ${node.id} 的 ${key} 必须为正`)
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
