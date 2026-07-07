/**
 * ForceLayout — Main-thread wrapper for the ForceWorker.
 *
 * Manages Web Worker lifecycle and streams position updates
 * to the canvas via requestAnimationFrame batching.
 *
 * Usage:
 *   const force = new ForceLayout(canvas);
 *   force.start({ nodes, edges, groups, options });
 *   force.onTick = (positions) => { ... };
 *   force.stop();
 *
 * @module symbiote-ui/canvas/ForceLayout
 */

import { normalizeForceGroups } from './graph-layout.js';

const FALLBACK_DEFAULT_OPTIONS = Object.freeze({
  chargeStrength: -150,
  linkDistance: 150,
  linkStrength: 0.25,
  groupDistance: 120,
  groupStrength: 0.05,
  centerStrength: 0,
  centerPull: 0.3,
  velocityDecay: 0.92,
  collideStrength: 1,
  collisionPadding: 18,
  alphaDecay: 0.015,
  alphaMin: 0.001,
  alphaTarget: 0,
  initialAlpha: 1,
  layoutAlgorithm: 'organic',
  positionOrigin: 'center',
  contAlphaFloor: 0.001,
  contAlphaTarget: 0.001,
  brownian: 0,
  brownianThresh: 0.001,
  pinReheat: 0.03,
  pinCap: 0.1,
  resumeReheat: 0.05,
  resumeCap: 0.1,
  crystalStrength: 0.18,
  crystalRingDistance: 118,
  crystalSpokes: 6,
  crystalAngleJitter: 0.16,
});

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMass(value) {
  return clamp(finiteNumber(value, 1), 0.35, 8);
}

function normalizeParticipation(value) {
  return clamp(finiteNumber(value, 1), 0, 1);
}

function normalizeSizeScale(value) {
  return clamp(finiteNumber(value, 1), 0.12, 1);
}

function normalizeLayoutAlgorithm(value) {
  return value === 'spring' || value === 'oil-cloud' || value === 'crystal' ? value : 'organic';
}

function normalizePositionOrigin(value) {
  return value === 'center' ? 'center' : 'top-left';
}

function getParticipation(node) {
  return normalizeParticipation(node?.layoutParticipation);
}

function getLayoutSizeScale(node) {
  return normalizeSizeScale(node?.layoutSizeScale);
}

function getEffectiveMass(node) {
  return Math.max(0.35, normalizeMass(node?.mass) * getLayoutSizeScale(node));
}

function getCollisionParticipation(node) {
  let participation = getParticipation(node);
  if (participation <= 0.001) return 0;
  return clamp(0.18 + participation * 0.82, 0, 1);
}

function getMovementScale(node) {
  return getParticipation(node) / Math.max(1, getEffectiveMass(node));
}

function getEffectiveWidth(node) {
  return Math.max(1, finiteNumber(node?.w, 1) * getLayoutSizeScale(node));
}

function getEffectiveHeight(node) {
  return Math.max(1, finiteNumber(node?.h, 1) * getLayoutSizeScale(node));
}

function advanceLayoutParticipation(nodes) {
  for (const node of nodes) {
    if (node.layoutParticipation < 1) {
      let warmupTicks = Math.max(1, finiteNumber(node.layoutWarmupTicks, 36));
      node.layoutParticipation = Math.min(1, node.layoutParticipation + 1 / warmupTicks);
    }
    if (node.layoutSizeScale < 1) {
      let sizeWarmupTicks = Math.max(1, finiteNumber(node.layoutSizeWarmupTicks, 36));
      node.layoutSizeScale = Math.min(1, node.layoutSizeScale + 1 / sizeWarmupTicks);
    }
  }
}

function hashUnit(value) {
  let text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function fallbackJitter(id, axis) {
  return (hashUnit(`${id}:${axis}`) - 0.5) * 0.01;
}

function getCrystalSpokeCount(options) {
  return Math.round(clamp(finiteNumber(options.crystalSpokes, FALLBACK_DEFAULT_OPTIONS.crystalSpokes), 3, 12));
}

function getCrystalRingDistance(options) {
  let configured = finiteNumber(options.crystalRingDistance, 0);
  if (configured > 0) return configured;
  return Math.max(
    92,
    finiteNumber(options.linkDistance, FALLBACK_DEFAULT_OPTIONS.linkDistance) * 0.72,
    finiteNumber(options.groupDistance, FALLBACK_DEFAULT_OPTIONS.groupDistance) * 0.62
  );
}

function getCrystalNodeRadius(node) {
  return Math.max(getEffectiveWidth(node), getEffectiveHeight(node)) / 2;
}

function getCrystalTargetNodeScore(node, index, degree) {
  let childCount = Array.isArray(node.children) ? node.children.length : 0;
  let groupScore = node.isGroup ? 5 : 0;
  let parentPenalty = node.parentId ? 0 : 0.35;
  return (degree[index] || 0) + childCount * 1.15 + groupScore + normalizeMass(node.mass) * 0.35 + parentPenalty;
}

function getCrystalTargetCenter(rawNodes) {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const node of rawNodes) {
    if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) continue;
    let mass = normalizeMass(node.mass);
    x += node.x * mass;
    y += node.y * mass;
    total += mass;
  }
  if (total <= 0) return { x: 0, y: 0 };
  return { x: x / total, y: y / total };
}

function getCrystalBranchStep(parent, child, ringDistance) {
  let padding = Math.max(16, ringDistance * 0.32);
  return Math.max(
    ringDistance,
    getCrystalNodeRadius(parent) + getCrystalNodeRadius(child) + padding
  );
}

function getCrystalMemberRingStep(members, ringDistance) {
  let maxRadius = 0;
  for (const member of members) {
    maxRadius = Math.max(maxRadius, getCrystalNodeRadius(member));
  }
  return Math.max(ringDistance * 0.92, maxRadius * 2 + Math.max(14, ringDistance * 0.24));
}

function getCrystalClusterRadius(hub, members, ringDistance, spokes) {
  let hubRadius = getCrystalNodeRadius(hub);
  if (!members.length) return hubRadius + Math.max(18, ringDistance * 0.42);
  let baseRadius = 0;
  let maxLeafRadius = 0;
  for (const member of members) {
    maxLeafRadius = Math.max(maxLeafRadius, getCrystalNodeRadius(member));
    baseRadius = Math.max(baseRadius, getCrystalBranchStep(hub, member, ringDistance));
  }
  let rings = Math.max(1, Math.ceil(members.length / Math.max(1, spokes)));
  return baseRadius + (rings - 1) * getCrystalMemberRingStep(members, ringDistance) + maxLeafRadius;
}

function getCrystalSortedIndexes(indexes, nodes) {
  return [...indexes].sort((a, b) => {
    let hashDelta = hashUnit(`${nodes[a].id}:crystal-slot`) - hashUnit(`${nodes[b].id}:crystal-slot`);
    if (Math.abs(hashDelta) > 0.0001) return hashDelta;
    return String(nodes[a].id).localeCompare(String(nodes[b].id));
  });
}

function computeCrystalTargets(rawNodes = [], rawEdges = [], rawGroups = {}, rawOptions = {}) {
  let options = resolveFallbackOptions(rawOptions);
  let nodes = rawNodes.filter((node) => node?.id);
  if (nodes.length === 0) return {};

  let nodeIds = new Set(nodes.map((node) => node.id));
  let nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  let adjacency = nodes.map(() => []);
  let degree = new Array(nodes.length).fill(0);
  let addEdge = (sourceId, targetId) => {
    let source = nodeIndex.get(sourceId);
    let target = nodeIndex.get(targetId);
    if (source === undefined || target === undefined || source === target) return;
    adjacency[source].push(target);
    adjacency[target].push(source);
    degree[source]++;
    degree[target]++;
  };

  for (const edge of rawEdges || []) {
    addEdge(edge?.from ?? edge?.source, edge?.to ?? edge?.target);
  }

  for (const node of nodes) {
    if (node.parentId && nodeIds.has(node.parentId)) addEdge(node.id, node.parentId);
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        if (nodeIds.has(childId)) addEdge(node.id, childId);
      }
    }
  }

  let groups = normalizeForceGroups(rawGroups || {}, nodeIds);
  let preferredHubByMember = new Map();
  for (const [groupId, memberIds] of Object.entries(groups)) {
    if (memberIds.length < 2) continue;
    let hubId = nodeIndex.has(groupId) ? groupId : '';
    if (!hubId) {
      for (const memberId of memberIds) {
        let member = nodes[nodeIndex.get(memberId)];
        if (member?.isGroup) {
          hubId = memberId;
          break;
        }
      }
    }
    if (!hubId) {
      hubId = memberIds[0];
      let maxDegree = -1;
      for (const memberId of memberIds) {
        let index = nodeIndex.get(memberId);
        let memberDegree = index === undefined ? -1 : degree[index];
        if (memberDegree > maxDegree) {
          maxDegree = memberDegree;
          hubId = memberId;
        }
      }
    }
    for (const memberId of memberIds) {
      if (memberId !== hubId) {
        addEdge(hubId, memberId);
        preferredHubByMember.set(memberId, hubId);
      }
    }
  }

  let candidates = nodes
    .map((node, index) => ({ node, index, score: getCrystalTargetNodeScore(node, index, degree) }))
    .sort((a, b) => b.score - a.score || String(a.node.id).localeCompare(String(b.node.id)));
  let activeRootIndex = options.activeVisualNodeId
    ? nodes.findIndex((node) => node.id === options.activeVisualNodeId)
    : -1;
  let rootIndex = activeRootIndex >= 0 ? activeRootIndex : candidates[0]?.index ?? 0;
  let center = getCrystalTargetCenter(nodes);
  let ringDistance = getCrystalRingDistance(options);
  let spokes = getCrystalSpokeCount(options);
  let angleStep = (Math.PI * 2) / spokes;
  let angleJitter = clamp(
    finiteNumber(options.crystalAngleJitter, FALLBACK_DEFAULT_OPTIONS.crystalAngleJitter),
    0,
    0.22
  );
  let hubIndexes = new Set();
  for (const { node, index } of candidates) {
    let childCount = Array.isArray(node.children) ? node.children.length : 0;
    if (node.isGroup || childCount > 0 || degree[index] >= 5) hubIndexes.add(index);
  }
  hubIndexes.add(rootIndex);
  if (hubIndexes.size === 0) hubIndexes.add(candidates[0]?.index ?? 0);

  let hubMembers = new Map([...hubIndexes].map((index) => [index, []]));
  let assignMember = (memberIndex, hubIndex) => {
    if (!hubIndexes.has(hubIndex) || hubIndexes.has(memberIndex) || memberIndex === hubIndex) return false;
    let members = hubMembers.get(hubIndex);
    if (!members.includes(memberIndex)) members.push(memberIndex);
    return true;
  };

  for (let index = 0; index < nodes.length; index++) {
    if (hubIndexes.has(index)) continue;
    let node = nodes[index];
    let assigned = false;
    if (node.parentId && nodeIndex.has(node.parentId)) {
      assigned = assignMember(index, nodeIndex.get(node.parentId));
    }
    if (!assigned && preferredHubByMember.has(node.id)) {
      assigned = assignMember(index, nodeIndex.get(preferredHubByMember.get(node.id)));
    }
    if (!assigned) {
      for (const hubIndex of hubIndexes) {
        let hub = nodes[hubIndex];
        if (Array.isArray(hub.children) && hub.children.includes(node.id)) {
          assigned = assignMember(index, hubIndex);
          break;
        }
      }
    }
    if (!assigned) {
      let adjacentHub = adjacency[index]
        .filter((candidateIndex) => hubIndexes.has(candidateIndex))
        .sort((a, b) => {
          let rootBias = (a === rootIndex ? -1 : 0) - (b === rootIndex ? -1 : 0);
          if (rootBias) return rootBias;
          return getCrystalTargetNodeScore(nodes[b], b, degree) - getCrystalTargetNodeScore(nodes[a], a, degree);
        })[0];
      assigned = assignMember(index, adjacentHub);
    }
    if (!assigned) assignMember(index, rootIndex);
  }

  for (const [hubIndex, members] of hubMembers) {
    hubMembers.set(hubIndex, getCrystalSortedIndexes(members, nodes));
  }

  let hubClusterRadius = new Map();
  for (const hubIndex of hubIndexes) {
    hubClusterRadius.set(
      hubIndex,
      getCrystalClusterRadius(hubIndexes.has(hubIndex) ? nodes[hubIndex] : nodes[rootIndex], hubMembers.get(hubIndex) || [], ringDistance, spokes)
    );
  }

  let hubTargets = new Map();
  hubTargets.set(rootIndex, { x: center.x, y: center.y, angle: -Math.PI / 2, shell: 0 });
  let orderedHubs = [...hubIndexes]
    .filter((index) => index !== rootIndex)
    .sort((a, b) => {
      let linkedDelta = Number(adjacency[rootIndex]?.includes?.(b) || false) - Number(adjacency[rootIndex]?.includes?.(a) || false);
      if (linkedDelta) return linkedDelta;
      return getCrystalTargetNodeScore(nodes[b], b, degree) - getCrystalTargetNodeScore(nodes[a], a, degree)
        || String(nodes[a].id).localeCompare(String(nodes[b].id));
    });
  let rootClusterRadius = hubClusterRadius.get(rootIndex) || ringDistance;
  let hubPadding = Math.max(ringDistance * 1.3, 48);
  for (let slot = 0; slot < orderedHubs.length; slot++) {
    let hubIndex = orderedHubs[slot];
    let ring = Math.floor(slot / spokes);
    let spoke = slot % spokes;
    let jitter = (hashUnit(`${nodes[hubIndex].id}:crystal-hub-angle`) - 0.5) * angleStep * angleJitter;
    let angle = -Math.PI / 2 + spoke * angleStep + jitter;
    let radius = Math.max(
      ringDistance * (3.2 + ring * 1.8),
      rootClusterRadius + (hubClusterRadius.get(hubIndex) || ringDistance) + hubPadding + ring * ringDistance * 1.8
    );
    hubTargets.set(hubIndex, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      angle,
      shell: ring + 1,
    });
  }

  let targets = {};
  for (const hubIndex of hubIndexes) {
    let hubTarget = hubTargets.get(hubIndex) || hubTargets.get(rootIndex);
    let hub = nodes[hubIndex];
    targets[hub.id] = {
      x: hubTarget.x,
      y: hubTarget.y,
      seedX: hubTarget.x,
      seedY: hubTarget.y,
      shell: hubTarget.shell,
      center: true,
    };

    let members = hubMembers.get(hubIndex) || [];
    let ringStep = getCrystalMemberRingStep(members.map((index) => nodes[index]), ringDistance);
    for (let memberSlot = 0; memberSlot < members.length; memberSlot++) {
      let memberIndex = members[memberSlot];
      let member = nodes[memberIndex];
      let ring = Math.floor(memberSlot / spokes);
      let spoke = memberSlot % spokes;
      let jitter = (hashUnit(`${member.id}:crystal-angle`) - 0.5) * angleStep * angleJitter;
      let angle = hubTarget.angle + spoke * angleStep + jitter;
      let radius = getCrystalBranchStep(hub, member, ringDistance) + ring * ringStep;
      targets[member.id] = {
        x: hubTarget.x + Math.cos(angle) * radius,
        y: hubTarget.y + Math.sin(angle) * radius,
        seedX: hubTarget.x + Math.cos(angle) * radius,
        seedY: hubTarget.y + Math.sin(angle) * radius,
        shell: hubTarget.shell + ring + 1,
        center: false,
      };
    }
  }

  for (const { node } of candidates) {
    if (targets[node.id]) continue;
    let angle = -Math.PI / 2 + hashUnit(`${node.id}:crystal-orphan`) * Math.PI * 2;
    let radius = rootClusterRadius + getCrystalNodeRadius(node) + hubPadding;
    targets[node.id] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      seedX: center.x + Math.cos(angle) * radius,
      seedY: center.y + Math.sin(angle) * radius,
      shell: 1,
      center: false,
    };
  }

  return targets;
}

function applyFallbackCrystalForces(nodes, options, alpha) {
  if (options.layoutAlgorithm !== 'crystal') return;
  let strength = clamp(finiteNumber(options.crystalStrength, FALLBACK_DEFAULT_OPTIONS.crystalStrength), 0.01, 0.8);
  let sizeScale = clamp(26 / Math.max(6, Math.sqrt(nodes.length) * 3.2), 0.5, 1);
  for (const node of nodes) {
    if (!Number.isFinite(node.crystalTargetX) || !Number.isFinite(node.crystalTargetY)) continue;
    let scale = getMovementScale(node);
    if (scale <= 0) continue;
    let dx = node.x - node.crystalTargetX;
    let dy = node.y - node.crystalTargetY;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.35) continue;
    let shellScale = node.crystalShell === 0 ? 1.35 : 1;
    let pull = clamp(strength * alpha * 0.95 * sizeScale * shellScale * scale, 0.006, 0.24);
    node.x -= dx * pull;
    node.y -= dy * pull;
    node.vx -= dx * pull * 0.18;
    node.vy -= dy * pull * 0.18;
  }
}

function getFallbackClouds(nodeById, groups, options) {
  let clouds = [];
  if (options.layoutAlgorithm !== 'oil-cloud') return clouds;
  for (const [groupId, memberIds] of Object.entries(groups || {})) {
    let members = memberIds.map((id) => nodeById.get(id)).filter(Boolean);
    if (members.length < 2) continue;
    let cx = 0;
    let cy = 0;
    let totalMass = 0;
    for (const member of members) {
      let mass = getEffectiveMass(member);
      cx += member.x * mass;
      cy += member.y * mass;
      totalMass += mass;
    }
    cx /= Math.max(1, totalMass);
    cy /= Math.max(1, totalMass);
    let radius = 0;
    for (const member of members) {
      let nodeRadius = Math.max(getEffectiveWidth(member), getEffectiveHeight(member)) / 2;
      radius = Math.max(radius, Math.hypot(member.x - cx, member.y - cy) + nodeRadius);
    }
    clouds.push({ id: groupId, members, x: cx, y: cy, radius: radius * 1.12 });
  }
  return clouds;
}

function applyFallbackCloudForces(nodeById, groups, options, alpha) {
  let clouds = getFallbackClouds(nodeById, groups, options);
  if (clouds.length === 0) return;

  for (const cloud of clouds) {
    for (const node of cloud.members) {
      let scale = getMovementScale(node);
      node.vx -= (node.x - cloud.x) * options.wellStrength * alpha * 0.16 * scale;
      node.vy -= (node.y - cloud.y) * options.wellStrength * alpha * 0.16 * scale;
    }
  }

  for (let i = 0; i < clouds.length; i++) {
    for (let j = i + 1; j < clouds.length; j++) {
      let a = clouds[i];
      let b = clouds[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.sqrt(dx * dx + dy * dy) || 1;
      let minDistance = a.radius + b.radius + options.groupDistance * 0.2;
      if (distance >= minDistance) continue;
      let push = ((minDistance - distance) / distance) * options.wellRepulsion * alpha * 0.04;
      let px = dx * push;
      let py = dy * push;
      for (const node of a.members) {
        node.vx -= px / Math.max(1, getEffectiveMass(node));
        node.vy -= py / Math.max(1, getEffectiveMass(node));
      }
      for (const node of b.members) {
        node.vx += px / Math.max(1, getEffectiveMass(node));
        node.vy += py / Math.max(1, getEffectiveMass(node));
      }
    }
  }
}

function resolveFallbackOptions(options = {}) {
  let resolved = { ...FALLBACK_DEFAULT_OPTIONS, ...(options || {}) };
  resolved.alphaMin = finiteNumber(
    options.alphaMin,
    finiteNumber(options.alphaFloor, FALLBACK_DEFAULT_OPTIONS.alphaMin)
  );
  resolved.contAlphaFloor = finiteNumber(
    options.contAlphaFloor,
    finiteNumber(options.alphaFloor, FALLBACK_DEFAULT_OPTIONS.contAlphaFloor)
  );
  resolved.contAlphaTarget = finiteNumber(
    options.contAlphaTarget,
    finiteNumber(options.alphaTarget, FALLBACK_DEFAULT_OPTIONS.contAlphaTarget)
  );
  resolved.initialAlpha = clamp(
    finiteNumber(options.initialAlpha, FALLBACK_DEFAULT_OPTIONS.initialAlpha),
    resolved.contAlphaFloor,
    1
  );
  resolved.layoutAlgorithm = normalizeLayoutAlgorithm(options.layoutAlgorithm);
  resolved.positionOrigin = normalizePositionOrigin(options.positionOrigin ?? resolved.positionOrigin);
  resolved.mode = options.mode === 'continuous' ? 'continuous' : 'converge';
  return resolved;
}

export class ForceLayout {
  /** @type {Worker|null} */
  #worker = null;

  /** @type {boolean} */
  #running = false;

  /** @type {boolean} */
  #paused = false;

  /** @type {object|null} */
  #latestPositions = null;

  /** @type {object|null} */
  #latestMeta = null;

  /** @type {number|null} */
  #rafId = null;

  /** @type {string[]|null} Node ID order for unpacking Float32Array */
  #nodeIds = null;

  /** @type {{id: ReturnType<typeof setTimeout>|number, type: 'raf'|'timeout'}|null} */
  #fallbackTimer = null;

  /** @type {object|null} */
  #fallbackState = null;

  /** @type {Function|null} */
  onTick = null;

  /** @type {Function|null} */
  onDone = null;

  /**
   * Resolve an absolute URL to the ForceWorker script.
   * Uses import.meta.url to anchor the resolution, making it
   * safe across import maps, bundlers, and static serving.
   * @returns {string}
   */
  static defaultWorkerUrl() {
    return new URL('./ForceWorker.js', import.meta.url).href;
  }

  /**
   * @param {string} workerUrl - URL to ForceWorker.js
   */
  constructor(workerUrl) {
    this._workerUrl = workerUrl;
  }

  static createFallbackPositions(data = {}) {
    let nodes = Array.isArray(data.nodes) ? data.nodes : [];
    let positions = {};
    if (nodes.length === 0) return positions;

    let options = resolveFallbackOptions(data.options || {});
    if (options.layoutAlgorithm === 'crystal') {
      let targets = computeCrystalTargets(nodes, data.edges || [], data.groups || {}, options);
      for (const node of nodes) {
        if (!node?.id) continue;
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
          positions[node.id] = { x: node.x, y: node.y };
          continue;
        }
        let target = targets[node.id] || { x: fallbackJitter(node.id, 'x') * 100, y: fallbackJitter(node.id, 'y') * 100 };
        positions[node.id] = { x: target.x, y: target.y };
      }
      return positions;
    }

    let radius = Math.max(120, Math.sqrt(nodes.length) * 95);
    let goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < nodes.length; index++) {
      let node = nodes[index];
      if (!node?.id) continue;
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        positions[node.id] = { x: node.x, y: node.y };
        continue;
      }
      let ring = Math.sqrt((index + 1) / nodes.length) * radius;
      let angle = index * goldenAngle;
      positions[node.id] = {
        x: Math.cos(angle) * ring,
        y: Math.sin(angle) * ring,
      };
    }
    return positions;
  }

  /**
   * Start force simulation.
   * @param {object} data
   * @param {Array<{id: string, x?: number, y?: number, mass?: number, group?: string}>} data.nodes
   * @param {Array<{from: string, to: string, strength?: number}>} data.edges
   * @param {Object<string, string[]>} [data.groups] - { groupId: [nodeId, ...] }
   * @param {object} [data.options] - Override simulation parameters (mode: 'converge'|'continuous')
   */
  start(data) {
    this.stop();

    try {
      let WorkerCtor = globalThis.Worker;
      if (typeof WorkerCtor !== 'function') {
        throw new Error('Worker API is unavailable');
      }
      this.#worker = new WorkerCtor(this._workerUrl);
    } catch (err) {
      this.#startMainThreadFallback(data, err);
      return;
    }
    this.#running = true;
    this.#paused = false;
    this.#nodeIds = null;

    this.#worker.onmessage = (e) => {
      let msg = e.data;


      if (msg.type === 'nodeIds') {
        this.#nodeIds = msg.ids;
        return;
      }

      if (msg.type === 'tick') {

        if (msg.packed && this.#nodeIds) {
          let buf = new Float32Array(msg.packed);
          let positions = {};
          for (let i = 0; i < this.#nodeIds.length; i++) {
            positions[this.#nodeIds[i]] = {
              x: buf[i * 2],
              y: buf[i * 2 + 1],
            };
          }
          this.#latestPositions = positions;
        } else {

          this.#latestPositions = msg.positions;
        }
        this.#latestMeta = {
          alpha: msg.alpha,
          energy: msg.energy,
          iteration: msg.iteration,
        };
        this.#scheduleRender();
      }

      if (msg.type === 'done') {
        this.#latestPositions = msg.positions;
        this.#latestMeta = {
          alpha: msg.alpha,
          energy: msg.energy,
          iteration: msg.iteration ?? msg.iterations,
        };
        this.#flushRender();


        this.onDone?.(msg.positions, msg.iteration);
      }
    };

    this.#worker.onerror = (err) => {
      this.#startMainThreadFallback(data, err);
    };

    this.#worker.postMessage({ type: 'init', ...data });
  }

  /** Stop simulation and terminate Worker. */
  stop() {
    if (this.#worker) {
      this.#worker.postMessage({ type: 'stop' });
    }
    this.#cleanup();
  }

  /** Pause simulation (continuous mode). Worker stays alive. */
  pause() {
    if (!this.#running || this.#paused) return;
    this.#paused = true;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'pause' });
    } else {
      this.#cancelFallbackFrame();
    }
  }

  /** Resume simulation (continuous mode). Gentle reheat. */
  resume() {
    if (!this.#running || !this.#paused) return;
    this.#paused = false;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'resume' });
    } else if (this.#fallbackState) {
      this.#reheatMainThreadFallback(
        this.#fallbackState.options.resumeReheat,
        this.#fallbackState.options.resumeCap
      );
      this.#scheduleMainThreadFallback();
    }
  }

  /**
   * Pin a node at a fixed position (for drag interactions).
   * In continuous mode, triggers local reheat.
   * @param {string} id
   * @param {number} x
   * @param {number} y
   */
  pin(id, x, y) {
    if (!this.#running) return;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'pin', id, x, y });
      return;
    }
    let node = this.#fallbackState?.nodeById.get(id);
    if (!node) return;
    let originOffsetX = this.#fallbackState.options.positionOrigin === 'center' ? 0 : node.w / 2;
    let originOffsetY = this.#fallbackState.options.positionOrigin === 'center' ? 0 : node.h / 2;
    node.fx = finiteNumber(x, node.x) + originOffsetX;
    node.fy = finiteNumber(y, node.y) + originOffsetY;
    node.x = node.fx;
    node.y = node.fy;
    node.vx = 0;
    node.vy = 0;
    this.#paused = false;
    this.#reheatMainThreadFallback(
      this.#fallbackState.options.pinReheat,
      this.#fallbackState.options.pinCap
    );
    this.#scheduleMainThreadFallback();
  }

  /**
   * Release a pinned node.
   * @param {string} id
   */
  unpin(id) {
    if (!this.#running) return;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'unpin', id });
      return;
    }
    let node = this.#fallbackState?.nodeById.get(id);
    if (!node) return;
    delete node.fx;
    delete node.fy;
    this.#paused = false;
    this.#reheatMainThreadFallback(
      this.#fallbackState.options.pinReheat,
      this.#fallbackState.options.pinCap
    );
    this.#scheduleMainThreadFallback();
  }

  /**
   * Update simulation configuration without restarting the worker.
   * @param {object} config
   */
  updateConfig(config) {
    if (!this.#running) return;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'updateConfig', config });
      return;
    }
    if (!this.#fallbackState || !config) return;
    let previous = this.#fallbackState.options;
    let next = resolveFallbackOptions({ ...previous, ...config });
    this.#fallbackState.options = next;
    this.#fallbackState.mode = next.mode;
    if (config.linkDistance !== undefined || config.linkStrength !== undefined) {
      for (const edge of this.#fallbackState.edges) {
        if (edge.group) continue;
        if (config.linkDistance !== undefined) edge.restLength = next.linkDistance;
        if (config.linkStrength !== undefined) edge.strength = next.linkStrength;
      }
    }
    if (config.groupDistance !== undefined || config.groupStrength !== undefined) {
      for (const edge of this.#fallbackState.edges) {
        if (!edge.group) continue;
        if (config.groupDistance !== undefined) edge.restLength = next.groupDistance;
        if (config.groupStrength !== undefined) edge.strength = next.groupStrength;
      }
    }
    this.#reheatMainThreadFallback(next.resumeReheat, next.resumeCap);
    this.#scheduleMainThreadFallback();
  }

  /** @returns {boolean} */
  get running() {
    return this.#running;
  }

  /** @returns {boolean} */
  get paused() {
    return this.#paused;
  }

  #scheduleRender() {
    if (this.#rafId !== null) return;
    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = null;
      this.#flushRender();
    });
  }

  #flushRender() {
    if (this.#latestPositions) {
      this.onTick?.(this.#latestPositions, this.#latestMeta || {});
      this.#latestPositions = null;
      this.#latestMeta = null;
    }
  }

  #startMainThreadFallback(data, err) {
    this.#cleanup();
    if (err) {
      console.warn('[ForceLayout] Worker unavailable; using main-thread fallback.', err);
    }
    this.#fallbackState = this.#createMainThreadFallbackState(data);
    this.#running = true;
    this.#paused = false;
    this.#scheduleMainThreadFallback();
  }

  #cleanup() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#cancelFallbackFrame();
    if (this.#worker) {
      this.#worker.terminate();
      this.#worker = null;
    }
    this.#running = false;
    this.#paused = false;
    this.#nodeIds = null;
    this.#latestMeta = null;
    this.#latestPositions = null;
    this.#fallbackState = null;
  }

  #createMainThreadFallbackState(data = {}) {
    let rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
    let rawEdges = Array.isArray(data.edges) ? data.edges : [];
    let options = resolveFallbackOptions(data.options || {});
    let crystalTargets = options.layoutAlgorithm === 'crystal'
      ? computeCrystalTargets(rawNodes, rawEdges, data.groups || {}, options)
      : {};
    let fallbackPositions = ForceLayout.createFallbackPositions(data);
    let nodes = [];
    let nodeById = new Map();

    for (let index = 0; index < rawNodes.length; index++) {
      let rawNode = rawNodes[index];
      if (!rawNode?.id) continue;
      let position = fallbackPositions[rawNode.id] || {};
      let crystalTarget = crystalTargets[rawNode.id] || {};
      let crystalSeed = options.layoutAlgorithm === 'crystal'
        && !Number.isFinite(rawNode.x)
        && !Number.isFinite(rawNode.y)
        && Number.isFinite(crystalTarget.seedX)
        && Number.isFinite(crystalTarget.seedY)
        ? { x: crystalTarget.seedX, y: crystalTarget.seedY }
        : null;
      let node = {
        id: rawNode.id,
        x: finiteNumber(rawNode.x, finiteNumber(crystalSeed?.x, finiteNumber(position.x, fallbackJitter(rawNode.id, 'x') * 100))),
        y: finiteNumber(rawNode.y, finiteNumber(crystalSeed?.y, finiteNumber(position.y, fallbackJitter(rawNode.id, 'y') * 100))),
        vx: 0,
        vy: 0,
        w: Math.max(1, finiteNumber(rawNode.w, options.nodeWidth || 80)),
        h: Math.max(1, finiteNumber(rawNode.h, options.nodeHeight || 40)),
        mass: normalizeMass(rawNode.mass),
        layoutParticipation: normalizeParticipation(rawNode.layoutParticipation),
        layoutWarmupTicks: Math.max(0, finiteNumber(rawNode.layoutWarmupTicks, 0)),
        layoutSizeScale: normalizeSizeScale(rawNode.layoutSizeScale),
        layoutSizeWarmupTicks: Math.max(0, finiteNumber(rawNode.layoutSizeWarmupTicks, 0)),
        layoutFixedTicks: Math.max(0, finiteNumber(rawNode.layoutFixedTicks, 0)),
        crystalTargetX: crystalTarget.x,
        crystalTargetY: crystalTarget.y,
        crystalShell: crystalTarget.shell,
      };
      node.layoutFixedX = node.x;
      node.layoutFixedY = node.y;
      nodes.push(node);
      nodeById.set(node.id, node);
    }

    let edges = [];
    let edgeKeys = new Set();
    let rawDegree = new Map(nodes.map((node) => [node.id, 0]));
    for (const rawEdge of rawEdges) {
      let sourceId = rawEdge?.from ?? rawEdge?.source;
      let targetId = rawEdge?.to ?? rawEdge?.target;
      if (!nodeById.has(sourceId) || !nodeById.has(targetId)) continue;
      let edgeKey = [sourceId, targetId].sort().join('\0');
      edgeKeys.add(edgeKey);
      rawDegree.set(sourceId, (rawDegree.get(sourceId) || 0) + 1);
      rawDegree.set(targetId, (rawDegree.get(targetId) || 0) + 1);
      edges.push({
        sourceId,
        targetId,
        restLength: finiteNumber(rawEdge.restLength, finiteNumber(rawEdge.distance, options.linkDistance)),
        strength: finiteNumber(rawEdge.strength, options.linkStrength),
        group: false,
      });
    }

    let groups = normalizeForceGroups(data.groups || {}, new Set(nodeById.keys()));
    for (const memberIds of Object.values(groups)) {
      if (memberIds.length < 2) continue;
      let hubId = memberIds[0];
      let maxDegree = -1;
      for (const memberId of memberIds) {
        let degree = rawDegree.get(memberId) ?? 0;
        if (degree > maxDegree) {
          maxDegree = degree;
          hubId = memberId;
        }
      }
      for (const memberId of memberIds) {
        if (memberId === hubId) continue;
        let edgeKey = [hubId, memberId].sort().join('\0');
        if (edgeKeys.has(edgeKey)) continue;
        edgeKeys.add(edgeKey);
        edges.push({
          sourceId: hubId,
          targetId: memberId,
          restLength: finiteNumber(options.groupDistance, FALLBACK_DEFAULT_OPTIONS.groupDistance),
          strength: finiteNumber(options.groupStrength, FALLBACK_DEFAULT_OPTIONS.groupStrength),
          group: true,
        });
      }
    }

    return {
      nodes,
      edges,
      nodeById,
      groups,
      options,
      mode: options.mode,
      alpha: options.initialAlpha,
      iteration: 0,
      initialDoneSent: false,
      maxIterations: Math.max(1, Math.ceil(Math.log(options.alphaMin) / Math.log(1 - options.alphaDecay)) + 1),
    };
  }

  #scheduleMainThreadFallback() {
    if (!this.#fallbackState || !this.#running || this.#paused || this.#fallbackTimer) return;
    let callback = () => {
      this.#fallbackTimer = null;
      this.#stepMainThreadFallback();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this.#fallbackTimer = { id: globalThis.requestAnimationFrame(callback), type: 'raf' };
    } else {
      this.#fallbackTimer = { id: setTimeout(callback, 16), type: 'timeout' };
    }
  }

  #cancelFallbackFrame() {
    if (!this.#fallbackTimer) return;
    if (this.#fallbackTimer.type === 'raf' && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.#fallbackTimer.id);
    } else {
      clearTimeout(this.#fallbackTimer.id);
    }
    this.#fallbackTimer = null;
  }

  #stepMainThreadFallback() {
    let state = this.#fallbackState;
    if (!state || !this.#running || this.#paused) return;

    let energy = this.#tickMainThreadFallback(state);
    state.iteration++;
    let options = state.options;
    let target = state.mode === 'continuous' ? options.contAlphaTarget : options.alphaTarget;
    state.alpha += (target - state.alpha) * clamp(options.alphaDecay, 0.001, 0.9);
    if (state.mode === 'continuous' && state.alpha < options.contAlphaFloor) {
      state.alpha = options.contAlphaFloor;
    }

    let positions = this.#getFallbackPositions(state);
    this.onTick?.(positions, {
      alpha: state.alpha,
      energy,
      iteration: state.iteration,
      fallback: true,
    });

    if (state.mode === 'continuous') {
      if (!state.initialDoneSent && Math.abs(state.alpha - options.contAlphaTarget) < 0.05) {
        state.initialDoneSent = true;
        this.onDone?.(positions, state.iteration);
      }
      if (
        Math.abs(state.alpha - options.contAlphaTarget) < 1e-4 &&
        energy < Math.max(1, state.nodes.length) * 0.01 &&
        options.brownian === 0
      ) {
        this.#paused = true;
        return;
      }
      this.#scheduleMainThreadFallback();
      return;
    }

    if (state.alpha <= options.alphaMin || state.iteration >= state.maxIterations) {
      this.#running = false;
      this.onDone?.(positions, state.iteration);
      return;
    }
    this.#scheduleMainThreadFallback();
  }

  #tickMainThreadFallback(state) {
    let { nodes, edges, options } = state;
    if (nodes.length === 0) return 0;
    let alpha = state.alpha;

    for (const edge of edges) {
      let source = state.nodeById.get(edge.sourceId);
      let target = state.nodeById.get(edge.targetId);
      if (!source || !target) continue;
      let participation = Math.min(getParticipation(source), getParticipation(target));
      if (participation <= 0.01) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
        dx = fallbackJitter(`${source.id}:${target.id}`, 'link-x');
        dy = fallbackJitter(`${source.id}:${target.id}`, 'link-y');
      }
      let distance = Math.sqrt(dx * dx + dy * dy) || 1;
      let linkScale = options.layoutAlgorithm === 'crystal' ? 0.28 : 1;
      let force = ((distance - edge.restLength) / distance) * edge.strength * alpha * participation * linkScale;
      let fx = dx * force;
      let fy = dy * force;
      source.vx += fx / Math.max(1, getEffectiveMass(source));
      source.vy += fy / Math.max(1, getEffectiveMass(source));
      target.vx -= fx / Math.max(1, getEffectiveMass(target));
      target.vy -= fy / Math.max(1, getEffectiveMass(target));
    }

    let chargeScale = options.layoutAlgorithm === 'crystal' ? 0.18 : 1;
    let charge = Math.abs(finiteNumber(options.chargeStrength, FALLBACK_DEFAULT_OPTIONS.chargeStrength)) * alpha * chargeScale;
    for (let i = 0; i < nodes.length; i++) {
      let a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        let b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
          dx = fallbackJitter(`${a.id}:${b.id}`, 'charge-x');
          dy = fallbackJitter(`${a.id}:${b.id}`, 'charge-y');
        }
        let distanceSq = Math.max(dx * dx + dy * dy, 25);
        let forceParticipation = Math.min(getParticipation(a), getParticipation(b));
        let force = charge * getEffectiveMass(a) * getEffectiveMass(b) * forceParticipation / distanceSq;
        a.vx -= dx * force / Math.max(1, getEffectiveMass(a));
        a.vy -= dy * force / Math.max(1, getEffectiveMass(a));
        b.vx += dx * force / Math.max(1, getEffectiveMass(b));
        b.vy += dy * force / Math.max(1, getEffectiveMass(b));

        let distance = Math.sqrt(distanceSq) || 1;
        let massPad = Math.max(0, getEffectiveMass(a) - 1) * 2.4
          + Math.max(0, getEffectiveMass(b) - 1) * 2.4;
        let minDistance = (
          Math.max(getEffectiveWidth(a), getEffectiveHeight(a))
          + Math.max(getEffectiveWidth(b), getEffectiveHeight(b))
        ) / 2 + options.collisionPadding + massPad;
        let collisionParticipation = Math.min(getCollisionParticipation(a), getCollisionParticipation(b));
        if (distance < minDistance && collisionParticipation > 0.05) {
          let push = ((minDistance - distance) / distance) * options.collideStrength * collisionParticipation * 0.5;
          let px = dx * push;
          let py = dy * push;
          a.vx -= px / Math.max(1, getEffectiveMass(a));
          a.vy -= py / Math.max(1, getEffectiveMass(a));
          b.vx += px / Math.max(1, getEffectiveMass(b));
          b.vy += py / Math.max(1, getEffectiveMass(b));
        }
      }
    }

    applyFallbackCloudForces(state.nodeById, state.groups, options, alpha);
    applyFallbackCrystalForces(nodes, options, alpha);

    if (options.layoutAlgorithm !== 'crystal') {
      let centerStrength = finiteNumber(options.centerStrength, 0);
      if (centerStrength <= 0) {
        centerStrength = finiteNumber(options.centerPull, FALLBACK_DEFAULT_OPTIONS.centerPull) * 0.02;
      }
      for (const node of nodes) {
        let scale = getMovementScale(node);
        node.vx -= node.x * centerStrength * alpha * scale;
        node.vy -= node.y * centerStrength * alpha * scale;
        if (options.brownian > 0 && alpha < options.brownianThresh && node.fx === undefined) {
          node.vx += fallbackJitter(`${node.id}:${state.iteration}`, 'brownian-x') * options.brownian;
          node.vy += fallbackJitter(`${node.id}:${state.iteration}`, 'brownian-y') * options.brownian;
        }
      }
    } else if (options.brownian > 0 && alpha < options.brownianThresh) {
      for (const node of nodes) {
        if (node.fx === undefined) node.vx += fallbackJitter(`${node.id}:${state.iteration}`, 'brownian-x') * options.brownian;
        if (node.fy === undefined) node.vy += fallbackJitter(`${node.id}:${state.iteration}`, 'brownian-y') * options.brownian;
      }
    }

    let energy = 0;
    let decay = clamp(1 - finiteNumber(options.velocityDecay, FALLBACK_DEFAULT_OPTIONS.velocityDecay), 0.02, 0.98);
    let maxVelocity = Math.max(80, Math.sqrt(nodes.length) * 40);
    for (const node of nodes) {
      if (node.fx === undefined && node.fy === undefined && node.layoutFixedTicks > 0) {
        node.x = node.layoutFixedX;
        node.y = node.layoutFixedY;
        node.vx = 0;
        node.vy = 0;
        node.layoutFixedTicks -= 1;
      } else if (node.fx !== undefined) {
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
      } else {
        node.vx = clamp(node.vx * decay, -maxVelocity, maxVelocity);
        node.vy = clamp(node.vy * decay, -maxVelocity, maxVelocity);
        node.x += node.vx;
        node.y += node.vy;
      }
      energy += node.vx * node.vx + node.vy * node.vy;
    }
    advanceLayoutParticipation(nodes);
    return energy;
  }

  #getFallbackPositions(state) {
    let positions = {};
    for (const node of state.nodes) {
      positions[node.id] = state.options.positionOrigin === 'center'
        ? { x: node.x, y: node.y }
        : { x: node.x - node.w / 2, y: node.y - node.h / 2 };
    }
    return positions;
  }

  #reheatMainThreadFallback(amount, cap) {
    if (!this.#fallbackState) return;
    this.#fallbackState.alpha = Math.min(
      this.#fallbackState.alpha + finiteNumber(amount, 0.03),
      finiteNumber(cap, 0.1)
    );
  }
}
