/**
 * @fileoverview BSP (Binary Space Partitioning) Layout Tree
 * Implements Blender-style area splitting/joining mechanics.
 */

/**
 * @typedef {'horizontal' | 'vertical'} SplitDirection
 */

/**
 * @typedef {Object} PanelNode
 * @property {string} id - Unique node ID
 * @property {'panel'} type - Node type
 * @property {string} panelType - Panel content type (e.g., 'viewport', 'timeline')
 * @property {boolean} [collapsed] - Whether panel is collapsed
 * @property {Object} [panelState] - Panel-specific state
 */

/**
 * @typedef {Object} SplitNode
 * @property {string} id - Unique node ID
 * @property {'split'} type - Node type
 * @property {SplitDirection} direction - Split direction
 * @property {number} ratio - Split ratio (0-1), size of first child
 * @property {LayoutNode} first - First child node
 * @property {LayoutNode} second - Second child node
 */

/**
 * @typedef {PanelNode | SplitNode} LayoutNode
 */

let idCounter = 0

/**
 * Generate unique node ID
 * @returns {string}
 */
export function generateId() {
  return `node_${++idCounter}_${Date.now().toString(36)}`
}

/**
 * Create a panel node
 * @param {string} panelType - Panel content type
 * @param {Object} [panelState] - Initial panel state
 * @returns {PanelNode}
 */
export function createPanel(panelType, panelState = {}) {
  return {
    id: generateId(),
    type: 'panel',
    panelType,
    panelState,
    collapsed: false,
  }
}

/**
 * Create a split node
 * @param {SplitDirection} direction - Split direction
 * @param {LayoutNode} first - First child
 * @param {LayoutNode} second - Second child
 * @param {number} [ratio=0.5] - Split ratio
 * @returns {SplitNode}
 */
export function createSplit(direction, first, second, ratio = 0.5) {
  return {
    id: generateId(),
    type: 'split',
    direction,
    ratio,
    first,
    second,
  }
}

/**
 * Find a node by ID in the tree
 * @param {LayoutNode} root - Root node
 * @param {string} id - Node ID to find
 * @returns {LayoutNode | null}
 */
export function findNode(root, id) {
  if (root.id === id) return root
  if (root.type === 'split') {
    return findNode(root.first, id) || findNode(root.second, id)
  }
  return null
}

/**
 * Find parent of a node
 * @param {LayoutNode} root - Root node
 * @param {string} id - Child node ID
 * @returns {{ parent: SplitNode, which: 'first' | 'second' } | null}
 */
export function findParent(root, id) {
  if (root.type !== 'split') return null

  if (root.first.id === id) return { parent: root, which: 'first' }
  if (root.second.id === id) return { parent: root, which: 'second' }

  return findParent(root.first, id) || findParent(root.second, id)
}

/**
 * Split a panel into two
 * @param {LayoutNode} root - Root node
 * @param {string} panelId - Panel ID to split
 * @param {SplitDirection} direction - Split direction
 * @param {number} [ratio=0.5] - Split ratio
 * @param {string} [newPanelType] - Type for new panel (defaults to same as original)
 * @returns {LayoutNode} - New root node
 */
export function splitPanel(root, panelId, direction, ratio = 0.5, newPanelType) {
  let node = findNode(root, panelId)
  if (!node || node.type !== 'panel') {
    return root
  }

  let newPanel = createPanel(newPanelType || node.panelType)
  let splitNode = createSplit(direction, node, newPanel, ratio)


  if (root.id === panelId) {
    return splitNode
  }


  let parentInfo = findParent(root, panelId)
  if (parentInfo) {
    parentInfo.parent[parentInfo.which] = splitNode
  }

  return root
}

/**
 * Join two panels (remove one panel and its parent split)
 * @param {LayoutNode} root - Root node
 * @param {string} panelToRemove - Panel ID to remove
 * @returns {LayoutNode} - New root node
 */
export function joinPanels(root, panelToRemove) {
  let parentInfo = findParent(root, panelToRemove)
  if (!parentInfo) {
    return root
  }

  let { parent, which } = parentInfo
  let survivor = which === 'first' ? parent.second : parent.first


  let grandparentInfo = findParent(root, parent.id)
  if (!grandparentInfo) {
    return survivor
  }


  grandparentInfo.parent[grandparentInfo.which] = survivor
  return root
}

/**
 * Update split ratio
 * @param {LayoutNode} root - Root node
 * @param {string} splitId - Split node ID
 * @param {number} ratio - New ratio (0-1)
 * @returns {LayoutNode} - Same root (mutated)
 */
export function resizeSplit(root, splitId, ratio) {
  let node = findNode(root, splitId)
  if (!node || node.type !== 'split') {
    return root
  }

  node.ratio = Math.max(0.1, Math.min(0.9, ratio))
  return root
}

/**
 * Serialize layout to JSON string
 * @param {LayoutNode} root - Root node
 * @returns {string}
 */
export function serialize(root) {
  return JSON.stringify(root)
}

/**
 * Deserialize layout from JSON string
 * @param {string} json - JSON string
 * @returns {LayoutNode}
 */
export function deserialize(json) {
  return JSON.parse(json)
}

/**
 * Clone a layout tree (deep copy)
 * @param {LayoutNode} root - Root node
 * @returns {LayoutNode}
 */
export function clone(root) {
  return deserialize(serialize(root))
}

/**
 * Get all panel nodes in tree
 * @param {LayoutNode} root - Root node
 * @returns {PanelNode[]}
 */
export function getAllPanels(root) {
  return collectPanels(root)
}

export function isPanelNode(node) {
  return !!node && node.type === 'panel'
}

export function isSplitNode(node) {
  return !!node && node.type === 'split'
}

/**
 * Collect panel nodes from a layout tree.
 * @param {LayoutNode | Object | null} root
 * @param {Object} [options]
 * @param {boolean} [options.includeGlobal=true] Include panels marked as global.
 * @returns {PanelNode[]}
 */
export function collectPanels(root, options = {}) {
  let { includeGlobal = true } = options
  let panels = []

  function walk(node) {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (isPanelNode(node)) {
      if (includeGlobal || !node.global) panels.push(node)
      return
    }
    if (node.first) walk(node.first)
    if (node.second) walk(node.second)
  }

  walk(root)
  if (includeGlobal && root && typeof root === 'object' && !Array.isArray(root)) {
    walk(root.global)
    walk(root.globals)
    walk(root.globalPanels)
  }
  return panels
}

/**
 * Collect panel type ids from a layout tree.
 * @param {LayoutNode | Object | null} root
 * @param {Object} [options]
 * @param {boolean} [options.includeGlobal=true] Include panels marked as global.
 * @returns {string[]}
 */
export function collectPanelTypes(root, options = {}) {
  return collectPanels(root, options)
    .map((panel) => panel.panelType)
    .filter(Boolean)
}

/**
 * Return the first non-global panel type from a layout tree.
 * @param {LayoutNode | Object | null} root
 * @returns {string | null}
 */
export function getPrimaryPanelType(root) {
  return collectPanels(root, { includeGlobal: false })[0]?.panelType || null
}

/**
 * Check that every requested panel type exists in a layout tree.
 * @param {LayoutNode | Object | null} root
 * @param {Iterable<string>} requiredPanelTypes
 * @param {Object} [options]
 * @returns {boolean}
 */
export function hasEveryPanelType(root, requiredPanelTypes, options = {}) {
  let available = new Set(collectPanelTypes(root, options))
  for (let panelType of requiredPanelTypes || []) {
    if (!available.has(panelType)) return false
  }
  return true
}

/**
 * Check whether any of the requested panel types exists in a layout tree.
 * @param {LayoutNode | Object | null} root
 * @param {Iterable<string>} panelTypes
 * @param {Object} [options]
 * @returns {boolean}
 */
export function hasAnyPanelType(root, panelTypes, options = {}) {
  let available = new Set(collectPanelTypes(root, options))
  for (let panelType of panelTypes || []) {
    if (available.has(panelType)) return true
  }
  return false
}

/**
 * Build sidebar submenu descriptors from panels in a layout tree.
 * @param {LayoutNode | Object | null} root
 * @param {object} panelDefinitions
 * @param {Object} [options]
 * @param {boolean} [options.includeGlobal=false] Include panels marked as global.
 * @param {number} [options.minPanels=2] Minimum count required before returning items.
 * @returns {{title: string, icon: string, panelId: string, isMaster: boolean, panelType: string}[]}
 */
export function createSidebarSubPanels(root, panelDefinitions = {}, options = {}) {
  let { includeGlobal = false, minPanels = 2 } = options
  let panels = collectPanels(root, { includeGlobal })
  if (panels.length < minPanels) return []
  return panels.map((panel, index) => {
    let panelType = panel.panelType || 'panel'
    let config = panelDefinitions[panelType] || {}
    return {
      title: config.title || panelType,
      icon: config.icon || 'dashboard',
      panelId: panel.id || `${panelType}-${index}`,
      isMaster: index === 0,
      panelType,
    }
  })
}

/**
 * Update a node's properties by ID
 * @param {LayoutNode} root - Root node
 * @param {string} nodeId - Node ID to update
 * @param {Object} updates - Properties to update
 * @returns {boolean} - True if node was found and updated
 */
export function updateNode(root, nodeId, updates) {
  let node = findNode(root, nodeId)
  if (!node) return false
  Object.assign(node, updates)
  return true
}

/**
 * Validate that a layout tree matches validation rules
 * @param {LayoutNode} root
 * @param {Object} config
 * @param {Iterable<string>} [config.disallowedPanelTypes]
 * @param {Iterable<string>} [config.requiredPanelTypes]
 * @param {string} [config.expectedPrimary]
 * @returns {boolean}
 */
export function matchesSection(root, config = {}) {
  if (!root) return false
  if (config.disallowedPanelTypes) {
    if (hasAnyPanelType(root, config.disallowedPanelTypes)) return false
  }
  if (config.requiredPanelTypes) {
    if (!hasEveryPanelType(root, config.requiredPanelTypes)) return false
  }
  if (config.expectedPrimary) {
    return collectPanelTypes(root, { includeGlobal: false }).includes(config.expectedPrimary)
  }
  return true
}
