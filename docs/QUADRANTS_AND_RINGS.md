# Quadrants and Rings

This document defines the categories (quadrants) and maturity levels (rings) used in the Punk Link Tech Radar.

## Quadrants

We start with four standard quadrants. Keep the surface area focused; propose changes via PR with clear motivation.

1. Languages — Programming languages and runtimes (e.g., TypeScript, Go, JVM)
2. Frameworks — Application and UI frameworks and major libraries (e.g., React, Spring)
3. Tools — Datastores, build tools, monitoring, developer tooling (e.g., PostgreSQL, Vite, Prometheus)
4. Platforms — Hosting, cloud platforms, CI/CD, orchestration (e.g., GitHub Actions, Vercel, Kubernetes)

Guidance:
- Place a blip where it’s primarily evaluated and owned. Cross-cutting items should have tags to express secondary facets.
- Avoid duplicating the same blip across quadrants; use tags and description to clarify contexts.

## Rings

Rings express our current recommendation level. Movements across rings should be justified with evidence and owner approval.

- Adopt — Proven default. Documented patterns, paved-path tooling, and production references. New uses encouraged.
- Trial — Bounded pilots with clear exit criteria and metrics. Owner support exists, but not yet the default.
- Assess — Research and limited spikes. No broad production use; gather info, risks, and viable alternatives.
- Hold — Discourage new use. Existing use may continue with a migration plan and exceptions documented.

### Entry/exit criteria (examples)

- To enter Adopt: at least 2 production references with positive outcomes; docs and templates available; clear ownership.
- Trial → Adopt: successful pilot meeting exit criteria; risks mitigated; tooling hardened.
- Assess → Trial: a sponsor team, pilot scope, and metrics are defined; known alternatives documented.
- To enter Hold: unacceptable risk/cost, better alternative adopted, or poor fit for our context.

## Tagging

Use tags to add searchable context such as domain (frontend, backend, data), capabilities (observability, auth), or constraints (regulated, PII).

Allowed tags should be curated in a central list to avoid drift; new tags must be justified in PRs.

## Notes

- Current dataset in `radar/data.json` uses quadrants: Languages, Frameworks, Tools, Platforms and rings: Adopt, Trial, Assess, Hold.
- If quadrants/rings change, update the dataset and docs together and provide a migration note in the changelog.
