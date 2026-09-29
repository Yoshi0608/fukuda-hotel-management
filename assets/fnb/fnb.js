/* FHM Food & Beverage LP — header state and disclosure menu. No network requests, no tracking. */
(function () {
  var header = document.getElementById('siteHeader');
  var hero = document.querySelector('.hero');
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobileNav');

  function syncHeader() {
    if (!header || !hero) return;
    var limit = hero.getBoundingClientRect().bottom - header.offsetHeight;
    header.classList.toggle('is-clear', limit > 0);
  }
  syncHeader();
  addEventListener('scroll', syncHeader, { passive: true });
  addEventListener('resize', syncHeader);

  function closeMenu() {
    if (!menu || !toggle) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    header.classList.remove('menu-open');
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      menu.hidden = open;
      toggle.setAttribute('aria-expanded', String(!open));
      header.classList.toggle('menu-open', !open);
    });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); }
    });
    matchMedia('(min-width: 1025px)').addEventListener('change', function (e) { if (e.matches) closeMenu(); });
  }
})();
