// The kit's probe: a chat widget that imports this from the pinned base proves kit modules load there, and `dep`
// proves their own relative imports resolve. Kept as a health check for when the chat sandbox changes.
import { name } from './probe-dep.js';

export const probe = { module: 'kit/probe.js', dep: name };
