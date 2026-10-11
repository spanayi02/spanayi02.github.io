// Project viewer shared by the home and portfolio pages: one screenshot gallery with
// Overview / Technical details tabs. Pages open it with
// `Site.viewer.open({ title, cat, images, overview, tech, tags, links }, tab, trigger)`.
(window.SitePage = window.SitePage || []).unshift(function (Site) {
  const lenis = Site.lenis;
  const arrow = function (d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '" /></svg>';
  };

  const viewer = document.createElement('div');
  viewer.className = 'viewer';
  viewer.id = 'viewer';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-labelledby', 'vTitle');
  viewer.setAttribute('aria-hidden', 'true');
  // Lenis blocks touch scrolling while stopped; this lets the dialog itself scroll on phones
  viewer.setAttribute('data-lenis-prevent', '');
  viewer.innerHTML =
    '<div class="v-backdrop"></div>' +
    '<div class="v-shell">' +
    '  <div class="v-media">' +
    '    <div class="v-stage">' +
    '      <div class="v-blur" aria-hidden="true"></div>' +
    '      <img class="v-img" alt="" />' +
    '      <div class="v-loader" aria-hidden="true"></div>' +
    '      <button class="v-nav v-prev" type="button" aria-label="Previous image">' + arrow('M15 18l-6-6 6-6') + '</button>' +
    '      <button class="v-nav v-next" type="button" aria-label="Next image">' + arrow('M9 6l6 6-6 6') + '</button>' +
    '      <span class="v-count" aria-live="polite"></span>' +
    '    </div>' +
    '    <div class="v-thumbs"></div>' +
    '  </div>' +
    '  <aside class="v-info">' +
    '    <div class="v-head">' +
    '      <div><div class="v-cat"></div><h3 id="vTitle"></h3></div>' +
    '      <button class="v-close" type="button" aria-label="Close">' + arrow('M6 6l12 12M18 6L6 18') + '</button>' +
    '    </div>' +
    '    <div class="v-tabs" role="tablist">' +
    '      <button class="v-tab active" type="button" role="tab" data-tab="overview">Overview</button>' +
    '      <button class="v-tab" type="button" role="tab" data-tab="tech">Technical details</button>' +
    '    </div>' +
    '    <p class="v-text"></p>' +
    '    <div class="v-tags"></div>' +
    '    <div class="v-links"></div>' +
    '    <div class="v-hint">← → to browse · Esc to close</div>' +
    '  </aside>' +
    '</div>';
  document.body.appendChild(viewer);

  const v = {
    stage: viewer.querySelector('.v-stage'),
    img: viewer.querySelector('.v-img'),
    blur: viewer.querySelector('.v-blur'),
    loader: viewer.querySelector('.v-loader'),
    count: viewer.querySelector('.v-count'),
    thumbs: viewer.querySelector('.v-thumbs'),
    prev: viewer.querySelector('.v-prev'),
    next: viewer.querySelector('.v-next'),
    cat: viewer.querySelector('.v-cat'),
    title: viewer.querySelector('#vTitle'),
    close: viewer.querySelector('.v-close'),
    tabs: [...viewer.querySelectorAll('.v-tab')],
    text: viewer.querySelector('.v-text'),
    tags: viewer.querySelector('.v-tags'),
    links: viewer.querySelector('.v-links')
  };
  const animate = Site.hasGsap && !Site.reduce;
  // Light copies live in images/gallery/ (same path, folders flattened, saved as .jpg)
  const flat = function (src) { return src.replace(/^images\//, '').replace(/\//g, '_').replace(/\.[^.]+$/, '.jpg'); };
  const large = function (src) { return 'images/gallery/' + flat(src); };
  const thumb = function (src) { return 'images/gallery/thumb/' + flat(src); };
  let images = [];
  let index = 0;
  let texts = {};
  let swapToken = 0;
  let lastFocused = null;

  // Loads the first source that works (light copy, then the original)
  function loadFirst(srcs, done) {
    const src = srcs.shift();
    const im = new Image();
    im.onload = function () { done(src); };
    im.onerror = function () { if (srcs.length) loadFirst(srcs, done); else done(src); };
    im.src = src;
  }

  function show(i, dir) {
    const n = images.length;
    if (!n) return;
    index = (i + n) % n;
    const token = ++swapToken;
    v.count.textContent = (index + 1) + ' / ' + n;
    [...v.thumbs.children].forEach(function (b, k) {
      const on = k === index;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) v.thumbs.scrollTo({ left: b.offsetLeft - v.thumbs.clientWidth / 2 + b.clientWidth / 2, behavior: animate ? 'smooth' : 'auto' });
    });
    v.loader.classList.add('on');
    const original = images[index];
    loadFirst([large(original), original], function (src) {
      if (token !== swapToken) return;
      v.loader.classList.remove('on');
      const apply = function () {
        v.img.src = src;
        v.img.alt = v.title.textContent + ' — screenshot ' + (index + 1) + ' of ' + n;
        v.blur.style.backgroundImage = 'url("' + src + '")';
      };
      if (!animate) { apply(); return; }
      const d = dir || 0;
      gsap.to(v.img, {
        opacity: 0, x: -28 * d, duration: .16, ease: 'power2.in', overwrite: true,
        onComplete: function () {
          apply();
          gsap.fromTo(v.img, { opacity: 0, x: 28 * d, scale: .985 }, { opacity: 1, x: 0, scale: 1, duration: .4, ease: 'power3.out' });
        }
      });
    });
    // warm up the neighbours so the arrows feel instant
    [1, -1].forEach(function (d) { (new Image()).src = large(images[(index + d + n) % n]); });
  }

  function setTab(tab) {
    if (!texts[tab]) tab = 'overview';
    v.tabs.forEach(function (b) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.hidden = !texts[b.dataset.tab];
    });
    v.text.textContent = texts[tab] || '';
    if (animate) gsap.fromTo(v.text, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, ease: 'power2.out' });
  }

  function open(p, tab, trigger) {
    images = p.images.slice();
    texts = { overview: p.overview || '', tech: p.tech || '' };

    v.title.textContent = p.title;
    v.cat.textContent = p.cat || '';
    v.tags.innerHTML = '';
    (p.tags || []).forEach(function (t) {
      const s = document.createElement('span');
      s.textContent = t;
      v.tags.appendChild(s);
    });
    v.links.innerHTML = '';
    (p.links || []).forEach(function (l) {
      const a = document.createElement('a');
      a.className = 'btn btn-ring';
      a.href = l.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<span></span><span class="arrow">↗</span>';
      a.firstChild.textContent = l.label;
      v.links.appendChild(a);
    });

    v.thumbs.innerHTML = '';
    images.forEach(function (src, k) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show screenshot ' + (k + 1));
      const im = document.createElement('img');
      im.alt = '';
      im.loading = 'lazy';
      im.onerror = function () { im.onerror = null; im.src = src; };
      im.src = thumb(src);
      b.appendChild(im);
      b.addEventListener('click', function () { if (k !== index) show(k, k > index ? 1 : -1); });
      v.thumbs.appendChild(b);
    });
    const many = images.length > 1;
    v.prev.hidden = v.next.hidden = v.thumbs.hidden = v.count.hidden = !many;

    v.img.removeAttribute('src');
    v.blur.style.backgroundImage = '';
    setTab(tab || 'overview');
    lastFocused = trigger || document.activeElement;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    document.documentElement.style.overflow = 'hidden';
    index = 0;
    show(0, 0);
    if (animate) gsap.fromTo('.v-info > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out', stagger: .05, delay: .1, clearProps: 'transform' });
    v.close.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!viewer.classList.contains('open')) return;
    swapToken++;
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lenis) lenis.start();
    if (lastFocused) lastFocused.focus({ preventScroll: true });
  }

  v.tabs.forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
  v.prev.addEventListener('click', function () { show(index - 1, -1); });
  v.next.addEventListener('click', function () { show(index + 1, 1); });
  v.close.addEventListener('click', closeViewer);
  viewer.querySelector('.v-backdrop').addEventListener('click', closeViewer);

  // Swipe between screenshots on touch screens
  let touchX = null;
  v.stage.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  v.stage.addEventListener('touchend', function (e) {
    if (touchX === null || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  window.addEventListener('keydown', function (e) {
    if (!viewer.classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowLeft' && images.length > 1) show(index - 1, -1);
    else if (e.key === 'ArrowRight' && images.length > 1) show(index + 1, 1);
    else if (e.key === 'Tab') {
      // keep keyboard focus inside the dialog
      const f = [...viewer.querySelectorAll('button, a[href]')].filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  Site.viewer = { open: open, close: closeViewer };
});
