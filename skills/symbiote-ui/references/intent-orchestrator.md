# Intent Orchestrator Reference

Complete reference for `executeAgentIntent` — the agent intent orchestrator
with best-effort rollback for supported reversible effects.

## Function Signature

```javascript
async function executeAgentIntent(controller, intent, options)
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `controller` | `object` | A `createRuntimeUiController` instance |
| `intent` | `object` | The agent intent operation object |
| `options.document` | `Document` | DOM document for selectors |
| `options.root` | `Element` | Root element for layout actions |
| `options.onRegisterDriver` | `async function(params)` | Callback for `register-driver` operations |
| `options.allowIrreversible` | `boolean` | Host approval for one dedicated irreversible operation |
| `options.intentPolicy` | `object` | Host operation, component, target, method, and validation policy |

**Returns:** `{ success: true, executedCount: number }`

**Throws:** On validation or execution failure, after attempting best-effort
rollback for supported prior effects.

## Intent Schema (agent-intent-v1)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rnd-pro.github.io/symbiote-ui/schemas/agent-intent-v1.json",
  "type": "object",
  "required": ["version", "intentId", "operations"],
  "properties": {
    "version": { "const": "agent-intent-v1" },
    "intentId": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "metadata": { "type": "object" },
    "operations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "params"],
        "properties": {
          "type": {
            "enum": ["register-driver", "register-component", "layout", "ui", "theme", "state"]
          },
          "params": { "type": "object" }
        }
      },
      "minItems": 1
    }
  }
}
```

## Operation Types

### register-component

Registers a Web Component via `controller.dynamicRegistry.register()`.

This operation is **irreversible** because the browser has no unregister API.
It has no rollback action and must not share an intent with another operation.

**Security and routing requirements:**

- Requires host `allowIrreversible` policy.
- Must run in a **dedicated single-operation intent**.
- Accepts only trusted local/host-authored component source. Dynamic-registry
  validation is lexical and loads code in the current page realm; it is not
  isolation.

```json
{
  "type": "register-component",
  "params": {
    "tagName": "my-widget",
    "code": "export default class DynamicWidget extends HTMLElement {}",
    "options": { "allowOverride": false }
  }
}
```

Accepts `params.codeOrClass` or `params.code` for the component source.

### register-driver

Invokes `options.onRegisterDriver(params)` when the host supplies that callback.

```json
{
  "type": "register-driver",
  "params": { "driverType": "automation/chat-handler", "config": {} }
}
```

The orchestrator does not manage drivers directly. Without
`options.onRegisterDriver`, the current runtime records a successful
irreversible no-op and increments `executedCount`; hosts that require a real
driver load must supply the callback or deny this operation. Driver registration
requires `allowIrreversible` and a dedicated single-operation intent.

### layout

Applies a layout panel action via `applyRuntimeLayoutAction()`.

```json
{
  "type": "layout",
  "params": {
    "action": { "type": "open-panel", "panelType": "sym-inspector" },
    "options": {}
  }
}
```

**Rollback:** If the action was `open-panel`, rollback generates `remove-ui-panel`.
The `remove-ui-panel` action itself is irreversible and requires a dedicated,
host-approved intent.

### ui

Creates or destroys component instances.

**Create:**
```json
{
  "type": "ui",
  "params": {
    "action": "create",
    "node": { "id": "chat-1", "component": "sym-chat", "props": { "placeholder": "Type..." } },
    "targetSelector": "#workspace",
    "parentId": null
  }
}
```

**Destroy:**
```json
{
  "type": "ui",
  "params": { "action": "destroy", "id": "chat-1" }
}
```

**Rollback for `create`:** calls `controller.destroy(id)`.
The `destroy` action itself is irreversible and requires a dedicated,
host-approved intent.

### theme

Applies cascade theme to a target element.

```json
{
  "type": "theme",
  "params": {
    "targetSelector": "#workspace",
    "presets": { "color": "carbon", "skin": "compact", "motion": "fast" },
    "options": { "mode": "dark", "hue": 218 }
  }
}
```

If `params.presets` is provided, it's resolved via `resolveThemePresets()` and
merged with `params.options` before calling `applyCascadeTheme()`.

**Rollback:** Captures all CSS custom property values on the target element
before applying and restores them on failure.

### state

Updates an existing component's state.

```json
{
  "type": "state",
  "params": {
    "id": "chat-1",
    "state": {
      "props": { "placeholder": "Ask anything..." },
      "attrs": { "data-engine-state": "running" }
    }
  }
}
```

**Rollback:** Captures original prop values and attribute values before updating,
and attempts to restore them on failure. Invoked method effects are not
reversible.

## Rollback Algorithm

1. Operations execute **sequentially** (order matters).
2. Each successful operation is pushed to an `executed` stack with rollback data.
3. On **any failure**, the stack is iterated in **reverse order** and the listed
   rollback actions are attempted:
   - `register-component` and `register-driver` (irreversible) → skipped (no
     rollback action)
   - `ui-create` → `controller.destroy(id)`
   - `layout` with rollback action → `applyRuntimeLayoutAction(root, rollbackAction)`
   - `theme` → restore original CSS custom properties on the target element
   - `state` → `controller.update(id, originalState)`
4. Layout actions without a generated rollback action and invoked state methods
   are not reversed.
5. After rollback attempts finish, the original error is re-thrown.
6. Rollback errors are logged and suppressed so the remaining attempts continue.

## Complete Example

```javascript
import { createRuntimeUiController, executeAgentIntent } from 'symbiote-ui/runtime';

let controller = createRuntimeUiController({ document, root: document.body });

try {
  let result = await executeAgentIntent(controller, {
    version: 'agent-intent-v1',
    intentId: 'deploy-monitoring-dashboard',
    description: 'Create monitoring panel with PCB theme',
    operations: [
      {
        type: 'ui',
        params: {
          action: 'create',
          node: { id: 'monitor-panel', component: 'sym-panel', props: { label: 'Metrics' } },
          targetSelector: '#main-workspace',
        },
      },
      {
        type: 'theme',
        params: {
          targetSelector: '#main-workspace',
          presets: { color: 'pcb', skin: 'compact', motion: 'fast' },
        },
      },
      {
        type: 'state',
        params: {
          id: 'monitor-panel',
          state: { attrs: { 'data-engine-state': 'running' } },
        },
      },
    ],
  }, { document });

  console.log('Success:', result.executedCount, 'operations');
} catch (err) {
  // Best-effort rollback has been attempted for supported prior effects.
  console.error('Intent failed:', err.message);
}
```
