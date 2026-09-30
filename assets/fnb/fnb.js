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

  /* Hero background crossfade: Tokyo → New York → Hong Kong → Paris → Dubai, every 4 s.
     One timer only; paused while the tab is hidden; disabled under prefers-reduced-motion (Tokyo stays). */
  var media = document.getElementById('heroMedia');
  var slides = media ? [].slice.call(media.querySelectorAll('.hs')) : [];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var idx = 0, timer = null;
  function show(n) {
    var next = slides[n], cur = slides[idx];
    if (next === cur) return;
    slides.forEach(function (s) { s.classList.remove('is-prev'); });
    cur.classList.remove('is-active'); cur.classList.add('is-prev');
    next.classList.add('is-active');
    idx = n;
  }
  function advance() {
    var n = (idx + 1) % slides.length, next = slides[n];
    if (next.complete && next.naturalWidth) { show(n); return; }
    (next.decode ? next.decode() : Promise.resolve()).then(function () { show(n); }, function () { show(n); });
  }
  function start() { if (timer || slides.length < 2 || reduce.matches || document.hidden) return; timer = setInterval(advance, 4000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  if (slides.length > 1) {
    start();
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if (reduce.addEventListener) reduce.addEventListener('change', function (e) { if (e.matches) { stop(); show(0); } else start(); });
  }

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
