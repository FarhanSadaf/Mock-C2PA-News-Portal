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


  const toList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map) return [...v.values()];
    if (typeof v === 'object' && typeof v[Symbol.iterator] === 'function') return [...v];
    if (typeof v === 'object') return Object.values(v);
    return [];
  };


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

// Pretty titles you already use
const ACTION_TITLES = {
  'c2pa.opened': 'Opened a pre-existing file',
  'c2pa.cropped': 'Cropping',
  'c2pa.color_adjustments': 'Color adjustments',
  'c2pa.blur': 'Blurring',
  'c2pa.edited': 'Edits',
  'c2pa.created': 'Created',
  'c2pa.inpainting': 'Inpainting',
  'c2pa.published': 'Published'
};

const ACTION_PARAMS = { 
  Exposure2012: 'exposure', 
  Texture: 'texture', 
  Vibrance: 'vibrance', 
  Saturation: 'saturation', 
  PostCropVignetteAmount: 'vignette',
  Sharpness: 'sharpness',
  SharpenDetail: 'sharpness',
  ConvertToGrayscale: 'grayscale conversion',
  NoiseReduction: 'noise reduction',
  ColorNoiseReduction: 'noise reduction',
  BackgroundBlur: 'background blur',
  RedEyeRemoval: 'red-eye removal',
  ManualCompositing: 'manual compositing',
  'Clone/Heal': 'cloning/healing',
  Transform: 'transformation e.g. wrap, distort',
};

function extractActions(manifest) {
  const assertionsRaw = manifest?.assertions;
  const assertions = Array.isArray(assertionsRaw)
    ? assertionsRaw
    : (Array.isArray(assertionsRaw?.data) ? assertionsRaw.data : []);

  const groups = new Map(); 
  let order = 0;

  for (const a of assertions) {
    const label = String(a?.label || a?.type || '').toLowerCase();
    if (!label.startsWith('c2pa.actions')) continue;

    const actions = Array.isArray(a?.data?.actions) ? a.data.actions : [];
    for (const it of actions) {
      const rawCode = typeof it === 'string' ? it : (it?.action || it?.type || '');
      const code = String(rawCode).toLowerCase();
      if (!code || !ACTION_TITLES[code]) continue; // only mapped actions

      let title_ = ACTION_TITLES[code];
      if (code === 'c2pa.created') {
        const agent = it?.softwareAgent?.name || 'Unknown tool';
        title_ += ` by ${agent}`;
      }

      // create group if first time seen
      if (!groups.has(code)) {
        groups.set(code, {
          idx: order++,
          title: title_,
          params: new Set(),
          ai: '' // '', ' [AI-edited]', ' [AI-generated]'
        });
      }

      const g = groups.get(code);

      // collect parameter token (from com.adobe.acr) if mapped
      const paramKey = it?.parameters?.['com.adobe.acr'];
      const mapped = paramKey ? ACTION_PARAMS[paramKey] : null;
      if (mapped) g.params.add(mapped);

      // track AI suffix for the group
      const dst = String(it?.digitalSourceType || '').toLowerCase();
      if (dst.includes('trainedalgorithmicmedia')) {
        const suffix = dst.includes('composite') ? ' [AI-edited]' : ' [AI-generated]';
        // prefer edited over generated if both ever appear
        g.ai = g.ai === ' [AI-edited]' ? g.ai : suffix;
      }
    }
  }

  // Build final ordered list
  const out = [...groups.values()]
    .sort((a, b) => a.idx - b.idx)
    .map(g => {
      const details = g.params.size ? ` like ${[...g.params].join(', ')}` : '';
      return g.title + details + g.ai;
    });

  return out;
}



  // Pull fields from a manifest into a flat object
  const summarizeManifest = (m = {}, fallbackFile = '') => {
    // console.log('Manifest:', m);

    const authorObj = m?.assertions?.data[1]?.data?.author[0];
    const authorName = authorObj?.name || 'Unknown';
    const authorType = authorObj?.['@type'] || 'Unknown';
    const author = `${authorName} (${authorType})`;

    const generator =
      (m?.claimGeneratorInfo?.[0]?.name || '') +
      (m?.claimGeneratorInfo?.[0]?.version ? ' ' + m.claimGeneratorInfo[0].version : '') ||
      '—';

    const issued =
      m?.signatureInfo?.time ||
      m?.assertions?.data[0]?.data?.["EXIF:DateTime"] ||
      m?.created ||
      '—';

    const actions = extractActions(m);

    const title =
      m?.title ||
      m?.documentId ||
      fileNameFromUrl(fallbackFile) ||
      'Image';

    return { author, generator, actions, issued: issued ? niceDate(issued) : '—', title };
  };

  // Render one “row”: image (left) + metadata card (right)
  const renderRow = (thumbUrl, meta, emptyNote = '') => {
    const acts = (meta.actions && meta.actions.length)
      ? `<div><strong>Actions:</strong> ${escapeHtml(meta.actions.join(' -> '))}</div>`
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
        const pTitle = ing?.manifest?.title || ing?.title || 'Source';
        console.log(pTitle)
        
        const hasManifest = !!ing?.manifest;
        if (hasManifest) {
          const sm = summarizeManifest(ing.manifest, pTitle);
          sm.title = pTitle;
          html += renderRow(pThumb || currThumb, sm);

          // If it ing.manifest has ingredients, show just one more level (grandparents)
          const gpas = toList(ing?.manifest?.ingredients);
          for (const gpa of gpas) {
            html += connector();
            const gpThumb = getThumbUrl(gpa, '');
            const gpTitle = gpa?.manifest?.title || gpa?.title || 'Source';
            if (gpas.length) {
            if (gpas.length > 1) {
              const sm = { author: '—', generator: '—', actions: [], issued: '—', title: gpTitle };
              html += renderRow(gpThumb || pThumb || currThumb, sm, `+ ${gpas.length - 1} more source(s)`);
            } else {
              const sm = summarizeManifest(gpas[0]?.manifest, gpTitle);
              sm.title = gpTitle;
              html += renderRow(gpThumb || pThumb || currThumb, sm);
            }
          }
          }
        } else {
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
