document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('crBadge');
  const modal = document.getElementById('crModal');
  if (!badge || !modal) return;

  const win = modal.querySelector('.cr-modal__window');
  const closeEls = modal.querySelectorAll('[data-cr-close]');

  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // move focus into the dialog
    setTimeout(() => win?.focus(), 0);
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    badge.focus();
  };

  badge.addEventListener('click', open);
  closeEls.forEach(el => el.addEventListener('click', close));

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  // Optional: click backdrop to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('cr-modal__backdrop')) {
      close();
    }
  });
});
