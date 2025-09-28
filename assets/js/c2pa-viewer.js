// assets/js/c2pa-viewer.js
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('crBadge');
  const modal = document.getElementById('crModal');
  if (!badge || !modal) return;

  const bodyEl  = modal.querySelector('.cr-modal__body');
  const heroImg = document.getElementById('hero');

  // ---- C2PA SDK (ESM import + worker/wasm) -------------------------------
  const VERSION    = '0.24.2';
  const LIB_URL    = `https://cdn.jsdelivr.net/npm/c2pa@${VERSION}/+esm`;
  const WASM_SRC   = `https://cdn.jsdelivr.net/npm/c2pa@${VERSION}/dist/assets/wasm/toolkit_bg.wasm`;
  const WORKER_SRC = `https://cdn.jsdelivr.net/npm/c2pa@${VERSION}/dist/c2pa.worker.min.js`;

  let c2paApi;   // ESM module
  let runtime;   // createC2pa() instance

  async function ensureC2pa() {
    if (!c2paApi) c2paApi = await import(LIB_URL);
    if (!runtime) runtime = await c2paApi.createC2pa({ wasmSrc: WASM_SRC, workerSrc: WORKER_SRC });
  }

  // ---- Small helpers ------------------------------------------------------
  const escapeHtml = (s = '') =>
    String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  const lower = (v) => (v == null ? '' : String(v).toLowerCase());

  const toList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map) return [...v.values()];
    if (typeof v === 'object' && typeof v[Symbol.iterator] === 'function') return [...v];
    if (typeof v === 'object') return Object.values(v);
    return [];
  };

  const dedupe = (arr) => [...new Set(arr.filter(Boolean))];

  const getThumbUrl = (obj, fallback = '') => {
    try {
      if (obj?.thumbnail?.getUrl) return obj.thumbnail.getUrl().url || fallback;
      if (obj?.thumbnail?.url)     return obj.thumbnail.url || fallback;
    } catch {}
    return fallback;
  };

  const fileNameFromUrl = (u = '') => {
    try { return decodeURIComponent(u.split('/').pop().split('?')[0] || ''); }
    catch { return ''; }
  };

  const niceDate = (iso) => {
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso || '—';
      // e.g. "Jun 02, 2024 4:28 PM CST/CDT"
      const formatted = d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
        // If you want to force Central time regardless of viewer location, add:
        // timeZone: 'America/Chicago'
      });
      // remove the comma before the time: "Jun 02, 2024, 4:28 PM" -> "Jun 02, 2024 4:28 PM"
      return formatted.replace(/,\s(?=\d{1,2}:)/, ' ');
    } catch {
      return iso || '—';
    }
  };

  // pretty names for common action codes
  const ACTION_TITLES = {
    crop: 'Cropping edits',
    cropping: 'Cropping edits',
    'c2pa.actions.crop': 'Cropping edits',
    resize: 'Resizing',
    'c2pa.actions.resize': 'Resizing',
    rotate: 'Rotate',
    'c2pa.actions.rotate': 'Rotate',
    coloradjust: 'Color adjustments',
    'color-adjust': 'Color adjustments',
    'c2pa.actions.color_adjust': 'Color adjustments',
    'contentauth.actions.opened': 'Opened a pre-existing file',
    opened: 'Opened a pre-existing file',
    edit: 'Edited',
    edited: 'Edited'
  };
  const actionPretty = (code) => ACTION_TITLES[lower(code)] || code;

  // Safe action extractor (handles many shapes, never .toLowerCase on undefined)
  const extractActions = (manifest) => {
    const out = [];

    for (const a of toList(manifest?.assertions)) {
      const label = lower(a?.label ?? a?.type ?? '');
      const data  = a?.data ?? a?.value ?? a;

      let list = [];
      if (/actions?/.test(label)) {
        if (Array.isArray(data?.actions)) list = data.actions;
        else if (Array.isArray(data)) list = data;
        else if (data && typeof data === 'object' && Array.isArray(data.action)) list = data.action;
      }

      for (const it of list) {
        let code = typeof it === 'string' ? it : (it?.action ?? it?.type ?? '');
        code = lower(code);
        if (!code) continue;
        out.push(actionPretty(code));
      }

      // heuristic catch-all for cropping
      const s = lower(JSON.stringify(data ?? {}));
      if (!out.some(t => /crop/i.test(t)) && /cropp?/.test(s)) out.push('Cropping edits');
    }

    return dedupe(out);
  };

  // Pull fields from a manifest into a flat object
  const summarizeManifest = (m = {}, fallbackFile = '') => {
    // Console log manifest for debugging:
    // console.log('Manifest:', m);

    const authorObj = m?.assertions?.data[1]?.data?.author[0];
    const authorName = authorObj?.name || 'Unknown';
    const authorType = authorObj?.['@type'] || 'Unknown';
    const author = `${authorName} (${authorType})`;

    // const issuer =
    //   m?.signatureInfo?.issuer ||
    //   m?.signatureInfo?.issuerName ||
    //   m?.signerInfo?.name ||
    //   m?.signer?.name ||
    //   '—';

    const generator =
      m?.claimGenerator || m?.generator || '—';

    const issued =
      m?.signatureInfo?.time ||
      m?.captureDate ||
      m?.created ||
      '—';

    const actions = extractActions(m);

    const title =
      m?.title ||
      m?.documentId ||
      fileNameFromUrl(fallbackFile) ||
      'Image';

    // return { issuer, generator, actions, issued: issued ? niceDate(issued) : '—', title };
    return { author, generator, actions, issued: issued ? niceDate(issued) : '—', title };
  };

  // Render one “row”: image (left) + metadata card (right)
  const renderRow = (thumbUrl, meta, emptyNote = '') => {
    const acts = (meta.actions && meta.actions.length)
      ? `<div><strong>Actions:</strong> ${escapeHtml(meta.actions.join(', '))}</div>`
      : '';

    const rightCard = emptyNote
      ? `<div class="cr-card cr-card--muted">${escapeHtml(emptyNote)}</div>`
      : `<div class="cr-card">
           <div><strong>Author:</strong> ${escapeHtml(meta.author)}</div>
           <div><strong>App/device used:</strong> ${escapeHtml(meta.generator)}</div>
           ${acts}
           <div><strong>Issued on:</strong> ${escapeHtml(meta.issued)}</div>
         </div>`;

    return `
      <div class="cr-row">
        <div class="cr-imgbox">
          <img class="cr-img" src="${escapeHtml(thumbUrl)}" alt="">
          <div class="cr-filename">${escapeHtml(meta.title)}</div>
        </div>
        ${rightCard}
      </div>
    `;
  };

  // Connect rows with an arrow
  const connector = () => `<div class="cr-connector"><span class="cr-arrow" aria-hidden="true"></span></div>`;

  // ---- Modal open/close wiring (click badge to build viewer) --------------
  const openModal = () => { modal.hidden = false; document.body.style.overflow = 'hidden'; };
  const closeModal = () => { modal.hidden = true; document.body.style.overflow = ''; badge.focus(); };
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('cr-modal__backdrop')) closeModal();
  });

  badge.addEventListener('click', async () => {
    openModal();
    bodyEl.innerHTML = `<p class="cr-loading">Loading Content Credentials…</p>`;

    try {
      await ensureC2pa();

      const assetUrl = heroImg?.currentSrc || heroImg?.src;
      if (!assetUrl) {
        bodyEl.innerHTML = `<p class="cr-error">No image found to inspect.</p>`;
        return;
      }

      // Fetch as Blob so the SDK can read the bytes (avoids HEAD/CORS issues)
      const resp = await fetch(assetUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Image fetch failed (${resp.status})`);
      const blob = await resp.blob();

      const { manifestStore, source } = await runtime.read(blob);
      const active = manifestStore?.activeManifest;

      // current image block
      const currThumb = getThumbUrl(source, assetUrl);
      let html = '';

      if (!active) {
        // const meta = { issuer: '—', generator: '—', actions: [], issued: '—', title: fileNameFromUrl(assetUrl) || 'Image' };
        const meta = { author: '—', generator: '—', actions: [], issued: '—', title: fileNameFromUrl(assetUrl) || 'Image' };
        html += renderRow(currThumb, meta, 'No Content Credentials');
      } else {
        const meta = summarizeManifest(active, assetUrl);
        html += renderRow(currThumb, meta);
      }

      // parents / ingredients
      const ings = toList(active?.ingredients);
      for (const ing of ings) {
        html += connector();

        const pThumb = getThumbUrl(ing, '');
        const pTitle = ing?.title || ing?.documentId || 'Source';
        // if the ingredient carries its own manifest summary (often it does not), try to show it
        const hasManifest = !!ing?.ingredientManifest;
        if (hasManifest) {
          const sm = summarizeManifest(ing.ingredientManifest, pTitle);
          sm.title = pTitle;
          html += renderRow(pThumb || currThumb, sm);
        } else {
          // const sm = { issuer: '—', generator: '—', actions: [], issued: '—', title: pTitle };
          const sm = { author: '—', generator: '—', actions: [], issued: '—', title: pTitle };
          html += renderRow(pThumb || currThumb, sm, 'No Content Credential');
        }
      }

      bodyEl.innerHTML = `<div class="cr-graph">${html}</div>`;
    } catch (err) {
      console.error('C2PA viewer error:', err);
      bodyEl.innerHTML = `
        <p class="cr-error">
          Could not read Content Credentials.<br>
          <small>${escapeHtml(err?.message || String(err))}</small>
        </p>
      `;
    }
  });
});
