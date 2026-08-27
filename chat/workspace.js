import { loadBrowserComponent } from '../ui/loadBrowserComponent.js';

export let ChatWorkspace = await loadBrowserComponent(
  () => import('./ChatWorkspace/ChatWorkspace.js'),
  'ChatWorkspace',
  'chat-workspace',
);
export default ChatWorkspace;
