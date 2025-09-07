// assets/js/populate-contents.js
(async function () {
  const els = {
    root:    document.getElementById('articleRoot'),
    title:   document.getElementById('title'),
    author:  document.getElementById('author'),
    posted:  document.getElementById('posted'),
    updated: document.getElementById('updated'),
    hero:    document.getElementById('hero'),
    heroWrap:document.getElementById('heroWrap'),
    caption: document.getElementById('caption'),
    body:    document.getElementById('body'),
    kicker:  document.getElementById('kicker')
  };

  try {
    const res = await fetch('article.json', { cache: 'no-store' });
    const list = await res.json(); // expecting an array

    const requestedId = getArticleIdFromURL();
    const article = pickArticle(list, requestedId); // defaults to first article

    if (article) {
      renderArticle(article);
      if (article.title) document.title = `${article.title} · CBC News`;
    } else {
      // fallback if list was empty or bad
      renderPlaceholders();
    }
  } catch (err) {
    console.warn('Could not load article.json. Showing placeholders.', err);
    renderPlaceholders();
  }

  // --- helpers ---

  // pull id from path "/{id}" or query "?id={id}"
  function getArticleIdFromURL() {
    const url = new URL(window.location.href);

    // last non-empty segment, ignoring index.html
    const segs = url.pathname.split('/').filter(Boolean);
    let fromPath = null;
    if (segs.length) {
      const last = segs[segs.length - 1];
      if (!/\.html?$/i.test(last)) {
        fromPath = decodeURIComponent(last);
      }
    }

    const fromQuery = url.searchParams.get('id');
    return fromPath || fromQuery || null;
  }

  // choose the matched article; otherwise default to the first
  function pickArticle(list, requestedId) {
    if (!Array.isArray(list) || list.length === 0) return null;
    if (requestedId != null) {
      const hit = list.find(a => String(a.article_id) === String(requestedId));
      if (hit) return hit;
    }
    return list[0]; // default: first article
  }

  function renderArticle(data) {
    // store id on root for analytics / debug
    if (data.article_id) els.root.dataset.articleId = data.article_id;

    // text fields
    if (data.kicker)       els.kicker.textContent  = data.kicker;
    if (data.title)        els.title.textContent   = data.title;
    els.author.textContent = data.autor ?? data.author ?? '—';
    if (data.posted)       els.posted.textContent  = data.posted;
    if (data.last_updated) els.updated.textContent = data.last_updated;

    // image
    if (data.image_path) {
      els.hero.src = data.image_path;
      els.hero.alt = data.image_caption || 'Article image';
      els.heroWrap.style.display = '';
    } else {
      els.heroWrap.style.display = 'none';
    }
    els.caption.textContent = data.image_caption || '—';

    // content
    els.body.innerHTML = '';
    const paras = Array.isArray(data.content)
      ? data.content
      : (typeof data.content === 'string' ? [data.content] : []);
    if (paras.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'This article has no content.';
      els.body.appendChild(p);
    } else {
      paras.forEach(txt => {
        const p = document.createElement('p');
        p.textContent = String(txt);
        els.body.appendChild(p);
      });
    }
  }

  function renderPlaceholders() {
    els.title.textContent = 'Loading…';
    els.kicker.textContent = '—';
    els.author.textContent = '—';
    els.posted.textContent = '—';
    els.updated.textContent = '—';
    els.heroWrap.style.display = 'none';
    els.caption.textContent = '—';
    els.body.innerHTML = '';
  }
})();
