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

  const THEME_KEY = 'expo_theme';

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function updateThemeButtons() {
    const dark = currentTheme() === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  function applyTheme(theme) {
    const value = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = value === 'dark' ? '#171411' : '#f4f1e9';
    updateThemeButtons();
  }

  function initThemeToggle() {
    updateThemeButtons();
    document.addEventListener('click', e => {
      const btn = e.target.closest('.theme-toggle');
      if (!btn) return;
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce || typeof document.startViewTransition !== 'function') {
        try { localStorage.setItem(THEME_KEY, next); } catch (err) {}
        applyTheme(next);
        return;
      }

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      document.documentElement.classList.add('theme-ripple');

      const transition = document.startViewTransition(() => {
        try { localStorage.setItem(THEME_KEY, next); } catch (err) {}
        applyTheme(next);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              'circle(0px at ' + x + 'px ' + y + 'px)',
              'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
            ]
          },
          {
            duration: 520,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch(() => {});

      const cleanup = () => document.documentElement.classList.remove('theme-ripple');
      if (transition.finished) transition.finished.then(cleanup).catch(cleanup);
      else cleanup();
    });
  }

  function currentPage() {
    const p = location.pathname.split('/').pop() || 'index.html';
    return p;
  }

  function renderNav(container) {
    const cur = currentPage();
    const S = window.ExpoStore;
    const isAdmin = S && S.isAdminLoggedIn && S.isAdminLoggedIn();
    const isStudent = S && S.isStudentLoggedIn && S.isStudentLoggedIn();
    const student = isStudent ? S.getStudentUser() : null;

    const links = NAV.map(n => `<a class="nav-link ${n.href === cur ? 'active' : ''}" href="${n.href}">${n.label}</a>`).join('');
    const studentLinks = isStudent && student
      ? `<a class="nav-link ${cur === 'profile.html' || cur === 'my-projects.html' ? 'active' : ''}" href="profile.html">My Profile</a><a class="nav-link student-logout-btn" href="#" style="color:var(--muted)">Sign Out (${escapeHTML(student.name.split(' ')[0])})</a>`
      : `<a class="nav-link ${cur === 'student-login.html' ? 'active' : ''}" href="student-login.html">Student Sign In</a>`;

    const adminLink = `<a class="nav-link ${cur === 'admin.html' ? 'active' : ''}" href="admin.html"${isAdmin ? ' style="color:var(--accent-2)"' : ''}>Admin</a>`;
    const submitLink = `<a class="nav-cta ${cur === 'submit.html' ? 'active' : ''}" href="submit.html">Submit Project <span class="btn-arrow" aria-hidden="true">&#8594;</span></a>`;
    const theme = currentTheme();
    const themeToggle = `<button class="theme-toggle" type="button" aria-label="${theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}" aria-pressed="${theme === 'dark'}" title="${theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}">
          <svg class="theme-icon icon-moon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg>
          <svg class="theme-icon icon-sun" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
        </button>`;

    container.innerHTML = `
      <div class="nav-inner">
        <a class="brand" href="index.html">
          <span class="brand-mark"><img src="school_logo.png" alt="School logo" /></span>
          <span>Expo<span style="color:var(--accent-2)">2026</span></span>
        </a>
        <div class="nav-links">${links}${studentLinks}${adminLink}${submitLink}</div>
        ${themeToggle}
        <button class="nav-toggle" type="button" aria-label="Open navigation menu" aria-controls="mobileNav" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>`;

    const nav = container.closest('.nav') || container.parentElement;
    if (!nav) return;
    const oldBackdrop = nav.querySelector('.mobile-backdrop');
    const oldDrawer = nav.querySelector('.mobile-nav');
    if (oldBackdrop) oldBackdrop.remove();
    if (oldDrawer) oldDrawer.remove();

    nav.insertAdjacentHTML('beforeend', `
      <div class="mobile-backdrop" aria-hidden="true"></div>
      <div class="mobile-nav" id="mobileNav" hidden>
        ${NAV.map(n => `<a class="${n.href === cur ? 'active' : ''}" href="${n.href}">${n.label}</a>`).join('')}
        ${isStudent && student ? `<a class="${cur === 'my-projects.html' ? 'active' : ''}" href="my-projects.html">My Projects</a><a class="student-logout-btn" href="#">Sign Out (${escapeHTML(student.name.split(' ')[0])})</a>` : `<a class="${cur === 'student-login.html' ? 'active' : ''}" href="student-login.html">Student Sign In</a>`}
        <a class="${cur === 'admin.html' ? 'active' : ''}" href="admin.html">Admin</a>
        ${submitLink.replace('nav-cta', 'nav-cta')}
      </div>`);

    document.querySelectorAll('.student-logout-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        await S.studentLogout();
        location.reload();
      });
    });

    const toggle = nav.querySelector('.nav-toggle');
    const backdrop = nav.querySelector('.mobile-backdrop');
    const drawer = nav.querySelector('.mobile-nav');
    let closeTimer;

    const open = () => {
      clearTimeout(closeTimer);
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('open'));
      backdrop.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation menu');
      document.body.classList.add('nav-open');
      if (window.expoLenis) window.expoLenis.stop();
    };
    const close = () => {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      document.body.classList.remove('nav-open');
      if (window.expoLenis) window.expoLenis.start();
      closeTimer = setTimeout(() => { drawer.hidden = true; }, 240);
    };

    toggle.addEventListener('click', () => {
      if (toggle.getAttribute('aria-expanded') === 'true') close(); else open();
    });
    backdrop.addEventListener('click', close);
    drawer.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        close();
        toggle.focus();
      }
    });
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function categoryIcon(category) {
    const paths = {
      'Robotics': '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
      'AI & Machine Learning': '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
      'Web Development': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
      'Mobile Apps': '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
      'IoT & Hardware': '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
      'Science & Research': '<path d="M9 2h6M10 2v7l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V2"/><path d="M7 15h10"/>',
      'Art & Design': '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
      'Game Development': '<path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2l-1-1H9.2l-1 1A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4Z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".8"/><circle cx="17.5" cy="13.5" r=".8"/>',
      'Other': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[category] || paths.Other}</svg>`;
  }

  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';

  function voteButtonHTML(id, detail = false) {
    const S = window.ExpoStore;
    if (!S) return '';
    const count = S.getVoteCount ? S.getVoteCount(id) : 0;
    const voted = S.hasVoted ? S.hasVoted(id) : false;
    return `<button type="button" class="vote-btn${voted ? ' voted' : ''}${detail ? ' detail-vote' : ''}" data-vote="${escapeHTML(id)}" aria-pressed="${voted}" aria-label="${voted ? 'Remove your vote' : 'Vote for this project'}">${HEART}<span class="vote-count">${count}</span>${detail ? `<span class="vote-label">${voted ? 'Voted' : 'Vote'}</span>` : ''}</button>`;
  }

  function updateVoteButtons() {
    const S = window.ExpoStore;
    if (!S) return;
    document.querySelectorAll('[data-vote]').forEach(btn => {
      const id = btn.dataset.vote;
      const voted = Boolean(S.hasVoted && S.hasVoted(id));
      const count = S.getVoteCount ? S.getVoteCount(id) : 0;
      const detail = btn.classList.contains('detail-vote');
      btn.classList.toggle('voted', voted);
      btn.setAttribute('aria-pressed', String(voted));
      btn.setAttribute('aria-label', voted ? 'Remove your vote' : 'Vote for this project');
      btn.innerHTML = `${HEART}<span class="vote-count">${count}</span>${detail ? `<span class="vote-label">${voted ? 'Voted' : 'Vote'}</span>` : ''}`;
    });
  }

  function projectCardHTML(p, index, options = {}) {
    const S = window.ExpoStore;
    const id = escapeHTML(p.id);
    const title = escapeHTML(p.title || 'Untitled project');
    const category = escapeHTML(p.category || 'Other');
    const status = p.status || 'pending';
    const badgeClass = p.preview ? 'status-preview' : `status-${escapeHTML(status)}`;
    const badgeLabel = p.preview ? 'Sample' : escapeHTML(status);
    const image = p.imageUrl
      ? `<img class="${/\.svg(\?|$)/i.test(p.imageUrl) ? 'svg-art' : ''}" src="${escapeHTML(p.imageUrl)}" alt="${title}" loading="lazy">`
      : `<div class="img-fallback">${categoryIcon(p.category)}</div>`;
    const rank = options.rank ? `<span class="rank-mark" aria-hidden="true">${String(options.rank).padStart(2, '0')}</span>` : '';
    const vote = options.vote === false ? '' : voteButtonHTML(p.id);
    return `
      <article class="project-card reveal">
        <a class="card-link" href="project.html?id=${id}${p.preview ? '&preview=1' : ''}">
          <div class="project-thumb">
            ${image}
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            <span class="card-no" aria-hidden="true">${String(index || 1).padStart(2, '0')}</span>
            ${rank}
          </div>
          <div class="project-body">
            <div class="project-cat">${category}</div>
            <div class="project-title">${title}</div>
            <div class="project-desc">${escapeHTML((p.description || '').slice(0, 170))}</div>
            <div class="project-meta">
              <div class="project-author"><span class="avatar">${escapeHTML(S && S.initials ? S.initials(p.studentName) : '?')}</span>${escapeHTML(p.studentName || 'Student')}</div>
              <div style="color:var(--muted);font-size:12px">${escapeHTML(p.grade || '')}</div>
            </div>
            <div class="card-cta"><span>View project</span><svg class="arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
          </div>
        </a>
        ${vote}
      </article>`;
  }

  function initVoting() {
    const S = window.ExpoStore;
    if (!S) return;
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-vote]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      try {
        await S.toggleVote(btn.dataset.vote);
        updateVoteButtons();
      } catch (err) {
        console.warn('Vote update failed:', err);
        toast('Your vote could not be updated.', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    S.ready().then(() => {
      updateVoteButtons();
      if (S.subscribeVotes) S.subscribeVotes(updateVoteButtons);
      if (S.subscribeProjects) S.subscribeProjects(() => setTimeout(updateVoteButtons, 0));
    });
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
            <h2>Explore</h2>
            <a href="index.html">Home</a>
            <a href="projects.html">Projects</a>
            <a href="schedule.html">Schedule</a>
            <a href="judges.html">Judges</a>
            <a href="faq.html">FAQ</a>
            <a href="about.html">About</a>
          </div>
          <div>
            <h2>Categories</h2>
            <a href="projects.html?cat=Robotics">Robotics</a>
            <a href="projects.html?cat=AI+%26+Machine+Learning">AI & ML</a>
            <a href="projects.html?cat=Web+Development">Web Dev</a>
            <a href="projects.html?cat=IoT+%26+Hardware">IoT</a>
          </div>
          <div>
            <h2>Admin</h2>
            <a href="admin.html">Admin Panel</a>
            <a href="submit.html">Submit Project</a>
            <a href="faq.html">Help & FAQ</a>
            <a href="privacy.html">Privacy Policy</a>
          </div>
        </div>
        <div class="footer-wordmark" aria-hidden="true">Expo<span>2026</span></div>
        <div class="footer-bottom">
          <span>© 2026 School Exhibition. All rights reserved.</span>
          <span>Made by students</span>
        </div>
      </div>`;
  }

  function initPointerRefinements() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.matchMedia('(pointer: coarse)').matches) return;

    const clear = (el, props) => props.forEach(p => el.style.removeProperty(p));

    document.addEventListener('pointermove', e => {
      const hero = e.target.closest('.hero');
      if (hero) {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--hero-px', (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
        hero.style.setProperty('--hero-py', (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
      }

      const surface = e.target.closest('.project-card, .cat-card');
      if (surface) {
        const r = surface.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        surface.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        surface.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        if (surface.classList.contains('project-card')) {
          surface.style.setProperty('--rx', ((0.5 - y) * 3.2).toFixed(2) + 'deg');
          surface.style.setProperty('--ry', ((x - 0.5) * 3.2).toFixed(2) + 'deg');
        }
      }

      const control = e.target.closest('.btn, .nav-cta, .filter-chip, .vote-btn, .back-to-top');
      if (control) {
        const r = control.getBoundingClientRect();
        control.style.setProperty('--mag-x', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(1) + 'px');
        control.style.setProperty('--mag-y', (((e.clientY - r.top) / r.height - 0.5) * 5).toFixed(1) + 'px');
      }
    });

    document.addEventListener('pointerout', e => {
      const hero = e.target.closest('.hero');
      if (hero && !hero.contains(e.relatedTarget)) clear(hero, ['--hero-px', '--hero-py']);

      const surface = e.target.closest('.project-card, .cat-card');
      if (surface && !surface.contains(e.relatedTarget)) clear(surface, ['--mx', '--my', '--rx', '--ry']);

      const control = e.target.closest('.btn, .nav-cta, .filter-chip, .vote-btn, .back-to-top');
      if (control && !control.contains(e.relatedTarget)) clear(control, ['--mag-x', '--mag-y']);
    });
  }

  function initBackToTop() {
    if (document.querySelector('.back-to-top')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.setAttribute('aria-label', 'Back to top');
    button.title = 'Back to top';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(button);

    const update = () => button.classList.toggle('visible', window.scrollY > 420);
    window.addEventListener('scroll', update, { passive: true });
    if (window.expoLenis) window.expoLenis.on('scroll', update);
    update();

    button.addEventListener('click', () => {
      if (window.expoLenis) window.expoLenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  // Preview mode is opt-in via ?preview=1 and never writes sample data.
  function ensurePreviewBanner() {
    const S = window.ExpoStore;
    if (!S || !S.previewMode || document.querySelector('.preview-banner')) return;
    const nav = document.querySelector('.nav');
    if (!nav || !nav.parentNode) return;
    const banner = document.createElement('div');
    banner.className = 'preview-banner';
    const cleanPath = location.pathname.split('?')[0];
    banner.innerHTML = `<div class="container"><p><strong>Preview mode</strong> — Sample exhibits are shown below. Nothing here is saved to the live exhibition.</p><a href="${cleanPath}">Exit preview</a></div>`;
    nav.parentNode.insertBefore(banner, nav.nextSibling);
  }

  function initCountdown() {
    const targets = {
      deadline: new Date('2026-11-30T23:59:59').getTime(),
      expo: new Date('2026-12-12T09:00:00').getTime()
    };
    const format = (ms) => {
      if (ms <= 0) return null;
      const total = Math.floor(ms / 1000);
      return {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60
      };
    };
    const update = () => {
      document.querySelectorAll('[data-countdown]').forEach(el => {
        const key = el.dataset.countdown;
        const t = format(targets[key] - Date.now());
        if (!t) {
          el.textContent = key === 'deadline' ? 'Submissions are closed' : 'Exhibition day is here';
          return;
        }
        el.innerHTML = `<b>${t.days}</b><span>d</span> <b>${t.hours}</b><span>h</span> <b>${t.minutes}</b><span>m</span> <b>${t.seconds}</b><span>s</span>`;
      });
    };
    update();
    setInterval(update, 1000);
  }

  function initCampaignCounters() {
    const S = window.ExpoStore;
    if (!S || !document.querySelector('[data-campaign-count]')) return;
    const update = () => {
      const total = S.stats().total;
      document.querySelectorAll('[data-campaign-count]').forEach(el => { el.textContent = String(total); });
    };
    S.ready().then(() => {
      update();
      if (S.subscribeProjects) S.subscribeProjects(update);
    });
  }

  // Wrap page content in a single <main> landmark for assistive technology.
  function ensureMainLandmark() {
    if (document.querySelector('main')) return;
    const nav = document.querySelector('.nav');
    const footer = document.querySelector('footer.footer, #footer');
    if (!nav || !footer || !nav.parentNode) return;
    const main = document.createElement('main');
    let node = nav.nextSibling;
    while (node && node !== footer) {
      const next = node.nextSibling;
      main.appendChild(node);
      node = next;
    }
    nav.parentNode.insertBefore(main, footer);
  }

  function initExtras() {
    ensurePreviewBanner();
    ensureMainLandmark();
    initCountdown();
    initCampaignCounters();
    initThemeToggle();
    initVoting();

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

    // navigation gains a hairline shadow once the page moves
    const nav = document.querySelector('.nav');
    if (nav) {
      const navUpdate = () => nav.classList.toggle('scrolled', window.scrollY > 12);
      window.addEventListener('scroll', navUpdate, { passive: true });
      if (window.expoLenis) window.expoLenis.on('scroll', navUpdate);
      navUpdate();
    }

    // pointer-driven depth, spotlight and magnetic controls
    initPointerRefinements();
    initBackToTop();

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

  window.ExpoUI = {
    renderNav, toast, revealOnScroll, renderFooter, initExtras, initScrollLock,
    escapeHTML, categoryIcon, projectCardHTML, voteButtonHTML, updateVoteButtons
  };
  initExtras();
})();
