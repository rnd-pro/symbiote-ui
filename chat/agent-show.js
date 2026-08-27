import { buildChatMessageItems } from './message-model.js';

export const AGENT_SHOW_PROVIDER_VERSION = 'agent-show-provider-v1';

function clone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeMessage(message) {
  if (typeof message === 'string') {
    return { role: 'agent', text: message, parts: [{ type: 'text', text: message }], done: true };
  }
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError('agent response messages must be strings or objects');
  }
  let role = message.role === 'assistant' ? 'agent' : String(message.role || 'agent');
  if (!['agent', 'user', 'system', 'tool', 'thinking', 'board'].includes(role)) {
    throw new TypeError(`unsupported agent message role "${role}"`);
  }
  return {
    ...clone(message),
    role,
    done: message.done !== false,
  };
}

function normalizeResponse(response) {
  if (response == null) return [];
  if (typeof response === 'string' || Array.isArray(response)) {
    let messages = Array.isArray(response) ? response : [response];
    return messages.map(normalizeMessage);
  }
  if (typeof response !== 'object') throw new TypeError('agent provider respond() returned an unsupported value');
  let messages = Array.isArray(response.messages)
    ? response.messages
    : response.message !== undefined
      ? [response.message]
      : [response];
  return messages.map(normalizeMessage);
}

function matchesValue(expected, actual, request) {
  if (typeof expected === 'function') return Boolean(expected(actual, request));
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
  return expected === actual;
}

function matchesRoute(route, request) {
  let when = route?.when;
  if (typeof when === 'function') return Boolean(when(request));
  if (!when || typeof when !== 'object') return true;
  return Object.entries(when).every(([key, expected]) => matchesValue(expected, request[key], request));
}

function scriptedResponse(route, request) {
  let response = route?.response ?? route?.respond;
  return typeof response === 'function' ? response(request) : clone(response);
}

export function createScriptedAgentProvider({ routes = [], fallback = null } = {}) {
  if (!Array.isArray(routes)) throw new TypeError('scripted agent routes must be an array');
  return Object.freeze({
    async respond(request = {}) {
      let route = routes.find((candidate) => matchesRoute(candidate, request));
      if (route) return scriptedResponse(route, request);
      if (typeof fallback === 'function') return fallback(request);
      return clone(fallback);
    },
  });
}

export function assertAgentShowProvider(provider) {
  if (!provider || typeof provider.respond !== 'function') {
    throw new TypeError('agent show provider must expose respond(request)');
  }
  return provider;
}

export function markCurrentContextualActions(items = []) {
  let latest = null;
  for (let itemIndex = items.length - 1; itemIndex >= 0 && !latest; itemIndex -= 1) {
    let parts = Array.isArray(items[itemIndex]?.parts) ? items[itemIndex].parts : [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      if (parts[partIndex]?.type === 'actions') {
        latest = { itemIndex, partIndex };
        break;
      }
    }
  }
  return items.map((item, itemIndex) => ({
    ...item,
    parts: (Array.isArray(item?.parts) ? item.parts : []).map((part, partIndex) => {
      if (part?.type !== 'actions') return part;
      let actionState = latest?.itemIndex === itemIndex && latest.partIndex === partIndex
        ? 'current'
        : 'historical';
      return { ...part, meta: { ...(part.meta || {}), actionState } };
    }),
  }));
}

export class AgentShowConversation {
  constructor({ provider, messages = [], onChange } = {}) {
    this._provider = provider ? assertAgentShowProvider(provider) : null;
    this._messages = Array.isArray(messages) ? messages.map(normalizeMessage) : [];
    this._onChange = typeof onChange === 'function' ? onChange : null;
  }

  setProvider(provider) {
    this._provider = assertAgentShowProvider(provider);
    return this;
  }

  setMessages(messages = []) {
    if (!Array.isArray(messages)) throw new TypeError('agent show messages must be an array');
    this._messages = messages.map(normalizeMessage);
    this._notify();
    return this.messages;
  }

  append(message) {
    let normalized = normalizeMessage(message);
    this._messages.push(normalized);
    this._notify();
    return normalized;
  }

  async respond(request = {}) {
    let provider = assertAgentShowProvider(this._provider);
    let type = request.type === 'action' ? 'action' : 'message';
    let input = String(request.input || '').trim();
    if (type === 'message') {
      if (!input) return [];
      this._messages.push(normalizeMessage({
        role: 'user',
        text: input,
        parts: [{ type: 'text', text: input }],
      }));
      this._notify();
    }
    let { signal, ...serializableRequest } = request;
    let providerRequest = Object.freeze({
      version: AGENT_SHOW_PROVIDER_VERSION,
      ...clone(serializableRequest),
      type,
      ...(type === 'message' ? { input } : {}),
      messages: Object.freeze(clone(this._messages)),
      ...(signal ? { signal } : {}),
    });
    let messages = normalizeResponse(await provider.respond(providerRequest));
    this._messages.push(...messages);
    this._notify();
    return messages;
  }

  get messages() {
    return clone(this._messages);
  }

  get messageItems() {
    return markCurrentContextualActions(buildChatMessageItems(this._messages).items);
  }

  _notify() {
    this._onChange?.({ messages: this.messages, messageItems: this.messageItems });
  }
}
