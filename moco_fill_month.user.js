// ==UserScript==
// @name         MoCo Fill Month Button
// @namespace    moco-fill-month
// @version      1.1.6
// @description  Adds a "Fill month" button to the MoCo web app that creates a whole month of time entries in one request, via the official API (POST /api/v1/activities/bulk).
// @author       you
// @match        https://*.mocoapp.com/*
// @exclude      https://www.mocoapp.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *.mocoapp.com
// @connect      self
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    // guard against double-injection (SPA re-entry / re-enabling the script)
    if (window.__mfmBooted) return;
    window.__mfmBooted = 1;

    const VERSION = "1.0.0";
    const KEY_STORE = "moco_fill_api_key";
    const API = function (path) {
        return "https://" + location.hostname + "/api/v1" + path;
    };

    /* ---------- storage (GM storage when available, localStorage fallback) ---------- */

    function loadKey() {
        try { return GM_getValue(KEY_STORE, "") || localStorage.getItem(KEY_STORE) || ""; }
        catch (e) { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e2) { return ""; } }
    }
    function saveKey(k) {
        try { GM_setValue(KEY_STORE, k); } catch (e) { /* ignore */ }
        try { localStorage.setItem(KEY_STORE, k); } catch (e) { /* ignore */ }
    }

    /* ---------- API calls (GM_xmlhttpRequest bypasses CORS) ---------- */

    function api(method, path, payload) {
        return new Promise(function (resolve, reject) {
            if (!loadKey()) return reject(Object.assign(new Error("no API key"), { status: 401 }));
            GM_xmlhttpRequest({
                method: method,
                url: API(path),
                headers: Object.assign(
                    { "Authorization": "Token token=" + loadKey() },
                    payload ? { "Content-Type": "application/json" } : {}
                ),
                data: payload ? JSON.stringify(payload) : undefined,
                timeout: 30000,
                onload: function (r) {
                    if (r.status >= 200 && r.status < 300) {
                        try { resolve(r.responseText ? JSON.parse(r.responseText) : null); }
                        catch (e) { resolve(null); }
                    } else {
                        reject(Object.assign(new Error(r.responseText || ("HTTP " + r.status)), { status: r.status }));
                    }
                },
                onerror: function () { reject(new Error("Network error")); },
                ontimeout: function () { reject(new Error("Request timed out")); }
            });
        });
    }
    function getList(path) {
        // page through until an empty page
        var out = [], page = 1;
        return (function next() {
            return api("GET", path + (path.indexOf("?") >= 0 ? "&" : "?") + "per_page=100&page=" + page)
                .then(function (batch) {
                    if (!batch || !batch.length) return out;
                    out = out.concat(batch.filter(function (it) { return !out.some(function (o) { return o.id === it.id; }); }));
                    if (page >= 10) return out;
                    page += 1;
                    return next();
                });
        })();
    }

    /* ---------- date helpers ---------- */

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function dateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function parseDate(s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
        if (!m) return null;
        var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function thisMonth() { return dateStr(new Date()).slice(0, 7); }

    function planDays(monthStr, sched, skips) {
        var parts = /^(\d{4})-(\d{2})$/.exec(monthStr || "");
        if (!parts) return null;
        var y = Number(parts[1]), m = Number(parts[2]);
        if (m < 1 || m > 12) return null;
        var days = [];
        var dim = new Date(y, m, 0).getDate(); // last day of month
        for (var d = 1; d <= dim; d++) {
            var date = new Date(y, m - 1, d);
            var wd = date.getDay();            // 0=Sun ... 6=Sat
            var idx = (wd + 6) % 7;            // 0=Mon ... 6=Sun
            var h = parseFloat(sched[idx]) || 0;
            var ds = dateStr(date);
            if (h > 0 && !skips[ds]) days.push({ date: ds, h: h });
        }
        return days;
    }

    /* ---------- DOM / UI ---------- */

    var CSS = [
        "#mfm-fab{position:fixed;bottom:18px;right:18px;z-index:2147483000;background:#2563eb;color:#fff;",
        "border:none;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,sans-serif;",
        "box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}",
        "#mfm-fab:hover{background:#1d4ed8}",
        "#mfm-modal{display:none;position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.55);",
        "justify-content:center;align-items:center;padding:16px;font:14px/1.5 system-ui,sans-serif}",
        "#mfm-card{background:#fff;color:#0f172a;border-radius:12px;width:100%;max-width:440px;max-height:92vh;",
        "overflow:auto;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
        "#mfm-card h2{margin:0 0 12px;font-size:16px}",
        "#mfm-card label{display:block;margin:10px 0 3px;font-weight:600;font-size:12px;color:#475569}",
        "#mfm-card label[for=mfm-replace]{display:flex;align-items:flex-start;gap:8px;font-weight:500;font-size:12.5px;color:#334155;line-height:1.4;margin:12px 0 2px;cursor:pointer}",
        "#mfm-card label[for=mfm-replace] span{color:#334155;font-size:12.5px;font-weight:500;margin-top:1px}",
        "#mfm-replace{-webkit-appearance:none;appearance:none;width:16px;height:16px;min-width:16px;border:1.5px solid #94a3b8;border-radius:4px;background:#fff;cursor:pointer;margin:1px 2px 0 0}",
        "#mfm-replace:hover{border-color:#2563eb}",
        "#mfm-replace:checked{background-color:#2563eb;border-color:#2563eb;background-image:url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23fff\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>');background-repeat:no-repeat;background-position:center;background-size:12px}",
        "#mfm-card input[type=text],#mfm-card input[type=number],#mfm-card select,#mfm-card textarea{",
        "width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:6px;",
        "font:inherit;background:#fff;color:#0f172a}",
        "#mfm-week{display:flex;gap:6px}#mfm-week input{text-align:center}",
        "#mfm-preview{display:none;margin-top:10px;border:1px solid #e2e8f0;border-radius:6px;",
        "max-height:160px;overflow:auto;padding:8px 10px;background:#f8fafc;font-size:12px}",
        "#mfm-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}",
        "#mfm-actions button{border:none;border-radius:6px;padding:9px 14px;font:600 13px system-ui,sans-serif;",
        "cursor:pointer}#mfm-do{background:#2563eb;color:#fff}#mfm-do:disabled{background:#94a3b8;cursor:wait}",
        "#mfm-cancel{background:#e2e8f0;color:#334155}",
        "#mfm-msg{margin-top:10px;font-size:12px;white-space:pre-line}",
        "#mfm-msg.err{color:#b91c1c}#mfm-msg.ok{color:#16a34a}",
        "@media(max-width:480px){#mfm-fab{bottom:12px;right:12px;left:12px;width:auto;text-align:center}}"
    ].join("\n");

    function $(sel) { return document.querySelector(sel); } // (redefined below, scoped to modal)

    /* ---- DOM / UI wiring ---- */

    function buildUI() {
        var style = document.createElement("style");
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);

        var fab = document.createElement("button");
        fab.id = "mfm-fab";
        fab.type = "button";
        fab.textContent = "Fill month";
        fab.addEventListener("click", openDialog);
        document.body.appendChild(fab);

        var modal = document.createElement("div");
        modal.id = "mfm-modal";
        modal.innerHTML = [
            '<div id="mfm-card">',
            "<h2>Fill month &middot; MoCo</h2>",
            '<label for="mfm-month">Month</label>',
            '<input type="text" id="mfm-month" value="' + thisMonth() + '" placeholder="YYYY-MM">',
            '<label for="mfm-project">Project</label>',
            '<select id="mfm-project"><option value="">Loading projects…</option></select>',
            '<label for="mfm-task">Task</label>',
            '<select id="mfm-task"><option value="">(choose a project first)</option></select>',
            '<label>Hours per weekday (Mon–Sun)</label>',
            '<div id="mfm-week">' +
            ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(function (d, i) {
                return '<input type="number" min="0" step="0.25" aria-label="' + d + '" value="' + (i < 5 ? 8 : 0) + '">';
            }).join("") +
            "</div>",
            '<label for="mfm-desc">Description (same for all entries)</label>',
            '<input type="text" id="mfm-desc" placeholder="Describe your work">',
            '<label for="mfm-skips">Skip dates (optional, comma-separated, YYYY-MM-DD)</label>',
            '<input type="text" id="mfm-skips" placeholder="Type dates to exclude in format YYYY-MM-DD">',
            '<label for="mfm-replace">',
            '<input type="checkbox" id="mfm-replace">',
            "<span>Replace existing entries: deletes this month's entries for this project and task first, then adds the new ones.</span>",
            "</label>",
            '<div id="mfm-preview"></div>',
            '<div id="mfm-actions">',
            '<button id="mfm-do" type="button">Preview</button>',
            '<button id="mfm-cancel" type="button">Close</button>',
            "</div>",
            '<div id="mfm-msg"></div>',
            '<div id="mfm-keybar" style="margin-top:12px;font-size:11px;color:#94a3b8">Key: <span id="mfm-keystate"></span> ',
            '<a href="#" id="mfm-keylink" style="color:#2563eb">change</a></div>',
            "</div>"
        ].join("");
        document.body.appendChild(modal);
        document.addEventListener("click", function (e) {
            if (e.target === modal) { hide(); return; }
            if (e.target && e.target.id === "mfm-fab") { /* handled on fab itself */ }
            if (e.target && e.target.id === "mfm-keylink") { e.preventDefault(); askKey(); }
        }, false);
        return modal;
    }

    var modalEl = null;
    // scope lookups to the modal so duplicate injections can never cause a mismatch
    function $(sel) { return (modalEl || document).querySelector(sel); }
    function show() { modalEl.style.display = "flex"; }
    function hide() { if (modalEl) modalEl.style.display = "none"; }

    function setMsg(text, cls) {
        var el = $("#mfm-msg");
        if (!el) { if (text) console.warn("[mfm]", text); return; }
        el.className = cls || "";
        el.textContent = text || "";
        if (text && cls === "err") {
            console.error("[mfm]", text);
            el.scrollIntoView({ block: "nearest" });
        }
    }
    function fmtHours(hours) { return String(Math.round(hours * 100) / 100); }

    function refreshKeyState() {
        var el = $("#mfm-keystate");
        if (el) el.textContent = loadKey() ? "saved" : "not set — click change";
    }

    function askKey() {
        var current = loadKey();
        var k = window.prompt("Your MoCo personal API key\n(profile picture → Integrations). Stored only in your browser.", current);
        if (k !== null) {
            saveKey(k.trim());
            refreshKeyState();
            setMsg(k.trim() ? "API key saved." : "API key cleared.", k.trim() ? "ok" : "err");
        }
    }

    function populateProjects(sel) {
        getList("/projects/assigned?active=true").then(function (projects) {
            if (!projects || !projects.length) {
                sel.innerHTML = '<option value="">No projects found (check key)</option>';
                return;
            }
            sel.innerHTML = "";
            projects.forEach(function (p) {
                var opt = document.createElement("option");
                opt.value = String(p.id);
                opt.textContent = p.id + " — " + (p.name || "") +
                    (p.customer && p.customer.name ? " (" + p.customer.name + ")" : "");
                opt._tasks = p.tasks || [];
                sel.appendChild(opt);
            });
            sel.onchange();
        }).catch(function (err) {
            sel.innerHTML = '<option value="">Could not load projects</option>';
            setMsg("Project lookup failed: " + (err.message || err), "err");
        });
    }

    function populateTasks() {
        var sel = $("#mfm-task");
        var proj = $("#mfm-project");
        var opt = proj.selectedOptions && proj.selectedOptions[0];
        var tasks = (opt && opt._tasks || []).filter(function (t) { return t.active; });
        if (!tasks.length) {
            sel.innerHTML = '<option value="">No tasks in project</option>';
            return;
        }
        sel.innerHTML = "";
        tasks.forEach(function (t) {
            var o = document.createElement("option");
            o.value = String(t.id);
            o.textContent = t.id + " — " + (t.name || "");
            sel.appendChild(o);
        });
    }

    function readSkips() {
        var set = {};
        var el = $("#mfm-skips");
        if (!el) return set;
        (el.value || "").split(/[\s,;]+/).forEach(function (s) {
            var d = parseDate(s);
            if (d) set[dateStr(d)] = true;
        });
        return set;
    }

    function readSched() {
        var inputs = (modalEl || document).querySelectorAll("#mfm-week input");
        var sched = [];
        for (var i = 0; i < 7; i++) sched.push(parseFloat(inputs[i].value) || 0);
        return sched;
    }

    function currentPlan() {
        var m = $("#mfm-month");
        if (!m) return null;
        return planDays(m.value, readSched(), readSkips());
    }

    function showPreview() {
        try {
            var plan = currentPlan();
            if (!plan) {
                setMsg("Preview: the month field must be a full YYYY-MM date, e.g. 2024-08.", "err");
                return;
            }
            if (!plan.length) {
                setMsg("Preview: no days in the month — every weekday hour is 0. Set at least one day > 0 (e.g. 8 for workdays).", "err");
                return;
            }
            var total = plan.reduce(function (s, x) { return s + x.h; }, 0);
            var rows = plan.map(function (x) { return x.date + " — " + fmtHours(x.h) + "h"; }).join("\n");
            var pre = $("#mfm-preview");
            if (!pre) { throw new Error("preview element missing"); }
            pre.style.display = "block";
            pre.textContent = plan.length + " entries, " + fmtHours(total) + " h total" +
                (plan.length ? "\n" + rows : "");
            pre.scrollIntoView({ block: "nearest" });
            setMsg("", "");
            return plan;
        } catch (err) {
            console.error("[mfm] preview error", err);
            setMsg("Preview error: " + (err && err.message || err), "err");
        }
    }

    function resetDo() {
        var doBtn = $("#mfm-do");
        if (!doBtn) return;
        doBtn.disabled = false;
        doBtn.textContent = "Preview";
        doBtn.onclick = function () {
            var plan = showPreview();
            if (!plan || !plan.length) return;
            doBtn.textContent = "Create " + plan.length + " entries? Click again to confirm";
            doBtn.onclick = function () { createEntries(plan); };
        };
    }

    function openDialog() {
        if (!modalEl) modalEl = buildUI();
        refreshKeyState();
        show();
        setMsg("");
        var proj = $("#mfm-project");
        proj.onchange = function () { populateTasks(); $("#mfm-preview").style.display = "none"; };
        populateProjects(proj);
        resetDo();
        $("#mfm-cancel").onclick = hide;
    }

    /* ---------- creation ---------- */

    function createEntries(plan) {
        var doBtn = $("#mfm-do");
        doBtn.disabled = true;
        doBtn.textContent = "Working…";
        var projectId = Number($("#mfm-project").value);
        var taskId = Number($("#mfm-task").value);
        var desc = $("#mfm-desc").value.trim();
        var replace = $("#mfm-replace").checked;

        var month = $("#mfm-month").value;
        var dates = {}; plan.forEach(function (d) { dates[d.date] = true; });
        var lastDay = plan[plan.length - 1].date;

        function run() {
            var payload = plan.map(function (d) {
                return {
                    date: d.date,
                    project_id: projectId,
                    task_id: taskId,
                    seconds: Math.round(d.h * 3600),
                    description: desc
                };
            });
            var created = 0;
            var chunks = [];
            for (var i = 0; i < payload.length; i += 50) chunks.push(payload.slice(i, i + 50));
            return chunks.reduce(function (p, chunk, idx) {
                return p.then(function () {
                    return api("POST", "/activities/bulk", { activities: chunk }).then(function () {
                        created += chunk.length;
                        setMsg("Created " + created + "/" + payload.length + " entries…", "ok");
                    });
                });
            }, Promise.resolve()).then(function () {
                setMsg("Done — " + created + " entries created. Reload the page to see them.", "ok");
                doBtn.textContent = "Reload page";
                doBtn.onclick = function () { location.reload(); };
                doBtn.disabled = false;
            });
        }

        function replaceFirst() {
            return api("GET", "/activities?from=" + month + "-01&to=" + lastDay +
                "&project_id=" + projectId + "&task_id=" + taskId).then(function (acts) {
                var victims = (acts || []).filter(function (a) { return dates[a.date]; });
                if (!victims.length) return 0;
                setMsg("Deleting " + victims.length + " existing entr(y/ies)…");
                return victims.reduce(function (p, a) {
                    return p.then(function () { return api("DELETE", "/activities/" + a.id); });
                }, Promise.resolve()).then(function () { return victims.length; });
            });
        }

        Promise.resolve()
            .then(function () { return replace ? replaceFirst() : 0; })
            .then(function () { return run(); })
            .catch(function (err) {
                setMsg("Failed: " + (err.message || err) +
                    (err.status === 401 ? "\nCheck your API key." : ""), "err");
                resetDo();
            });
    }

    /* ---------- boot: only when the app shell exists ---------- */

    function boot() {
        if (!document.body || document.body.dataset.mfmSetup) return;
        document.body.dataset.mfmSetup = "1";
        modalEl = buildUI(); // builds hidden modal + fab
        refreshKeyState();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();