# tech-radar

A simple Tech Radar site for Punk Link. The repository contains data and a lightweight client-side renderer to visualize technology choices.

This repository was initialized to host the radar data and site.

## What this is

This repo is the source of truth for Punk Link’s Tech Radar. It holds:
- The radar dataset (`radar/data.json`)
- A static, client-side visualization (`radar/index.html`)
- Documentation for how to use, govern, and evolve the radar (see `docs/`).

## Start here

- Objectives and scope: `docs/OBJECTIVES.md`
- Quadrants and rings: `docs/QUADRANTS_AND_RINGS.md`

## Local preview

Browsers block `fetch()` for `file://` URLs, so serve the folder over HTTP. Using Yarn:

```powershell
# install dependencies once
yarn

# start local dev server on http://localhost:5173
yarn dev
```

Alternatively, any static server works (e.g., VS Code Live Server). Changes to `radar/data.json` will reflect on reload.

## Contributing

Please read the docs above before proposing changes. We’ll add contribution guidelines, governance, and validation in subsequent steps.
