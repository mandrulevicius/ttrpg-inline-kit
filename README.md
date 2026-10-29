# ttrpg-inline-kit

Widget modules and portrait art for a text tabletop RPG whose Game Master draws HTML widgets in a chat. The chat's
widget sandbox loads code and images only from public CDNs, so this repo exists to be served by jsDelivr, always at a
pinned commit:

```
https://cdn.jsdelivr.net/gh/mandrulevicius/ttrpg-inline-kit@<commit>/kit/probe.js
```

- `kit/`: the widget modules.
- `player/`: the portrait player (frame sets and live faces; `player/README.md` describes the format).
- `assets/ttrpg/npc.<id>/<pipeline>/`: portrait sets, each a `meta.json` and its PNGs.

A publish tool generates this tree from private repos, and each commit replaces it whole, so edits made here are
overwritten. Issues and pull requests aren't watched.
