document.addEventListener('DOMContentLoaded', () => {
  const btn  = document.getElementById('sectionsToggle');
  const menuWrap = btn ? btn.closest('.sections-mobile') : null;
  if (!btn || !menuWrap) return;

  const close = () => {
    menuWrap.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menuWrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!menuWrap.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
});
