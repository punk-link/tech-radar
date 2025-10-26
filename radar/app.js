let currentMetaByHref = new Map();

function normalizeHref(href) {
    try {
        return new URL(String(href || ''), document.location.href).href;
    } catch {
        return String(href || '').trim();
    }
}


(async function () {
    function setRevisionDate(res, data) {
        try {
            const el = document.getElementById('revisionDate');
            if (!el) return;
            const headerDate = res.headers ? res.headers.get('Last-Modified') : null;
            const candidate = headerDate || data?.revision;
            let d = candidate ? new Date(candidate) : null;
            if (!d || isNaN(d.getTime())) {
                d = new Date();
            }

            const formatted = d.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
            
            el.textContent = `Last updated: ${formatted}`;
            el.title = candidate ? String(candidate) : d.toISOString();
        } catch {}
    }

    function computeDimensions() {
        const container = document.querySelector('.radar-container');
        const rect = container ? container.getBoundingClientRect() : { width: 1200, top: 0 };
        const availableWidth = Math.max(600, Math.floor(rect.width));

        const verticalPadding = 12;
        const availableHeight = Math.max(500, Math.floor(window.innerHeight - rect.top - verticalPadding));

        const BASE_WIDTH = 1450, BASE_HEIGHT = 1000, ASPECT = BASE_HEIGHT / BASE_WIDTH;

        const heightByAspect = Math.floor(availableWidth * ASPECT);
        const targetHeight = Math.min(availableHeight, heightByAspect);
        const targetWidth = availableWidth;

        return {
            width: targetWidth,
            height: targetHeight,
            BASE_WIDTH, BASE_HEIGHT
        };
    }

    function renderRadar({ quadrants, rings, entries }) {
        const svg = document.getElementById("radar");
        if (svg) 
            svg.innerHTML = "";

        const { width, height, BASE_WIDTH, BASE_HEIGHT } = computeDimensions();
        if (svg) {
            svg.style.height = `${height}px`;
            svg.style.width = `100%`;
            svg.setAttribute('width', String(width));
            svg.setAttribute('height', String(height));
            svg.setAttribute('viewBox', `0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }

        radar_visualization({
            repo_url: "https://github.com/punk-link/tech-radar",
            svg_id: "radar",
            
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            scale: 1.0,
            colors: {
                background: "#0f172a", // slate-900
                grid: "#334155",       // slate-700
                inactive: "#475569"    // slate-600
            },
            font_family: "Arial, Helvetica",
            title: "Punk.link — Tech Radar",
            quadrants,
            rings,
            print_layout: true,
            links_in_new_tabs: true,
            entries
        });

        if (!entries || entries.length === 0) {
            if (svg && svg.namespaceURI) {
                const msg = document.createElementNS(svg.namespaceURI, "text");
                msg.setAttribute("x", "20");
                msg.setAttribute("y", "40");
                msg.setAttribute("fill", "#c00");
                msg.textContent = "No entries match current filters";
                svg.appendChild(msg);
            }
        }
        
        attachTooltips();
        styleRetiredBlips();
    }

    try {
        const res = await fetch("data.json");
        if (!res.ok) 
            throw new Error(`Failed to load data.json: ${res.status} ${res.statusText}`);
        
        const data = await res.json();
        setRevisionDate(res, data);

        const ringNames = Array.isArray(data.rings) ? data.rings : [];
        const quadrantNames = Array.isArray(data.quadrants) ? data.quadrants : [];

        const ringIndexByName = new Map(
            ringNames.map((n, i) => [String(n).toLowerCase(), i])
        );
        const quadIndexByName = new Map(
            quadrantNames.map((n, i) => [String(n).toLowerCase(), i])
        );

        const ringPalette = ["#5ba300", "#009eb0", "#c7ba00", "#e09b96", "#9e9e9e", "#34495e"]; // last two: retired gray, extra slate
        const ringColorByName = new Map([
            ["adopt", "#5ba300"],
            ["trial", "#009eb0"],
            ["assess", "#c7ba00"],
            ["hold", "#e09b96"],
            ["retired", "#9e9e9e"],
        ]);

        const rings = ringNames.map((name, i) => {
            const key = String(name).toLowerCase();
            const color = ringColorByName.get(key) || ringPalette[i % ringPalette.length];

            return { name, color };
        });
        const quadrants = quadrantNames.map((name) => ({ name }));

        const sourceEntries = (Array.isArray(data.entries) ? data.entries : []);
        const entries = sourceEntries.map((e, idx) => {
            const qIdx = quadIndexByName.get(String(e.quadrant ?? "").toLowerCase());
            const rIdx = ringIndexByName.get(String(e.ring ?? "").toLowerCase());

            return {
                id: e.id ?? `entry-${idx}`,
                label: e.label ?? e.id ?? `Entry ${idx + 1}`,
                quadrant: typeof qIdx === "number" ? qIdx : 0,
                ring: typeof rIdx === "number" ? rIdx : 0,
                moved: typeof e.moved === "number" ? e.moved : 0,
                link: e.url,
                active: e.active !== false,

                // keep original fields to support filtering without re-mapping
                _category: e.category,
                _tags: Array.isArray(e.tags) ? e.tags : [],
                _desc: e.description || "",
                _url: e.url || '',
                _ringName: e.ring ? String(e.ring) : undefined
            };
        });

        const allCategories = new Set(
            (Array.isArray(data.categories) ? data.categories : [])
                .concat(sourceEntries.map(e => e.category).filter(Boolean))
        );
        const allTags = new Set(
            sourceEntries.flatMap(e => Array.isArray(e.tags) ? e.tags : [])
        );

        const categoryList = document.getElementById("categoryList");
        const tagList = document.getElementById("tagList");
        const matchCount = document.getElementById("matchCount");
        const searchInput = document.getElementById("searchInput");
        const clearSearchBtn = document.getElementById("clearSearch");

        function createCheckbox(name, value, checked = true) {
            const id = `${name}-${value}`.replace(/[^a-z0-9_-]/gi, "_");
            const wrapper = document.createElement("label");
            wrapper.className = "flex items-center gap-2 text-sm py-0.5";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = name;
            input.value = value;
            input.id = id;
            input.checked = checked;
            const span = document.createElement("span");
            span.textContent = value;
            wrapper.appendChild(input);
            wrapper.appendChild(span);

            return wrapper;
        }

        function populateList(container, name, values) {
            container.innerHTML = "";
            Array.from(values).sort((a, b) => String(a).localeCompare(String(b))).forEach(v => {
                container.appendChild(createCheckbox(name, v, true));
            });
        }

        populateList(categoryList, "category", allCategories);
        populateList(tagList, "tag", allTags);

        function selected(name) {
            return new Set(
                Array.from(document.querySelectorAll(`input[name="${name}"]`))
                    .filter(i => i.checked)
                    .map(i => i.value)
            );
        }

        function renderCustomLegend(list) {
            try {
                const customLegend = document.getElementById('customLegend');
                if (!customLegend) 
                    return;

                const retired = list.filter(e => String(e._ringName || '').toLowerCase() === 'retired');
                if (retired.length === 0) {
                    customLegend.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-1">
                                <span class="inline-block w-3 h-3 rounded-full" style="background:#9e9e9e"></span>
                                <span>Retired (shown on Hold ring)</span>
                            </div>
                        </div>`;

                    return;
                }

                const idSafe = (s) => String(s).replace(/[^a-z0-9_-]/gi, "_");
                const itemsHTML = retired.map(e => {
                    const label = e.label || e.id;
                    const href = e._url || '';
                    const safeLabel = String(label).replace(/[<>]/g, '');
                    const link = href ? `<a class="underline hover:text-slate-100" href="${href}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>` : `<span>${safeLabel}</span>`;
                    const liId = `legend-item-${idSafe(e.id || safeLabel)}`;
                    
                    return `<li id="${liId}" class="ml-5 list-disc legend-retired-item">${link}</li>`;
                }).join('');

                customLegend.innerHTML = `
                    <div class="flex items-center gap-3 mb-1">
                        <div class="flex items-center gap-1">
                            <span class="inline-block w-3 h-3 rounded-full" style="background:#9e9e9e"></span>
                            <span>Retired (shown on Hold ring) — ${retired.length}</span>
                        </div>
                    </div>
                    <ul class="text-slate-300">${itemsHTML}</ul>
                `;
                
                const tip = ensureTooltip();
                retired.forEach(e => {
                    const label = e.label || e.id || '';
                    const safeLabel = String(label).replace(/[<>]/g, '');
                    const liId = `legend-item-${idSafe(e.id || safeLabel)}`;
                    const el = document.getElementById(liId);
                    if (!el) 
                        return;

                    const meta = {
                        category: e._category,
                        tags: e._tags,
                        ring: e._ringName || 'Retired',
                        quadrant: (typeof e.quadrant === 'number' ? (quadrants[e.quadrant]?.name) : e.quadrant) || undefined,
                        desc: e._desc,
                        label: e.label
                    };

                    const onEnter = (ev) => { tip.innerHTML = buildTooltipHTML(safeLabel, meta); tip.style.display = 'block'; onMove(ev); };
                    const onLeave = () => { tip.style.display = 'none'; };
                    const onMove = (ev) => {
                        const pad = 12;
                        const vw = window.innerWidth, vh = window.innerHeight;
                        const tw = tip.offsetWidth || 240;
                        const th = tip.offsetHeight || 120;
                        const left = Math.min(ev.clientX + pad, vw - tw - 4);
                        const top = Math.min(ev.clientY + pad, vh - th - 4);
                        tip.style.left = `${left}px`;
                        tip.style.top = `${top}px`;
                    };
                    el.addEventListener('mouseenter', onEnter);
                    el.addEventListener('mouseleave', onLeave);
                    el.addEventListener('mousemove', onMove);
                });
            } catch {}
        }

        function applyFilters() {
            const selectedCategories = selected("category");
            const selectedTags = selected("tag");
            const q = (searchInput.value || "").toLowerCase().trim();

            const filtered = entries.filter(e => {
                const catOk = selectedCategories.size === 0 || selectedCategories.has(e._category);
                const tags = e._tags || [];
                const tagOk = selectedTags.size === 0 || tags.some(t => selectedTags.has(t));
                const searchOk = q.length === 0 ||
                    (e.label && e.label.toLowerCase().includes(q)) ||
                    (e.id && e.id.toLowerCase().includes(q)) ||
                    (e._category && String(e._category).toLowerCase().includes(q)) ||
                    (e._desc && e._desc.toLowerCase().includes(q)) ||
                    tags.some(t => String(t).toLowerCase().includes(q));

                return catOk && tagOk && searchOk;
            });

            matchCount.textContent = `${filtered.length} match${filtered.length === 1 ? "" : "es"}`;

            currentMetaByHref = new Map(
                filtered.map(e => [
                    normalizeHref(e._url),
                    {
                        category: e._category,
                        tags: e._tags,
                        ring: e._ringName || (rings[e.ring]?.name),
                        quadrant: quadrants[e.quadrant]?.name,
                        desc: e._desc,
                        label: e.label
                    }
                ])
            );

            // Workaround: renderer supports 4 rings; map Retired into Hold visually
            const supportedRings = ["Adopt", "Trial", "Assess", "Hold"]; // order matters
            const vizRings = supportedRings.map(n => ({ name: n, color: ringColorByName.get(n.toLowerCase()) || "#999" }));
            const vizRingIndex = new Map(vizRings.map((r, i) => [r.name.toLowerCase(), i]));

            const mapped = filtered.map(({ _category, _tags, _desc, _ringName, ...rest }) => {
                const key = String(_ringName || rings[rest.ring]?.name || '').toLowerCase();
                const effectiveKey = key === 'retired' ? 'hold' : key;
                const ringIdx = vizRingIndex.has(effectiveKey) ? vizRingIndex.get(effectiveKey) : vizRingIndex.get('hold');
                return { ...rest, ring: typeof ringIdx === 'number' ? ringIdx : 3 };
            });

            renderRadar({ quadrants, rings: vizRings, entries: mapped });
            renderCustomLegend(filtered);
        }

        
        function setAll(name, value) {
            document.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = value; });
            applyFilters();
        }

        document.getElementById("catAll").addEventListener("click", () => setAll("category", true));
        document.getElementById("catNone").addEventListener("click", () => setAll("category", false));
        document.getElementById("tagAll").addEventListener("click", () => setAll("tag", true));
        document.getElementById("tagNone").addEventListener("click", () => setAll("tag", false));
        document.getElementById("resetFilters").addEventListener("click", () => {
            setAll("category", true);
            setAll("tag", true);
            searchInput.value = "";
        });

        document.getElementById("filters").addEventListener("change", (e) => {
            const target = e.target;
            if (target && target.matches && target.matches('input[type="checkbox"]'))
                applyFilters();
        });

        function debounce(fn, wait) {
            let t;
            return function (...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), wait);
            };
        }

        const onSearch = debounce(() => applyFilters(), 200);
        searchInput.addEventListener("input", onSearch);
        clearSearchBtn.addEventListener("click", () => { searchInput.value = ""; applyFilters(); });
    
        const onResize = debounce(() => applyFilters(), 150);
        window.addEventListener('resize', onResize);
        
        currentMetaByHref = new Map(
            entries.map(e => [
                normalizeHref(e._url),
                { category: e._category, tags: e._tags, ring: e._ringName || (rings[e.ring]?.name), quadrant: quadrants[e.quadrant]?.name, desc: e._desc, label: e.label }
            ])
        );

        // Initial render with workaround mapping
        const supportedRings = ["Adopt", "Trial", "Assess", "Hold"]; // order matters
        const vizRings = supportedRings.map(n => ({ name: n, color: ringColorByName.get(n.toLowerCase()) || "#999" }));
        const vizRingIndex = new Map(vizRings.map((r, i) => [r.name.toLowerCase(), i]));
        const initialMapped = entries.map(({ _category, _tags, _desc, _ringName, ...rest }) => {
            const key = String(_ringName || rings[rest.ring]?.name || '').toLowerCase();
            const effectiveKey = key === 'retired' ? 'hold' : key;
            const ringIdx = vizRingIndex.has(effectiveKey) ? vizRingIndex.get(effectiveKey) : vizRingIndex.get('hold');

            return { ...rest, ring: typeof ringIdx === 'number' ? ringIdx : 3 };
        });
        renderRadar({ quadrants, rings: vizRings, entries: initialMapped });
        matchCount.textContent = `${entries.length} matches`;
        renderCustomLegend(entries);
    } catch (err) {
        console.error(err);
        
        const svg = document.getElementById("radar");
        if (svg && svg.namespaceURI) {
            const msg = document.createElementNS(svg.namespaceURI, "text");
            msg.setAttribute("x", "20");
            msg.setAttribute("y", "40");
            msg.setAttribute("fill", "#c00");
            msg.textContent = "Failed to load radar data.json";
            svg.appendChild(msg);
        }
    }
})();


function buildTooltipHTML(label, meta) {
    const safe = (v) => v ?? '—';
    const tags = (meta?.tags && meta.tags.length) ? meta.tags.join(', ') : '—';
    const desc = meta?.desc ? `<div class="mt-2 text-slate-300">${meta.desc}</div>` : '';
    return `
    <div class="font-semibold text-slate-100">${label}</div>
    <div class="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
      <div class="text-slate-400">Quadrant:</div><div>${safe(meta?.quadrant)}</div>
      <div class="text-slate-400">Ring:</div><div>${safe(meta?.ring)}</div>
      <div class="text-slate-400">Category:</div><div>${safe(meta?.category)}</div>
      <div class="text-slate-400">Tags:</div><div>${tags}</div>
    </div>
    ${desc}
  `;
}

function ensureTooltip() {
    let tip = document.getElementById('radar-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'radar-tooltip';
        tip.className = 'fixed z-50 pointer-events-none bg-slate-800/95 text-slate-100 border border-slate-700 rounded-md px-3 py-2 shadow-lg text-sm max-w-xs';
        tip.style.display = 'none';
        document.body.appendChild(tip);
    }

    return tip;
}


function attachTooltips() {
    const svg = document.getElementById('radar');
    if (!svg) 
        return;

    const tip = ensureTooltip();

    const bind = (el, label, meta) => {
        // Remove any native <title> to avoid double-tooltips
        const titles = el.querySelectorAll('title');
        titles.forEach(t => t.remove());
        const onEnter = (e) => {
            tip.innerHTML = buildTooltipHTML(label, meta);
            tip.style.display = 'block';
            onMove(e);
        };

        const onLeave = () => { tip.style.display = 'none'; };
        const onMove = (e) => {
            const pad = 12;
            const vw = window.innerWidth, vh = window.innerHeight;
            const tw = tip.offsetWidth || 240;
            const th = tip.offsetHeight || 120;
            const left = Math.min(e.clientX + pad, vw - tw - 4);
            const top = Math.min(e.clientY + pad, vh - th - 4);
            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
        };
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
        el.addEventListener('mousemove', onMove);
    };

    svg.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || a.getAttribute('xlink:href') || a.href || '';
        const meta = currentMetaByHref.get(normalizeHref(href));
        if (!meta) 
            return;

        const label = meta.label || '';
        bind(a, label, meta);
    });
}

function styleRetiredBlips() {
    try {
        const svg = document.getElementById('radar');
        if (!svg) 
            return;

        const RETIRED_COLOR = '#9e9e9e';
        svg.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || a.getAttribute('xlink:href') || a.href || '';
            const meta = currentMetaByHref.get(normalizeHref(href));
            if (!meta) 
                return;

            if ((meta.ring || '').toLowerCase() !== 'retired') 
                return;
            
            a.querySelectorAll('circle, path, rect').forEach(el => {
                el.setAttribute('fill', RETIRED_COLOR);
                el.setAttribute('stroke', RETIRED_COLOR);
                el.setAttribute('opacity', '0.95');
            });

            a.querySelectorAll('text').forEach(t => {
                t.setAttribute('fill', RETIRED_COLOR);
                t.setAttribute('opacity', '0.9');
            });
        });
    } catch {}
}
