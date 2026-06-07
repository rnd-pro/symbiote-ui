const TOKEN_CSS_VARIABLES = {
  keyword: '--sn-syntax-keyword',
  kw: '--sn-syntax-keyword',
  string: '--sn-syntax-string',
  str: '--sn-syntax-string',
  comment: '--sn-syntax-comment',
  cm: '--sn-syntax-comment',
  function: '--sn-syntax-function',
  fn: '--sn-syntax-function',
  number: '--sn-syntax-number',
  num: '--sn-syntax-number',
  builtin: '--sn-syntax-builtin',
  bi: '--sn-syntax-builtin',
  property: '--sn-syntax-property',
  prop: '--sn-syntax-property',
  literal: '--sn-syntax-literal',
  lit: '--sn-syntax-literal',
  doc: '--sn-syntax-doc',
  docTag: '--sn-syntax-doc-tag',
  docType: '--sn-syntax-doc-type',
  template: '--sn-syntax-template',
  templateTag: '--sn-syntax-template-tag',
  templateAttr: '--sn-syntax-template-attr',
  templateBracket: '--sn-syntax-template-bracket',
  templateInterpolation: '--sn-syntax-template-interpolation',
  templateSelector: '--sn-syntax-template-selector',
  templateProperty: '--sn-syntax-template-property',
  templateValue: '--sn-syntax-template-value',
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  return value == null ? '' : String(value);
}

function toTokenVariable(name) {
  let token = cleanString(name).trim();
  if (!token) return '';
  if (token.startsWith('--sn-')) return token;
  return TOKEN_CSS_VARIABLES[token] || '';
}

export function normalizeSourceAction(value, fallbackId = 'source-save') {
  if (!value) return null;
  if (typeof value === 'string') {
    let id = cleanString(value).trim();
    return id ? { id, label: id } : null;
  }

  let data = asObject(value);
  let id = cleanString(data.id || data.name || data.action || data.intent || fallbackId).trim();
  if (!id) return null;

  let action = {
    id,
    label: cleanString(data.label || data.title || id).trim() || id,
  };
  if (data.intent != null || data.event != null) {
    action.intent = cleanString(data.intent || data.event).trim() || id;
  }
  if (data.icon != null) action.icon = cleanString(data.icon).trim();
  if (data.disabled !== undefined) action.disabled = Boolean(data.disabled);
  if (data.payload !== undefined) action.payload = data.payload;
  if (data.metadata && Object.keys(asObject(data.metadata)).length > 0) {
    action.metadata = asObject(data.metadata);
  }
  return action;
}

export function normalizeSourceTokenMap(value) {
  return Object.fromEntries(
    Object.entries(asObject(value))
      .map(([key, token]) => [toTokenVariable(key), cleanString(token).trim()])
      .filter(([key, token]) => key && token)
  );
}

export function normalizeSourceSyntaxTheme(value, fallbackTokens = {}) {
  let tokens = normalizeSourceTokenMap(fallbackTokens);
  if (!value) return Object.keys(tokens).length > 0 ? { tokens } : null;
  if (typeof value === 'string') {
    let id = cleanString(value).trim();
    return id ? { id, tokens } : (Object.keys(tokens).length > 0 ? { tokens } : null);
  }

  let data = asObject(value);
  let theme = {};
  let id = cleanString(data.id || data.name || data.theme).trim();
  if (id) theme.id = id;
  let label = cleanString(data.label || data.title).trim();
  if (label) theme.label = label;

  let themeTokens = normalizeSourceTokenMap(Object.keys(tokens).length > 0 ? tokens : data.tokens);
  if (Object.keys(themeTokens).length > 0) theme.tokens = themeTokens;
  if (data.metadata && Object.keys(asObject(data.metadata)).length > 0) {
    theme.metadata = asObject(data.metadata);
  }
  return Object.keys(theme).length > 0 ? theme : null;
}

export function applySourceSyntaxTheme(target, theme) {
  if (!target?.style) return [];
  for (let variable of target.__snSourceSyntaxVariables || []) {
    target.style.removeProperty(variable);
  }
  let tokens = normalizeSourceTokenMap(theme?.tokens || theme);
  let variables = [];
  for (let [variable, value] of Object.entries(tokens)) {
    target.style.setProperty(variable, value);
    variables.push(variable);
  }
  target.__snSourceSyntaxVariables = variables;
  return variables;
}
