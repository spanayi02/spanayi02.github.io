// Shared behaviour for every page: smooth scroll, nav state, anchor jumps, reveals, contact footer.
// Page scripts queue an init function with `(window.SitePage = window.SitePage || []).push(fn)`;
// each runs after this setup and receives the Site object.
document.addEventListener('DOMContentLoaded', function () {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);

  // Without GSAP nothing would animate the hidden start states in, so show everything
  if (!hasGsap) root.classList.remove('js');

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ── Smooth scroll (Lenis) driven by GSAP's ticker ──
  let lenis = null;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (!reduce && hasGsap && window.Lenis) {
    lenis = new Lenis({ lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    root.classList.add('no-lenis');
  }

  // ── Anchor jumps: gliding across a whole page renders every section in between and stutters,
  //    so long jumps fade the page, cut to just before the target, then ease the last stretch in ──
  const pageEl = document.querySelector('.page');
  const easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
  let jumping = false;
  function jumpTo(y) {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    y = Math.max(0, Math.min(maxY, y));
    const dist = y - window.scrollY;
    const lead = Math.min(Math.abs(dist), window.innerHeight * 0.5) * Math.sign(dist);
    const glide = function () {
      if (lenis) lenis.scrollTo(y, { duration: 0.7, easing: easeOut, force: true });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    if (Math.abs(dist) <= window.innerHeight * 1.2 || reduce || !hasGsap || !pageEl) { glide(); return; }
    if (jumping) return;
    jumping = true;
    gsap.to(pageEl, {
      opacity: 0, duration: 0.18, ease: 'power1.in',
      onComplete: function () {
        if (lenis) lenis.scrollTo(y - lead, { immediate: true, force: true });
        else window.scrollTo(0, y - lead);
        glide();
        gsap.to(pageEl, { opacity: 1, duration: 0.35, ease: 'power1.out', onComplete: function () { jumping = false; } });
      }
    });
  }
  document.querySelectorAll('a[href^="#"]:not(.say-hi):not([data-say-hi])').forEach(function (a) {
    a.addEventListener('click', function (e) {
      const id = a.getAttribute('href');
      if (id.length < 2) return; // bare "#" links are buttons handled by page scripts
      const target = id === '#top' ? null : document.querySelector(id);
      if (id !== '#top' && !target) return;
      e.preventDefault();
      jumpTo(target ? target.getBoundingClientRect().top + window.scrollY : 0);
    });
  });

  // ── Nav shadow after 100px ──
  const nav = document.getElementById('nav');
  if (nav) {
    const onScrollNav = function () { nav.classList.toggle('scrolled', window.scrollY > 100); };
    window.addEventListener('scroll', onScrollNav, { passive: true });
    onScrollNav();
  }

  // ── Big contact marquee text (two identical halves for a seamless loop) ──
  const bigMarquee = document.getElementById('bigMarquee');
  if (bigMarquee) {
    let html = '';
    for (let i = 0; i < 10; i++) html += '<span>Building useful things •</span>';
    bigMarquee.innerHTML = html + html;
  }

  // ── Background video (HLS), started lazily and paused while off-screen ──
  const VIDEO_SRC = 'https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8';
  function playSafe(v) { const p = v.play(); if (p && p.catch) p.catch(function () { }); }
  function attachVideo(video) {
    if (video.dataset.attached) return;
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(VIDEO_SRC);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = VIDEO_SRC;
    } else {
      return;
    }
    video.dataset.attached = '1';
    video.muted = true;
    video.addEventListener('playing', function () { video.classList.add('ready'); }, { once: true });
    playSafe(video);
  }
  const videos = document.querySelectorAll('video[data-hls]');
  if (!reduce && videos.length && 'IntersectionObserver' in window) {
    const vObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        const v = e.target;
        if (e.isIntersecting) {
          attachVideo(v);
          if (v.dataset.attached) playSafe(v);
        } else if (v.dataset.attached) {
          v.pause();
        }
      });
    }, { rootMargin: '200px' });
    videos.forEach(function (v) { vObs.observe(v); });
  }

  // ── Section reveals ──
  if (hasGsap) {
    if (reduce) {
      gsap.set('[data-reveal]', { opacity: 1 });
    } else {
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) {
          // CSS transitions on the same properties would fight the tween frame by frame
          batch.forEach(function (el) { el.style.transition = 'none'; });
          gsap.fromTo(batch, { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform',
            onComplete: function () { batch.forEach(function (el) { el.style.transition = ''; }); }
          });
        }
      });
    }
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  // ── "Say hi" opens a contact panel: copy email, a quick message that opens the mail app, links.
  //    Without JS the button still jumps to the contact footer ──
  const sayHi = document.querySelector('.say-hi');
  if (sayHi) {
    const EMAIL = 'spanay02@gmail.com';
    const FORM_KEY = 'cdcff325-37f5-4d43-9852-55f703d6149d'; // Web3Forms access key (public by design; mail goes to EMAIL)
    const cv = document.querySelector('a[href$=".pdf"]');
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="hi-backdrop"></div>' +
      '<div class="hi-panel" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="hiTitle">' +
      '  <div class="hi-head">' +
      '    <div>' +
      '      <h2 id="hiTitle">Say hi <span class="wave" aria-hidden="true">👋</span></h2>' +
      '      <div class="hi-status"><span class="hi-dot" aria-hidden="true"></span><span>Open to roles &amp; projects · <span class="hi-time"></span> in Nicosia</span></div>' +
      '    </div>' +
      '    <button class="hi-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>' +
      '  </div>' +
      '  <button class="hi-email" type="button"><b>' + EMAIL + '</b><small>Copy</small></button>' +
      '  <form class="hi-form">' +
      '    <span class="hi-label">Or send a quick note about</span>' +
      '    <div class="hi-topics">' +
      '      <button type="button" aria-pressed="true">A project</button>' +
      '      <button type="button" aria-pressed="false">A free audit</button>' +
      '      <button type="button" aria-pressed="false">A role</button>' +
      '      <button type="button" aria-pressed="false">Just saying hi</button>' +
      '    </div>' +
      '    <input name="name" type="text" placeholder="Your name" autocomplete="name" aria-label="Your name" />' +
      '    <input name="email" type="email" placeholder="Your email (so I can reply)" autocomplete="email" aria-label="Your email" required />' +
      '    <input class="hi-hp" name="botcheck" type="checkbox" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
      '    <textarea name="msg" placeholder="What\'s on your mind?" aria-label="Message" required></textarea>' +
      '    <button class="btn btn-solid hi-send" type="submit">Send message<span class="arrow">↗</span></button>' +
      '    <p class="hi-note" role="status" aria-live="polite"></p>' +
      '  </form>' +
      '  <div class="hi-links">' +
      '    <a href="https://www.linkedin.com/in/stylianos-panayiotou-0444552a6/" target="_blank" rel="noopener">LinkedIn ↗</a>' +
      '    <a href="https://github.com/spanayi02" target="_blank" rel="noopener">GitHub ↗</a>' +
      (cv ? '    <a href="' + cv.getAttribute('href') + '" target="_blank" rel="noopener">Resume ↗</a>' : '') +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap);
    const panel = wrap.querySelector('.hi-panel');
    const form = wrap.querySelector('.hi-form');
    const topics = [...wrap.querySelectorAll('.hi-topics button')];
    const emailBtn = wrap.querySelector('.hi-email');
    let lastFocus = null;

    const setTime = function () {
      wrap.querySelector('.hi-time').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit' });
    };
    const pickTopic = function (name) {
      topics.forEach(function (t) { t.setAttribute('aria-pressed', t.textContent === name ? 'true' : 'false'); });
    };
    const openHi = function (topic) {
      setTime();
      if (topic) pickTopic(topic);
      lastFocus = document.activeElement;
      root.classList.add('hi-open');
      if (lenis) lenis.stop();
      setTimeout(function () { form.elements.msg.focus({ preventScroll: true }); }, 200);
    };
    const closeHi = function () {
      if (!root.classList.contains('hi-open')) return;
      root.classList.remove('hi-open');
      if (lenis) lenis.start();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };

    sayHi.addEventListener('click', function (e) { e.preventDefault(); openHi(); });
    // buttons elsewhere on the page can open the panel with a topic preselected
    document.querySelectorAll('[data-say-hi]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openHi(el.dataset.sayHi); });
    });
    wrap.querySelector('.hi-backdrop').addEventListener('click', closeHi);
    wrap.querySelector('.hi-close').addEventListener('click', closeHi);
    topics.forEach(function (b) {
      b.addEventListener('click', function () { topics.forEach(function (t) { t.setAttribute('aria-pressed', t === b ? 'true' : 'false'); }); });
    });
    emailBtn.addEventListener('click', function () {
      const label = emailBtn.querySelector('small');
      const done = function (ok) {
        label.textContent = ok ? 'Copied ✓' : 'Opening mail…';
        if (!ok) window.location.href = 'mailto:' + EMAIL;
        setTimeout(function () { label.textContent = 'Copy'; }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
    const note = form.querySelector('.hi-note');
    const sendBtn = form.querySelector('.hi-send');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.botcheck.checked) return; // bots tick the hidden box
      const topic = topics.find(function (t) { return t.getAttribute('aria-pressed') === 'true'; }).textContent;
      const name = form.elements.name.value.trim();
      const reply = form.elements.email.value.trim();
      const msg = form.elements.msg.value.trim();
      const subject = topic === 'Just saying hi' ? 'Hi Stylianos' : 'About ' + topic.toLowerCase() + (name ? ' from ' + name : '');
      // if the service is unreachable the message is not lost: fall back to the visitor's mail app
      const fallback = function () {
        note.textContent = 'Could not send from here, opening your mail app instead…';
        window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg + (name ? '\n\n' + name : ''));
      };
      sendBtn.disabled = true;
      note.textContent = 'Sending…';
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: FORM_KEY, subject: subject, from_name: name || 'Portfolio visitor', name: name, email: reply, topic: topic, message: msg })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.success) throw new Error(res.message || 'failed');
        note.textContent = 'Sent ✓ Thanks, I will reply to ' + reply + ' soon.';
        form.elements.msg.value = '';
      }).catch(fallback).then(function () { sendBtn.disabled = false; });
    });
    window.addEventListener('keydown', function (e) {
      if (!root.classList.contains('hi-open')) return;
      if (e.key === 'Escape') closeHi();
      else if (e.key === 'Tab') {
        // keep keyboard focus inside the panel
        const f = [...panel.querySelectorAll('button, a[href], input, textarea')];
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  const Site = { lenis: lenis, reduce: reduce, hasGsap: hasGsap, jumpTo: jumpTo };
  window.Site = Site;
  (window.SitePage || []).forEach(function (fn) { fn(Site); });
});
