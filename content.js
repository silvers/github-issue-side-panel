// GitHub Issue Side Panel
// Intercepts clicks on issue links on issue-list pages, fetches the issue
// page HTML (same-origin, with the user's session), extracts the embedded
// JSON payload GitHub ships for its React app, and renders the issue in a
// slide-in panel — like the GitHub Projects side panel.

(() => {
  'use strict';

  if (window.top !== window) return;

  const state = { enabled: true, width: 720 };

  chrome.storage.sync.get({ enabled: true, panelWidth: 720 }, (v) => {
    state.enabled = v.enabled;
    state.width = v.panelWidth;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if ('enabled' in changes) {
      state.enabled = changes.enabled.newValue;
      if (!state.enabled) closePanel();
    }
    if ('panelWidth' in changes) state.width = changes.panelWidth.newValue;
  });

  // Only issues open in the panel (PR pages don't preload their
  // conversation data, so PRs always navigate normally).
  const ITEM_PATH_RE = /^\/[^/]+\/[^/]+\/issues\/\d+$/;

  // "owner/repo#number" — identifies an issue/PR regardless of tab suffix.
  function itemKey(pathname) {
    const m = pathname.match(/^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
    return m ? `${m[1]}/${m[2]}#${m[3]}` : null;
  }

  // Where interception applies. Checked at click time because GitHub is an
  // SPA: issue lists, the dashboards, issue/PR pages (linked issues,
  // sub-issues, ...), and links inside the panel itself.
  function interceptionContext(a) {
    if (root && root.contains(a)) return 'panel';
    const p = location.pathname.replace(/\/$/, '');
    if (p === '/issues' || /^\/[^/]+\/[^/]+\/issues$/.test(p)) return 'list';
    if (/^\/[^/]+\/[^/]+\/(issues|pull)\/\d+(\/|$)/.test(p)) return 'page';
    return null;
  }

  // ---- Panel DOM (created lazily) ----
  let root = null;
  let body = null;
  let fullLink = null;
  let backBtn = null;

  // In-panel navigation history (issue links clicked inside the panel).
  let hist = [];
  let currentHref = null;

  function ensurePanel() {
    if (root) return;

    root = document.createElement('div');
    root.id = 'gisp-root';
    root.innerHTML = `
      <div class="gisp-backdrop"></div>
      <div class="gisp-panel" role="dialog" aria-label="Issue side panel">
        <div class="gisp-resizer" title="Drag to resize"></div>
        <div class="gisp-header">
          <div class="gisp-header-left">
            <button class="gisp-back" type="button" aria-label="Back" hidden>&#8592;</button>
            <a class="gisp-full" href="#">Open full page &#8599;</a>
          </div>
          <button class="gisp-close" type="button" aria-label="Close">&#10005;</button>
        </div>
        <div class="gisp-body"></div>
      </div>`;
    document.body.appendChild(root);

    body = root.querySelector('.gisp-body');
    fullLink = root.querySelector('.gisp-full');
    backBtn = root.querySelector('.gisp-back');
    const panel = root.querySelector('.gisp-panel');
    panel.style.width = state.width + 'px';

    root.querySelector('.gisp-backdrop').addEventListener('click', closePanel);
    root.querySelector('.gisp-close').addEventListener('click', closePanel);
    backBtn.addEventListener('click', () => {
      const prev = hist.pop();
      if (prev) openPanel(prev);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('gisp-open')) closePanel();
    });

    // ---- Resize by dragging the left edge ----
    const resizer = root.querySelector('.gisp-resizer');
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const onMove = (ev) => {
        const w = Math.min(
          Math.max(window.innerWidth - ev.clientX, 400),
          window.innerWidth - 80
        );
        panel.style.width = w + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const w = parseInt(panel.style.width, 10);
        if (w) chrome.storage.sync.set({ panelWidth: w });
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function closePanel() {
    if (root) root.classList.remove('gisp-open');
  }

  // ---- Data extraction ----

  // The issue page embeds its GraphQL payload as JSON for React hydration.
  // Find the <script data-target="react-app.embeddedData"> that contains
  // repository.issue.
  function extractItem(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = doc.querySelectorAll(
      'script[type="application/json"][data-target="react-app.embeddedData"]'
    );
    for (const s of scripts) {
      let payload;
      try {
        payload = JSON.parse(s.textContent)?.payload;
      } catch (_) {
        continue;
      }
      for (const q of payload?.preloadedQueries || []) {
        const issue = q?.result?.data?.repository?.issue;
        if (issue && issue.bodyHTML !== undefined) return issue;
      }
    }
    return null;
  }

  // ---- Rendering ----

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function stateBadge(issue) {
    const st = issue.state;
    const reason = issue.stateReason;
    if (st === 'OPEN') return '<span class="gisp-state gisp-state-open">Open</span>';
    if (reason === 'NOT_PLANNED' || reason === 'DUPLICATE')
      return '<span class="gisp-state gisp-state-notplanned">Closed</span>';
    return '<span class="gisp-state gisp-state-closed">Closed</span>';
  }

  // Issue type colors are a GraphQL enum, not hex values.
  const TYPE_COLORS = {
    BLUE: '#0969da', GREEN: '#1a7f37', ORANGE: '#bc4c00', RED: '#cf222e',
    PURPLE: '#8250df', PINK: '#bf3989', YELLOW: '#9a6700', GRAY: '#59636e',
  };

  function typeChip(t) {
    if (!t?.name) return '';
    const color = TYPE_COLORS[t.color] || TYPE_COLORS.GRAY;
    return `<span class="gisp-label" style="--gisp-label-color:${color}" title="${esc(t.description || '')}">${esc(t.name)}</span>`;
  }

  function labelChip(l) {
    return `<span class="gisp-label" style="--gisp-label-color:#${esc(l.color)}">${l.nameHTML || esc(l.name)}</span>`;
  }

  function avatar(actor) {
    if (!actor?.avatarUrl) return '';
    return `<img class="gisp-avatar" src="${esc(actor.avatarUrl)}" alt="" width="20" height="20">`;
  }

  function collectComments(issue) {
    const seen = new Set();
    const comments = [];
    for (const tl of [issue.frontTimelineItems, issue.backTimelineItems]) {
      for (const edge of tl?.edges || []) {
        const n = edge?.node;
        if (!n || n.__typename !== 'IssueComment') continue;
        if (seen.has(n.id) || n.isHidden) continue;
        seen.add(n.id);
        comments.push(n);
      }
    }
    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return comments;
  }

  function renderIssue(issue, href) {
    const labels = (issue.labels?.edges || []).map((e) => e.node).filter(Boolean);
    const assignees = issue.assignedActors?.nodes || [];
    const projects = (issue.projectItems?.edges || [])
      .map((e) => e?.node?.project)
      .filter((p) => p?.title);
    const comments = collectComments(issue);
    const author = issue.author || {};

    const commentHtml = comments
      .map(
        (c) => `
        <div class="gisp-comment">
          <div class="gisp-comment-head">
            ${avatar(c.author)}
            <b>${esc(c.author?.login || 'ghost')}</b>
            <span class="gisp-muted">${fmtDate(c.createdAt)}</span>
          </div>
          <div class="markdown-body gisp-md">${c.bodyHTML || ''}</div>
        </div>`
      )
      .join('');

    // The preloaded payload only carries the head/tail of long timelines.
    const total = issue.frontTimelineItems?.totalCount ?? 0;
    const loaded =
      (issue.frontTimelineItems?.edges?.length ?? 0) +
      (issue.backTimelineItems?.edges?.length ?? 0);
    const truncated =
      total > loaded
        ? `<div class="gisp-truncated"><a href="${esc(href)}" data-gisp-nav="page">View full timeline on the issue page &#8599;</a></div>`
        : '';

    body.innerHTML = `
      <div class="gisp-issue">
        <h2 class="gisp-title">${issue.titleHTML || esc(issue.title)}
          <span class="gisp-muted">#${issue.number}</span></h2>
        <div class="gisp-meta">
          ${stateBadge(issue)}
          ${avatar(author)}
          <b>${esc(author.login || 'ghost')}</b>
          <span class="gisp-muted">opened on ${fmtDate(issue.createdAt)}
            &middot; ${comments.length} comment${comments.length === 1 ? '' : 's'}</span>
        </div>
        ${
          issue.issueType?.name || labels.length
            ? `<div class="gisp-labels">${typeChip(issue.issueType)}${labels.map(labelChip).join('')}</div>`
            : ''
        }
        ${
          assignees.length
            ? `<div class="gisp-assignees gisp-muted">Assignees:
                ${assignees.map((a) => `${avatar(a)} ${esc(a.login)}`).join(' ')}</div>`
            : ''
        }
        ${
          projects.length
            ? `<div class="gisp-assignees gisp-muted">Projects:
                ${projects.map((p) => (p.url ? `<a href="${esc(p.url)}">${esc(p.title)}</a>` : esc(p.title))).join(', ')}</div>`
            : ''
        }
        ${issue.milestone ? `<div class="gisp-assignees gisp-muted">Milestone: ${esc(issue.milestone.title)}</div>` : ''}
        <div class="markdown-body gisp-md gisp-issue-body">${issue.bodyHTML || '<i>No description provided.</i>'}</div>
        ${commentHtml}
        ${truncated}
      </div>`;
  }

  // ---- Open flow ----

  let openSeq = 0;

  // opts.reset: fresh browsing session (opened from the page, not the panel)
  // opts.pushCurrent: keep the current issue on the back stack
  async function openPanel(href, opts = {}) {
    ensurePanel();
    if (opts.reset) hist = [];
    else if (opts.pushCurrent && currentHref && currentHref !== href) hist.push(currentHref);
    currentHref = href;
    backBtn.hidden = hist.length === 0;

    const seq = ++openSeq;
    fullLink.href = href;
    body.innerHTML = '<div class="gisp-loading"><div class="gisp-spinner"></div></div>';
    root.classList.add('gisp-open');

    try {
      const res = await fetch(href, { headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const issue = extractItem(await res.text());
      if (seq !== openSeq) return; // another issue was opened meanwhile
      if (!issue) throw new Error('no embedded issue payload');
      renderIssue(issue, href);
      body.scrollTop = 0;
    } catch (err) {
      if (seq !== openSeq) return;
      // Graceful fallback: just navigate to the issue.
      console.warn('[gisp] falling back to normal navigation:', err);
      location.href = href;
    }
  }

  // ---- Click interception (capture phase, ahead of GitHub's SPA router) ----
  document.addEventListener(
    'click',
    (e) => {
      if (!state.enabled) return;
      if (e.defaultPrevented) return;
      // Modifier / non-left clicks keep their normal behavior (new tab etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      if (a.dataset.gispNav === 'page') return; // explicit "go to full page" links

      const ctx = interceptionContext(a);
      if (!ctx) return;

      let url;
      try {
        url = new URL(a.href, location.href);
      } catch (_) {
        return;
      }
      if (url.origin !== location.origin) return;
      if (!ITEM_PATH_RE.test(url.pathname)) return;
      // Self-links on the item's own page (comment anchors, PR tab links)
      // behave normally.
      if (ctx === 'page' && itemKey(url.pathname) === itemKey(location.pathname)) return;

      e.preventDefault();
      e.stopPropagation();
      openPanel(url.href, ctx === 'panel' ? { pushCurrent: true } : { reset: true });
    },
    true
  );
})();
