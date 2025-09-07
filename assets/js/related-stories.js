(async function () {
  const wrap = document.getElementById('relatedStories');
  const listEl = document.getElementById('relatedList');
  if (!wrap || !listEl) return;

  try {
    const res = await fetch('./articles.json', { cache: 'no-store' });
    const articles = await res.json();
    if (!Array.isArray(articles) || articles.length < 2) {
      // Hide section if nothing to suggest
      wrap.style.display = 'none';
      return;
    }

    // Determine current article id from URL (?id=...) or path fallback
    const currentId = getArticleIdFromURL();
    const currentIndex = findCurrentIndex(articles, currentId);

    const maxItems = Math.min(4, Math.max(0, articles.length - 1));
    const items = [];

    // Collect the NEXT items in circular order, skipping current
    for (let i = 0; i < maxItems; i++) {
      const idx = (currentIndex + 1 + i) % articles.length;
      items.push(articles[idx]);
    }

    // Render
    listEl.innerHTML = '';
    items.forEach(a => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `?id=${encodeURIComponent(a.article_id)}`; 
      link.textContent = a.title || `Article ${a.article_id}`;
      li.appendChild(link);
      listEl.appendChild(li);
    });
  } catch (e) {
    // If fetch fails, just hide the section
    wrap.style.display = 'none';
  }

  // --- helpers ---
  function getArticleIdFromURL() {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('id');
    if (fromQuery) return fromQuery;

    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length) {
      const last = segs[segs.length - 1];
      if (!/\.html?$/i.test(last)) return decodeURIComponent(last);
    }
    return null; // default article will be index 0
  }

  function findCurrentIndex(arr, id) {
    if (id == null) return 0; // default article is first
    const idx = arr.findIndex(a => String(a.article_id) === String(id));
    return idx >= 0 ? idx : 0;
  }
})();
