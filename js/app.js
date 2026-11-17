// Shared UI helpers
(function () {
  const NAV = [
    { href: 'index.html', label: 'Home' },
    { href: 'projects.html', label: 'Projects' },
    { href: 'schedule.html', label: 'Schedule' },
    { href: 'judges.html', label: 'Judges' },
    { href: 'faq.html', label: 'FAQ' },
    { href: 'about.html', label: 'About' },
  ];

  function currentPage() {
    const p = location.pathname.split('/').pop() || 'index.html';
    return p;
  }

  function renderNav(container) {
    const cur = currentPage();
    const isAdmin = window.ExpoStore && window.ExpoStore.isAdminLoggedIn();
    const links = NAV.map(n => `<a class="nav-link ${n.href === cur ? 'active' : ''}" href="${n.href}">${n.label}</a>`).join('');
    const adminLink = isAdmin
      ? `<a class="nav-link" href="admin.html" style="color:var(--accent-2)">Admin</a>`
      : `<a class="nav-link" href="admin.html">Admin</a>`;
    container.innerHTML = `
      <div class="nav-inner">
        <a class="brand" href="index.html">
          <span class="brand-mark"><img src="school_logo.png" alt="School logo" /></span>
          <span>Expo<span style="color:var(--accent-2)">2026</span></span>
        </a>
        <div class="nav-links">
          ${links}
          ${adminLink}
          <a class="nav-cta" href="submit.html">Submit Project</a>
        </div>
      </div>`;
  }

  function toast(msg, type = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  function revealOnScroll() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger').forEach(el => io.observe(el));

    // Count-up numbers
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.value || el.textContent, 10);
        if (isNaN(target)) return;
        const start = performance.now();
        const dur = 1100;
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        countIo.unobserve(el);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.count-up').forEach(el => countIo.observe(el));
  }

  function initScrollLock() {
    const section = document.querySelector('.scroll-lock');
    if (!section) return;
    const lines = Array.from(section.querySelectorAll('.lock-line'));
    const caption = section.querySelector('.lock-caption');
    const bar = section.querySelector('.lock-progress span');
    const count = section.querySelector('.lock-count');
    const captions = lines.map(l => l.dataset.caption || '');
    let last = -1;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, travel)));
      const index = Math.min(lines.length - 1, Math.floor(progress * lines.length));
      if (index !== last) {
        last = index;
        lines.forEach((l, i) => l.classList.toggle('active', i === index));
        if (caption) { caption.classList.remove('show'); caption.textContent = captions[index]; setTimeout(() => caption.classList.add('show'), 80); }
        if (count) count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(lines.length).padStart(2, '0');
      }
      if (bar) bar.style.width = (progress * 100) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    if (window.expoLenis) window.expoLenis.on('scroll', update);
    update();
  }

  function initParallax() {
    const visual = document.querySelector('.hero-visual');
    if (!visual || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const update = () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      visual.style.setProperty('transform', `translateY(${y * 0.12}px)`);
    };
    window.addEventListener('scroll', update, { passive: true });
    if (window.expoLenis) window.expoLenis.on('scroll', update);
  }

  function renderFooter(container) {
    container.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand" style="margin-bottom:12px"><span class="brand-mark"><img src="school_logo.png" alt="School logo" /></span><span>Expo<span style="color:var(--accent-2)">2026</span></span></div>
            <p style="max-width:360px;line-height:1.6">The annual school exhibition — a showcase of student innovation, creativity and engineering. Built by students, for students.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <a href="index.html">Home</a>
            <a href="projects.html">Projects</a>
            <a href="schedule.html">Schedule</a>
            <a href="judges.html">Judges</a>
            <a href="faq.html">FAQ</a>
            <a href="about.html">About</a>
          </div>
          <div>
            <h4>Categories</h4>
            <a href="projects.html?cat=Robotics">Robotics</a>
            <a href="projects.html?cat=AI+%26+Machine+Learning">AI & ML</a>
            <a href="projects.html?cat=Web+Development">Web Dev</a>
            <a href="projects.html?cat=IoT+%26+Hardware">IoT</a>
          </div>
          <div>
            <h4>Admin</h4>
            <a href="admin.html">Admin Panel</a>
            <a href="submit.html">Submit Project</a>
            <a href="faq.html">Help & FAQ</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 School Exhibition. All rights reserved.</span>
          <span>Made by students</span>
        </div>
      </div>`;
  }

  function initExtras() {
    // scroll progress
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();

    // card mouse spotlight
    document.addEventListener('mousemove', e => {
      const card = e.target.closest('.project-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });

    // Lenis smooth scroll
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof window.Lenis !== 'undefined' && !reduceMotion) {
      const lenis = new window.Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.4
      });
      window.expoLenis = lenis;
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);

      document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -90 });
      });
    }

    const start = () => { revealOnScroll(); initScrollLock(); initParallax(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      setTimeout(start, 50);
    }
  }

  window.ExpoUI = { renderNav, toast, revealOnScroll, renderFooter, initExtras, initScrollLock };
  initExtras();
})();
