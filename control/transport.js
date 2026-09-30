import { loadBrowserComponent } from '../ui/loadBrowserComponent.js';

export let Transport = await loadBrowserComponent(
  () => import('./Transport/Transport.js'),
  'Transport',
  'sn-transport',
);
export default Transport;
