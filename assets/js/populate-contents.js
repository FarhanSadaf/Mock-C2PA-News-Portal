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
    const res = await fetch('./articles.json', { cache: 'no-store' }); 
    const list = await res.json(); 

    const requestedId = getArticleIdFromURL();

    if (!Array.isArray(list) || list.length === 0) {
      renderError('No articles found in articles.json.');
      return;
    }

    if (!requestedId) {
      // No id specified: show FIRST article by default
      renderArticle(list[0]);
      setDocTitle(list[0]);
      return;
    }

    // If an id is provided, require an exact match; otherwise show "Not Found"
    console.log(`Looking for article with id: ${requestedId}`);
    const article = list.find(a => String(a.article_id) === String(requestedId));
    if (article) {
      renderArticle(article);
      setDocTitle(article);
    } else {
      renderNotFound(requestedId, list);
    }
  } catch (err) {
    console.warn('Could not load article.json.', err);
    renderError('No articles found in articles.json.');
  }

  // --- helpers ---

  // For GitHub Pages, use the query-string (?id=2). Path segments like /2 will 404 at the server.
  function getArticleIdFromURL() {
    const url = new URL(window.location.href);
    return url.searchParams.get('id'); // e.g., ?id=2
  }

  function setDocTitle(article) {
    if (article && article.title) document.title = `${article.title} · CBC News`;
  }

  function renderArticle(data) {
    if (data.article_id) els.root.dataset.articleId = data.article_id;

    if (data.kicker)       els.kicker.textContent  = data.kicker;
    if (data.title)        els.title.textContent   = data.title;
    els.author.textContent = data.autor ?? data.author ?? '—';
    if (data.posted)       els.posted.textContent  = data.posted;
    if (data.last_updated) els.updated.textContent = data.last_updated;

    if (data.image_path) {
      els.hero.src = data.image_path;
      els.hero.alt = data.image_caption || 'Article image';
      els.heroWrap.style.display = '';
    } else {
      els.heroWrap.style.display = 'none';
    }
    els.caption.textContent = data.image_caption || '—';

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

  function renderNotFound(requestedId, list) {
    els.kicker.textContent = 'Not Found';
    els.title.textContent = 'We couldn’t find that article';
    els.author.textContent = '';
    els.posted.textContent = '';
    els.updated.textContent = '';
    els.heroWrap.style.display = 'none';
    els.caption.textContent = '';
    document.title = 'Article not found · CBC News';

    els.body.innerHTML = '';

    const p1 = document.createElement('p');
    p1.textContent = `No article with id “${requestedId}”.`;
    els.body.appendChild(p1);

    const p2 = document.createElement('p');
    p2.textContent = 'Try one of these:';
    els.body.appendChild(p2);

    const ul = document.createElement('ul');
    list.forEach(a => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      // On GitHub Pages, use query-string links
      link.href = `./?id=${encodeURIComponent(a.article_id)}`;
      link.textContent = a.title || `Article ${a.article_id}`;
      li.appendChild(link);
      ul.appendChild(li);
    });
    els.body.appendChild(ul);
  }

  function renderError(msg) {
    els.kicker.textContent = 'Error';
    els.title.textContent = 'Could not load articles';
    els.author.textContent = '';
    els.posted.textContent = '';
    els.updated.textContent = '';
    els.heroWrap.style.display = 'none';
    els.caption.textContent = '';
    els.body.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = msg;
    els.body.appendChild(p);
    document.title = 'Error · CBC News';
  }
})();
