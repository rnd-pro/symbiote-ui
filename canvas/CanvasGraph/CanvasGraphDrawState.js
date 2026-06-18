export function resolveViewportAnimation(options) {
  let {
    zoom,
    targetZoom,
    panX,
    panY,
    targetPanX,
    targetPanY,
    zoomAnchor,
    viewportEase = 0.15,
  } = options;
  let ease = Math.max(0.015, Math.min(0.35, Number.isFinite(viewportEase) ? viewportEase : 0.15));

  let next = {
    zoom,
    panX,
    panY,
    targetPanX,
    targetPanY,
  };

  let zoomAnimating = Math.abs(targetZoom - zoom) > 0.0001;
  if (zoomAnimating) {
    let oldZoom = zoom;
    next.zoom += (targetZoom - zoom) * ease;
    if (zoomAnchor) {
      let { mx, my } = zoomAnchor;
      next.panX = mx - (mx - panX) * (next.zoom / oldZoom);
      next.panY = my - (my - panY) * (next.zoom / oldZoom);
    }
  }

  if (targetPanX !== null) {
    let panDx = targetPanX - next.panX;
    let panDy = targetPanY - next.panY;
    if (Math.abs(panDx) < 0.5 && Math.abs(panDy) < 0.5) {
      next.panX = targetPanX;
      next.panY = targetPanY;
      next.targetPanX = null;
      next.targetPanY = null;
    } else {
      next.panX += panDx * ease;
      next.panY += panDy * ease;
    }
  }

  return next;
}

export function getNextPulseQueue({ pulses = [], nodeId, startTime, duration, waves = 1 }) {
  return [
    ...pulses.filter((pulse) => pulse.id !== nodeId),
    { id: nodeId, startTime, duration, waves },
  ];
}

export function findActiveTransitionMarker(markers = [], nodeId, now) {
  let id = String(nodeId || '').trim();
  if (!id) return null;
  for (let marker of markers || []) {
    if (marker?.toId !== id) continue;
    let duration = Math.max(1, marker.duration || 850);
    let elapsed = now - marker.startTime;
    if (elapsed >= 0 && elapsed < duration) return marker;
  }
  return null;
}

export const CANVAS_GRAPH_LAYER_TARGETS = Object.freeze({
  scale: Object.freeze([1.14, 0.96, 0.88, 0.78, 0.68]),
  opacity: Object.freeze([1, 0.52, 0.24, 0.07, 0.02]),
  blur: Object.freeze([0, 0.4, 1.6, 3.5, 6]),
  parallax: Object.freeze([0, 0.02, 0.045, 0.075, 0.11]),
});

export function resolveGroupOrbitRotationFrame(options) {
  let {
    rotation = 0,
    rotationSpeed = 0,
    hovered = false,
    dragged = false,
  } = options;

  let targetSpeed = (hovered || dragged) ? 0.025 : 0;
  let nextSpeed = rotationSpeed + (targetSpeed - rotationSpeed) * 0.05;
  if (Math.abs(nextSpeed) < 0.0001) nextSpeed = 0;

  return {
    rotation: rotation + nextSpeed,
    rotationSpeed: nextSpeed,
  };
}

export function resolveDeactivationFrame(options) {
  let { deactivating, activeNode, nextActiveNode, layerAnim } = options;
  let settled = Math.abs(layerAnim[0].scale - 1) < 0.01
    && Math.abs(layerAnim[4].scale - 1) < 0.01;

  if (!deactivating || !activeNode || !settled) {
    return {
      activeNode,
      nextActiveNode,
      deactivating,
      deselected: false,
      interactionDepthsChanged: false,
    };
  }

  if (nextActiveNode) {
    return {
      activeNode: nextActiveNode,
      nextActiveNode: null,
      deactivating: false,
      deselected: false,
      interactionDepthsChanged: true,
    };
  }

  return {
    activeNode: null,
    nextActiveNode: null,
    deactivating: false,
    deselected: true,
    interactionDepthsChanged: true,
  };
}

export function resolveCanvasGraphEdgeFocus(options) {
  let {
    edge,
    focusNodeId,
    alpha = 0.5,
    width = 1.5,
  } = options;
  let id = String(focusNodeId || '').trim();
  if (!id) {
    return { active: false, alpha, width };
  }

  let active = edge?.from === id || edge?.to === id;
  if (active) {
    return {
      active,
      alpha: Math.max(alpha, 0.95),
      width: Math.max(width, 2.4),
    };
  }

  return {
    active,
    alpha: Math.min(alpha, 0.16),
    width: Math.min(width, 1),
  };
}

export function getLayerAnimationFrame(options) {
  let { layerAnim, layerTargets, isIdle, inGroupMode } = options;
  let next = {};
  let lerpSpeed = isIdle ? 0.08 : 0.06;

  for (let d = 0; d <= 4; d++) {
    let la = layerAnim[d];
    let tScale = isIdle ? 1 : layerTargets.scale[d];
    let tOpacity = isIdle ? 1 : layerTargets.opacity[d];
    let tParallax = isIdle ? 0 : layerTargets.parallax[d];
    let speed = (inGroupMode && d >= 3) ? 0.3 : lerpSpeed;

    next[d] = {
      ...la,
      scale: la.scale + (tScale - la.scale) * speed,
      opacity: la.opacity + (tOpacity - la.opacity) * speed,
      parallax: la.parallax + (tParallax - la.parallax) * speed,
    };
  }

  return next;
}

export function resolveFocusFrame(options) {
  let {
    activeNode,
    deactivating,
    activePosition,
    infoPanel,
    canvasRect,
    dpr,
    zoom,
    panX,
    panY,
    focusX,
    focusY,
    focusActive,
    vcx,
    vcy,
  } = options;

  let next = {
    focusX,
    focusY,
    focusActive,
    dragDeltaX: 0,
    dragDeltaY: 0,
    targetPanX: null,
    targetPanY: null,
    centeredForNode: infoPanel?._centeredForNode,
  };

  if (activeNode && !deactivating && !activePosition) {
    return next;
  }

  if (activeNode && !deactivating) {
    if (infoPanel?._centeredForNode !== activeNode.id && infoPanel.totalExtent > 0) {
      next.centeredForNode = activeNode.id;
      let panelOffsetX = infoPanel.totalExtent / 2;
      let panelOffsetY = infoPanel.totalExtentY / 2;
      if (canvasRect?.width > 0) {
        next.targetPanX = canvasRect.width / 2 - (activePosition.x + panelOffsetX) * zoom;
        next.targetPanY = canvasRect.height / 2 - (activePosition.y + panelOffsetY) * zoom;
      }
    }

    let targetFX = dpr * zoom * activePosition.x + dpr * panX;
    let targetFY = dpr * zoom * activePosition.y + dpr * panY;
    if (!focusActive) {
      next.focusX = targetFX;
      next.focusY = targetFY;
      next.focusActive = true;
    } else {
      next.focusX += (targetFX - focusX) * 0.12;
      next.focusY += (targetFY - focusY) * 0.12;
    }
    next.dragDeltaX = next.focusX - vcx;
    next.dragDeltaY = next.focusY - vcy;
    return next;
  }

  next.focusX += (vcx - focusX) * 0.08;
  next.focusY += (vcy - focusY) * 0.08;
  next.dragDeltaX = next.focusX - vcx;
  next.dragDeltaY = next.focusY - vcy;
  if (Math.abs(next.dragDeltaX) < 1 && Math.abs(next.dragDeltaY) < 1) {
    next.focusActive = false;
    next.dragDeltaX = 0;
    next.dragDeltaY = 0;
  }

  return next;
}

export function getDepthGroupsFrame(options) {
  let { edges, nodes, activeNode, dragNode, hoverNode } = options;
  let groups = {
    0: { edges: [], nodes: [] },
    1: { edges: [], nodes: [] },
    2: { edges: [], nodes: [] },
    3: { edges: [], nodes: [] },
    4: { edges: [], nodes: [] },
  };
  let focusNodes = [];

  for (let edge of edges) {
    groups[edge.targetDepth !== undefined ? edge.targetDepth : 4].edges.push(edge);
  }

  for (let node of nodes) {
    if (node === activeNode || node === dragNode || node === hoverNode) {
      focusNodes.push(node);
    } else {
      groups[node.targetDepth !== undefined ? node.targetDepth : 4].nodes.push(node);
    }
  }

  for (let node of focusNodes) {
    groups[node.targetDepth !== undefined ? node.targetDepth : 4].nodes.push(node);
  }

  return groups;
}

export function resolveIdleFrame(options) {
  let {
    targetZoom,
    zoom,
    dragDeltaX,
    dragDeltaY,
    prevDragDeltaX,
    prevDragDeltaY,
    layerAnim,
    isIdle,
    layerTargets,
    lastAlpha,
    dragNode,
    isPanning,
    deactivating,
    targetPanX,
    infoPanel,
    nodeAppearancesActive = false,
    pulsesActive = false,
    statusAnimationsActive = false,
    idleFrames,
  } = options;

  let zoomSettled = Math.abs(targetZoom - zoom) < 0.001;
  let focusMovement = Math.abs(dragDeltaX - prevDragDeltaX) + Math.abs(dragDeltaY - prevDragDeltaY);
  let focusSettled = focusMovement < 0.1;
  let layerTarget = isIdle ? 1 : layerTargets.scale[0];
  let layerSettled = layerAnim[0] && Math.abs(layerAnim[0].scale - layerTarget) < 0.005;
  let workerActive = lastAlpha > 0.001;
  let hasDrag = !!dragNode || isPanning;
  let hasActiveAnim = deactivating;
  let hasPanAnim = targetPanX !== null;
  let infoPanelAnimating = infoPanel.opacity > 0.01
    && (infoPanel.opacity < 0.99 || infoPanel.lines.some((line) => line.revealed < line.text.length));

  let shouldIdle = zoomSettled
    && focusSettled
    && layerSettled
    && !workerActive
    && !hasDrag
    && !hasActiveAnim
    && !hasPanAnim
    && !nodeAppearancesActive
    && !pulsesActive
    && !statusAnimationsActive
    && !infoPanelAnimating;

  let nextIdleFrames = shouldIdle ? idleFrames + 1 : 0;
  return {
    idleFrames: nextIdleFrames,
    prevDragDeltaX: dragDeltaX,
    prevDragDeltaY: dragDeltaY,
    shouldStop: nextIdleFrames > 3,
  };
}
