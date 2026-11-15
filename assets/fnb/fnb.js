/* FHM International Trading Division — header state, mobile menu, hero sequence, line drawing. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('siteHeader');
  var hero = document.getElementById('top');

  /* Header sits transparent over the hero, solid elsewhere. */
  function syncHeader() {
    if (!header || !hero) return;
    var limit = hero.offsetHeight - header.offsetHeight - 10;
    header.classList.toggle('is-clear', window.scrollY < limit);
  }
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('resize', syncHeader);

  /* Mobile menu disclosure. */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('mobileNav');
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    nav.hidden = !open;
    header.classList.toggle('menu-open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080) setMenu(false); });
  }

  /* Hero opening sequence (single orchestrated moment). */
  function start() { root.classList.add('is-loaded'); }
  if (reduce) start();
  else if (document.readyState === 'complete') requestAnimationFrame(start);
  else {
    window.addEventListener('load', function () { requestAnimationFrame(start); });
    setTimeout(start, 2500); /* never hold content back on slow images */
  }

  /* Route lines draw once when diagrams enter view. */
  var drawn = document.querySelectorAll('[data-draw]');
  if (reduce || !('IntersectionObserver' in window)) {
    drawn.forEach(function (el) { el.classList.add('is-drawn'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-drawn'); io.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    drawn.forEach(function (el) { io.observe(el); });
  }
})();
