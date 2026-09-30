export * from './agent-show.js';
export * from './show-player-contract.js';

import { loadBrowserComponent } from '../ui/loadBrowserComponent.js';

// Reuse a workspace registered by an existing application bundle before any
// transitive chat modules from this independently built entrypoint are loaded.
await loadBrowserComponent(
  () => import('./workspace.js'),
  'ChatWorkspace',
  'chat-workspace',
);

await loadBrowserComponent(
  () => import('../layout/Layout/Layout.js'),
  'Layout',
  'panel-layout',
);

export let ChatShowPlayer = await loadBrowserComponent(
  () => import('./ChatShowPlayer/ChatShowPlayer.js'),
  'ChatShowPlayer',
  'chat-show-player',
);

export let AgentShowChat = await loadBrowserComponent(
  () => import('./AgentShowChat/AgentShowChat.js'),
  'AgentShowChat',
  'agent-show-chat',
);

export let AgentDockShell = await loadBrowserComponent(
  () => import('./AgentDockShell/AgentDockShell.js'),
  'AgentDockShell',
  'agent-dock-shell',
);

export default AgentShowChat;
