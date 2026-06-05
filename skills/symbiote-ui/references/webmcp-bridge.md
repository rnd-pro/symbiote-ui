# WebMCP Bridge Reference

Complete reference for Symbiote UI's integration with the Web Model Context
Protocol (WebMCP) for model-driven tool registration and command events.

## Overview

WebMCP allows Web Components to declare themselves as "tools" that AI models
can discover and invoke. Symbiote UI provides a bridge layer that:

1. Registers component capabilities with `navigator.modelContext` (if available).
2. Falls back gracefully when WebMCP is not supported.
3. Emits `webmcp-command` custom events that the runtime controller forwards via WebSocket.

All functions are exported from `symbiote-ui/webmcp` (file: `webmcp.js`).

## getModelContext(target)

Returns the model context provider, or `null`.

```javascript
import { getModelContext } from 'symbiote-ui/webmcp';

let ctx = getModelContext(document);
// ctx = document.modelContext || navigator.modelContext || null
```

## createToolDescriptor(options)

Creates a plain tool descriptor object (shallow copy).

```javascript
import { createToolDescriptor } from 'symbiote-ui/webmcp';

let descriptor = createToolDescriptor({
  name: 'update-panel',
  description: 'Update panel label and state',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string' },
      state: { type: 'string', enum: ['idle', 'running', 'error'] }
    }
  }
});
```

## createComponentToolDescriptor(component, tool)

Creates a tool descriptor enriched with component metadata.

```javascript
import { createComponentToolDescriptor } from 'symbiote-ui/webmcp';

let descriptor = createComponentToolDescriptor(myPanelElement, {
  name: 'toggle-visibility',
  description: 'Show or hide this panel'
});
// descriptor.description includes component.componentDescription prefix
// descriptor.annotations includes { componentTag, componentClass, semanticRole }
```

**Component description resolution:**
1. `component.componentDescription`
2. `component.agent?.componentDescription`
3. `component.description`
4. `''`

**Annotations added automatically:**
| Key | Source |
|-----|--------|
| `componentTag` | `component.tagName` |
| `componentClass` | `component.className` |
| `semanticRole` | `component.agent?.semanticRole` |

## registerWebMcpTool(options, target)

Registers a tool with the model context provider. Falls back gracefully.

```javascript
import { registerWebMcpTool } from 'symbiote-ui/webmcp';

let { nativeActive, descriptor, unregister } = await registerWebMcpTool({
  name: 'send-chat-message',
  description: 'Send a message in the chat panel',
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message']
  }
});

if (nativeActive) {
  console.log('Tool registered natively with browser WebMCP');
} else {
  console.log('Fallback: tool descriptor created but not registered natively');
}

// Cleanup
unregister();
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `options` | `object` | — | Tool descriptor options (name, description, inputSchema) |
| `target` | `Document` | `globalThis.document` | Document for model context resolution |

**Returns:**
```javascript
{
  nativeActive: boolean,  // true if registered with native WebMCP API
  descriptor: object,     // The tool descriptor object
  unregister: function    // Cleanup function
}
```

**Fallback behavior:**
- If `modelContext` is not available → returns `nativeActive: false` with a plain descriptor.
- If native `ToolDescriptor` import fails → falls back to plain object.
- `unregister()` is always safe to call (noop if no native registration).

## triggerWebMcpCommand(element, command, args)

Dispatches a `webmcp-command` CustomEvent that bubbles through the DOM.

```javascript
import { triggerWebMcpCommand } from 'symbiote-ui/webmcp';

triggerWebMcpCommand(myElement, 'refresh-data', { source: 'timer', interval: 5000 });
```

The event:
- `type`: `'webmcp-command'`
- `bubbles`: `true`
- `composed`: `true` (crosses Shadow DOM boundaries)
- `detail`: `{ command: string, args: object }`

## Integration with Runtime Controller

When the runtime controller is connected via WebSocket, it listens for
`webmcp-command` events on the root element:

```javascript
root.addEventListener('webmcp-command', (e) => {
  ws.send(JSON.stringify({
    method: 'command',
    params: e.detail
  }));
});
```

This means any component in the subtree can trigger commands that reach the
server without direct WebSocket access — just by dispatching the custom event.
