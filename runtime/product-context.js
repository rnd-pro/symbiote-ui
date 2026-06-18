export const PRODUCT_CONTEXT_VERSION = 'product-context-v1';
export const PRODUCT_CONTEXT_SCHEMA_ID = 'https://rnd-pro.github.io/symbiote-ui/schemas/product-context-v1.json';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRecord(value) {
  return isObject(value) ? { ...value } : {};
}

function normalizeText(value, fallback = '') {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeId(value, fallback = '') {
  let text = normalizeText(value, fallback);
  return text.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeToolName(value, productId = '') {
  let base = normalizeText(value);
  let prefix = normalizeText(productId).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let name = base || (prefix ? `${prefix}_action` : 'product_action');
  name = name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!/^[a-zA-Z_]/.test(name)) name = `product_${name}`;
  return name || 'product_action';
}

function normalizeStringArray(value) {
  let items = Array.isArray(value) ? value : (value == null ? [] : [value]);
  return [...new Set(items.map((item) => normalizeText(item)).filter(Boolean))];
}

function normalizeSchema(schema) {
  if (isObject(schema)) return { ...schema };
  return {
    type: 'object',
    additionalProperties: true,
  };
}

function normalizeProduct(source = {}) {
  let product = isObject(source.product) ? source.product : source;
  let id = normalizeId(product.id || product.productId || product.name, 'product');
  return {
    id,
    name: normalizeText(product.name || product.label || product.title, id),
    category: normalizeText(product.category || product.type, 'product'),
    description: normalizeText(product.description || product.summary),
    url: normalizeText(product.url || product.href),
    metadata: normalizeRecord(product.metadata),
  };
}

function normalizeView(source = {}, index = 0) {
  let id = normalizeId(source.id || source.viewId || source.name, `view-${index + 1}`);
  return {
    id,
    label: normalizeText(source.label || source.title || source.name, id),
    route: normalizeText(source.route || source.path || source.href, `#${id}`),
    description: normalizeText(source.description || source.summary),
    componentRefs: normalizeStringArray(source.componentRefs || source.components),
    entityRefs: normalizeStringArray(source.entityRefs || source.entities),
    actionRefs: normalizeStringArray(source.actionRefs || source.actions),
    active: Boolean(source.active),
    metadata: normalizeRecord(source.metadata),
  };
}

function normalizeComponentRef(source = {}, index = 0) {
  let component = normalizeText(source.component || source.tagName || source.tag);
  let id = normalizeId(source.id || source.refId || source.componentId || component, `component-${index + 1}`);
  return {
    id,
    component,
    componentId: normalizeText(source.componentId || source.runtimeId || source.elementId),
    selector: normalizeText(source.selector),
    viewId: normalizeId(source.viewId || source.view),
    role: normalizeText(source.role || source.semanticRole, component || 'component'),
    description: normalizeText(source.description || source.summary),
    entityRefs: normalizeStringArray(source.entityRefs || source.entities),
    actionRefs: normalizeStringArray(source.actionRefs || source.actions),
    metadata: normalizeRecord(source.metadata),
  };
}

function normalizeEntity(source = {}, index = 0) {
  let id = normalizeId(source.id || source.entityId || source.key || source.label, `entity-${index + 1}`);
  return {
    id,
    type: normalizeText(source.type || source.kind, 'entity'),
    label: normalizeText(source.label || source.title || source.name, id),
    description: normalizeText(source.description || source.summary),
    status: normalizeText(source.status || source.state),
    componentRefs: normalizeStringArray(source.componentRefs || source.components),
    actionRefs: normalizeStringArray(source.actionRefs || source.actions),
    data: isObject(source.data) ? { ...source.data } : undefined,
    metadata: normalizeRecord(source.metadata),
  };
}

function normalizeAction(source = {}, index = 0, productId = '') {
  let id = normalizeId(source.id || source.actionId || source.name || source.title, `action-${index + 1}`);
  let explicitName = source.name || source.toolName;
  let name = normalizeToolName(explicitName || `${productId}-${id}`, productId);
  return {
    id,
    name,
    title: normalizeText(source.title || source.label || source.name, id),
    description: normalizeText(source.description || source.summary),
    type: normalizeText(source.type || source.kind || 'intent'),
    inputSchema: normalizeSchema(source.inputSchema || source.schema),
    componentRefs: normalizeStringArray(source.componentRefs || source.components),
    entityRefs: normalizeStringArray(source.entityRefs || source.entities),
    viewRefs: normalizeStringArray(source.viewRefs || source.views),
    eventName: normalizeText(source.eventName || source.event),
    intent: normalizeRecord(source.intent),
    permission: normalizeText(source.permission || source.permissionHint),
    destructive: Boolean(source.destructive),
    allowed: source.allowed !== false,
    metadata: normalizeRecord(source.metadata),
  };
}

function normalizeEventLogItem(source = {}, index = 0) {
  let id = normalizeId(source.id || source.eventId || source.title, `event-${index + 1}`);
  return {
    id,
    type: normalizeText(source.type || source.kind || 'event'),
    title: normalizeText(source.title || source.label, id),
    detail: normalizeText(source.detail || source.description || source.summary),
    status: normalizeText(source.status || source.state),
    timestamp: normalizeText(source.timestamp || source.time),
    viewId: normalizeId(source.viewId || source.view),
    actionId: normalizeId(source.actionId || source.action),
    entityId: normalizeId(source.entityId || source.entity),
    componentRefId: normalizeId(source.componentRefId || source.componentRef),
    data: isObject(source.data) ? { ...source.data } : undefined,
    metadata: normalizeRecord(source.metadata),
  };
}

function buildProductSummary(product, views = []) {
  let viewText = views.length ? ` Views: ${views.map((view) => view.label).join(', ')}.` : '';
  return `${product.name}: ${product.description || product.category}.${viewText}`.trim();
}

function normalizeProductWebMcp(product, actions = [], views = [], source = {}) {
  let webmcp = isObject(source.webmcp) ? source.webmcp : {};
  let productDescription = normalizeText(
    webmcp.productDescription || source.agent?.productDescription,
    buildProductSummary(product, views)
  );
  return {
    mode: actions.length ? 'product-actions' : 'described-only',
    productDescription,
    toolNames: actions.map((action) => action.name),
    componentContext: 'Product context links domain entities and actions to neutral symbiote-ui component contracts.',
    actionPolicy: 'Actions are host-owned product intents; descriptors do not execute product policy by themselves.',
    references: normalizeStringArray(webmcp.references),
  };
}

function normalizeAgentContext(product, views = [], source = {}) {
  let agent = isObject(source.agent) ? source.agent : {};
  return {
    summary: normalizeText(agent.summary, buildProductSummary(product, views)),
    usage: normalizeText(agent.usage, `Use this context to inspect and operate ${product.name}.`),
    audience: normalizeText(agent.audience || agent.userRole),
    constraints: normalizeStringArray(agent.constraints),
  };
}

export function normalizeProductContext(input = {}) {
  let source = isObject(input) ? input : {};
  let product = normalizeProduct(source);
  let views = (Array.isArray(source.views) ? source.views : []).map(normalizeView);
  let componentRefs = (Array.isArray(source.componentRefs) ? source.componentRefs : [])
    .map(normalizeComponentRef);
  let entities = (Array.isArray(source.entities) ? source.entities : []).map(normalizeEntity);
  let actions = (Array.isArray(source.actions) ? source.actions : [])
    .map((action, index) => normalizeAction(action, index, product.id));
  let eventSource = Array.isArray(source.eventLog)
    ? source.eventLog
    : (Array.isArray(source.events) ? source.events : []);
  let eventLog = eventSource.map(normalizeEventLogItem);
  let agent = normalizeAgentContext(product, views, source);
  let webmcp = normalizeProductWebMcp(product, actions, views, source);

  return {
    version: PRODUCT_CONTEXT_VERSION,
    schema: PRODUCT_CONTEXT_SCHEMA_ID,
    product,
    agent,
    views,
    componentRefs,
    entities,
    actions,
    eventLog,
    webmcp,
    metadata: normalizeRecord(source.metadata),
  };
}

export function createProductContextAgentView(input = {}) {
  let context = normalizeProductContext(input);
  return {
    version: context.version,
    product: context.product,
    summary: context.agent.summary,
    usage: context.agent.usage,
    views: context.views,
    componentRefs: context.componentRefs,
    entities: context.entities,
    actions: context.actions,
    eventLog: context.eventLog,
    webmcp: context.webmcp,
  };
}
