(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function icons() { if (window.lucide) window.lucide.createIcons(); }

  /* ---------------- header ---------------- */
  var header = $('#site-header');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- mobile menu ---------------- */
  var menuToggle = $('#menu-toggle');
  var mainNav = $('#main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.innerHTML = '<i data-lucide="' + (open ? 'x' : 'menu') + '" aria-hidden="true"></i>';
      icons();
    });
    $$('.nav-link, .nav-cta', mainNav).forEach(function (a) {
      a.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.innerHTML = '<i data-lucide="menu" aria-hidden="true"></i>';
        icons();
      });
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  var revealEls = $$('[data-reveal]');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- hero parallax ---------------- */
  var heroGraphic = $('#hero-graphic');
  if (heroGraphic && !reducedMotion) {
    window.addEventListener('scroll', function () {
      var y = Math.min(window.scrollY * 0.12, 50);
      heroGraphic.style.transform = 'translateY(' + y + 'px)';
    }, { passive: true });
  }

  /* ---------------- floating WhatsApp hide on footer ---------------- */
  var waFloat = $('#wa-float');
  var footerEl = $('footer.site-footer');
  if (waFloat && footerEl && 'IntersectionObserver' in window) {
    var fio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { waFloat.classList.toggle('is-hidden', entry.isIntersecting); });
    }, { threshold: 0 });
    fio.observe(footerEl);
  }

  /* ---------------- swipe helper (touch-only drag/swipe for carousels; desktop navigates by click) ---------------- */
  function enableSwipe(el, handlers) {
    if (!el) return;
    var startX = 0, startY = 0, dragging = false, moved = false;
    var THRESHOLD = 40;

    el.style.touchAction = 'pan-y';

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      if (handlers.onStart) handlers.onStart();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) moved = true;
      if (moved && e.cancelable) e.preventDefault();
    });

    function finish(e) {
      if (!dragging) return;
      dragging = false;
      var dx = e.clientX - startX;
      if (moved && Math.abs(dx) > THRESHOLD) {
        if (dx < 0) handlers.onNext(); else handlers.onPrev();
      }
      if (handlers.onEnd) handlers.onEnd();
    }

    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', function () { dragging = false; if (handlers.onEnd) handlers.onEnd(); });
  }

  /* ---------------- marquee ---------------- */
  var marqueeItems = ['CAR', 'PRA', 'PRAD', 'Outorga de Água', 'PGRS', 'PGRL', 'Licenciamento Ambiental', 'CTF/IBAMA', 'Auditoria Interna', 'Capacitação de Equipes'];
  var marqueeTrack = $('#marquee-track');
  if (marqueeTrack) {
    var leafSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>';
    var doubled = marqueeItems.concat(marqueeItems);
    marqueeTrack.innerHTML = doubled.map(function (t) {
      return '<span class="marquee-item">' + leafSvg + t + '</span>';
    }).join('');
  }

  /* ---------------- height animation helper (JS-driven; CSS height transitions from an
     auto/undefined starting value are unreliable across browsers) ---------------- */
  function animateHeight(el, toPx, duration) {
    if (!el) return;
    if (el._heightRaf) cancelAnimationFrame(el._heightRaf);
    if (el._heightFallback) clearTimeout(el._heightFallback);
    var from = el.getBoundingClientRect().height;
    if (reducedMotion || Math.abs(from - toPx) < 1) { el.style.height = toPx + 'px'; return; }
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.style.height = (from + (toPx - from) * ease(p)) + 'px';
      if (p < 1) { el._heightRaf = requestAnimationFrame(step); } else { el._heightRaf = null; }
    }
    el._heightRaf = requestAnimationFrame(step);
    // safety net: if rAF is throttled/paused (backgrounded tab), still land on the
    // correct final height instead of staying stuck mid-animation.
    el._heightFallback = setTimeout(function () {
      el.style.height = toPx + 'px';
      if (el._heightRaf) { cancelAnimationFrame(el._heightRaf); el._heightRaf = null; }
    }, duration + 120);
  }

  /* ---------------- services carousel ---------------- */
  (function servicesCarousel() {
    var track = $('#svc-track');
    var viewport = $('.svc-viewport');
    var dotsWrap = $('#svc-dots');
    var prevBtn = $('#svc-prev');
    var nextBtn = $('#svc-next');
    if (!track) return;
    var slides = $$('.svc-slide', track);
    var active = 0;
    var paused = false;

    dotsWrap.innerHTML = slides.map(function (_, i) {
      return '<button aria-label="Ir para slide ' + (i + 1) + '"></button>';
    }).join('');
    var dots = $$('button', dotsWrap);

    function setHeight(instant) {
      var current = slides[active];
      if (!current || !viewport) return;
      var target = current.scrollHeight;
      if (instant) { viewport.style.height = target + 'px'; }
      else { animateHeight(viewport, target, 600); }
    }
    var initialized = false;
    function render() {
      track.style.transform = 'translateX(-' + (active * 100) + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === active); });
      setHeight(!initialized);
      initialized = true;
    }
    function go(i) { active = (i + slides.length) % slides.length; render(); }

    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
    if (prevBtn) prevBtn.addEventListener('click', function () { go(active - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(active + 1); });

    var carousel = $('#svc-carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', function () { paused = true; });
      carousel.addEventListener('mouseleave', function () { paused = false; });
    }

    enableSwipe(viewport, {
      onStart: function () { paused = true; },
      onEnd: function () { paused = false; },
      onNext: function () { go(active + 1); },
      onPrev: function () { go(active - 1); },
    });

    window.addEventListener('resize', function () { setHeight(true); });
    render();
    if (!reducedMotion) {
      setInterval(function () { if (!paused) go(active + 1); }, 6000);
    }
  })();

  /* ---------------- posts carousel (novidades) ---------------- */
  (function postsCarousel() {
    var root = $('#post-carousel');
    if (!root) return;

    var arrowLeft = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    var arrowRight = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    var igIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"></line></svg>';

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function build(posts) {
      if (!posts.length) {
        root.innerHTML = '<div class="novidades-empty">Em breve, novidades por aqui. Acompanhe <a href="https://www.instagram.com/plambientalconsultoria/" target="_blank" rel="noopener noreferrer" style="color:var(--secondary-700);font-weight:700;">@plambientalconsultoria</a> no Instagram.</div>';
        return;
      }

      var active = 0;
      var paused = false;

      root.innerHTML =
        '<div class="post-viewport"><div class="post-track" id="post-track"></div></div>' +
        '<div class="post-dots" id="post-dots"></div>';

      var track = $('#post-track', root);
      var dotsWrap = $('#post-dots', root);

      track.innerHTML = posts.map(function (p, i) {
        var linkTag = p.link
          ? '<a class="post-ig-link" href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener noreferrer" aria-label="Ver post no Instagram">' + igIcon + '</a>'
          : '';
        return (
          '<div class="post-card-shell" data-index="' + i + '">' +
            '<div class="post-card">' +
              linkTag +
              '<img src="' + escapeHtml(p.image) + '" alt="Post PL Ambiental" loading="lazy">' +
              '<button class="post-nav-btn prev" aria-label="Post anterior">' + arrowLeft + '</button>' +
              '<button class="post-nav-btn next" aria-label="Próximo post">' + arrowRight + '</button>' +
              '<div class="post-caption-overlay"><p>' + escapeHtml(p.caption) + '</p></div>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      dotsWrap.innerHTML = posts.map(function (_, i) {
        return '<button aria-label="Ir para post ' + (i + 1) + '"></button>';
      }).join('');

      var shells = $$('.post-card-shell', track);
      var dots = $$('button', dotsWrap);

      function center() {
        var viewport = $('.post-viewport', root);
        var activeShell = shells[active];
        if (!viewport || !activeShell) return;
        var offset = (viewport.clientWidth / 2) - (activeShell.offsetLeft + activeShell.offsetWidth / 2);
        track.style.transform = 'translateX(' + offset + 'px)';
      }

      function render() {
        var n = posts.length;
        shells.forEach(function (shell, i) {
          shell.classList.toggle('is-active', i === active);
          // rotate visual order so the carousel feels circular: whichever post is
          // active always sits in the middle, with its true prev/next neighbors
          // (wrapping around) placed immediately beside it — including when
          // active is the first or last post in the list.
          var rel = (i - active + n) % n;
          shell.style.order = rel > n / 2 ? rel - n : rel;
        });
        dots.forEach(function (d, i) { d.classList.toggle('is-active', i === active); });
        center();
      }

      function go(i) { active = (i + posts.length) % posts.length; render(); }

      shells.forEach(function (shell) {
        $('.prev', shell).addEventListener('click', function () { go(active - 1); });
        $('.next', shell).addEventListener('click', function () { go(active + 1); });
      });
      dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

      root.addEventListener('mouseenter', function () { paused = true; });
      root.addEventListener('mouseleave', function () { paused = false; });

      /* touch / pointer swipe */
      enableSwipe($('.post-viewport', root), {
        onStart: function () { paused = true; },
        onEnd: function () { paused = false; },
        onNext: function () { go(active + 1); },
        onPrev: function () { go(active - 1); },
      });

      window.addEventListener('resize', center);
      render();

      if (!reducedMotion && posts.length > 1) {
        setInterval(function () { if (!paused) go(active + 1); }, 5500);
      }
    }

    fetch('/api/posts')
      .then(function (r) { return r.json(); })
      .then(function (data) { build(data.posts || []); })
      .catch(function () { build([]); });
  })();

  icons();
})();
