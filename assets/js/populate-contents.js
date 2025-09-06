(async function(){
  const els = {
    root:   document.getElementById('articleRoot'),
    title:  document.getElementById('title'),
    author: document.getElementById('author'),
    posted: document.getElementById('posted'),
    updated:document.getElementById('updated'),
    hero:   document.getElementById('hero'),
    heroWrap: document.getElementById('heroWrap'),
    caption:document.getElementById('caption'),
    body:   document.getElementById('body'),
    kicker:   document.getElementById('kicker')
  };

  try {
    const res = await fetch('article.json', {cache: 'no-store'});
    const data = await res.json();
    renderArticle(data);
  } catch (err) {
    console.warn('Could not load article.json. Showing placeholders.', err);
  }

  function renderArticle(data){
    // article id (stored on root)
    if (data.article_id) els.root.dataset.articleId = data.article_id;

    // text fields
    if (data.kicker)      els.kicker.textContent = data.kicker;
    if (data.title)       els.title.textContent  = data.title;
    if (data.autor)       els.author.textContent = data.autor;
    if (data.posted)      els.posted.textContent = data.posted;
    if (data.last_updated)els.updated.textContent= data.last_updated;

    // image
    if (data.image_path){
      els.hero.src = data.image_path;
      els.heroWrap.style.display = '';
    } else {
      els.heroWrap.style.display = 'none';
    }
    if (data.image_caption){
      els.caption.textContent = data.image_caption;
    }

    // content paragraphs
    els.body.innerHTML = '';
    const paras = Array.isArray(data.content)
      ? data.content
      : (typeof data.content === 'string' ? [data.content] : []);
    paras.forEach(txt => {
      const p = document.createElement('p');
      p.textContent = txt;
      els.body.appendChild(p);
    });
  }
})();
