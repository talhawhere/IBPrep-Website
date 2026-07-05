/* ============================================================
   IB Prep — shared behavior for resource pages
   - chrome: icons, mobile menu, scroll reveals
   - buildDocGrid(): paper-style card grid (Past / Mock / Grade)
   - buildCourseList(): course -> topic accordion (Q-Banks / Study Guides)
   - filters: subject chips + level segmented + search
   Swap the placeholder "#" links in each page's data arrays for real
   file URLs when your PDFs are ready.
   ============================================================ */

/* ---------- chrome ---------- */
function initChrome(){
  if(window.lucide) lucide.createIcons();

  const burger = document.getElementById('burger');
  const mm = document.getElementById('mobileMenu');
  if(burger && mm){
    let open = false;
    const set = s => {
      open = s; mm.classList.toggle('open', s);
      burger.innerHTML = s ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
      if(window.lucide) lucide.createIcons();
    };
    burger.addEventListener('click', () => set(!open));
    mm.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  }

  const els = document.querySelectorAll('[data-reveal]');
  const inView = () => els.forEach(el => {
    const r = el.getBoundingClientRect();
    if(r.top < (window.innerHeight || 800) * 0.94 && r.bottom > 0) el.classList.add('in');
  });
  requestAnimationFrame(inView);
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {rootMargin:'0px 0px -8% 0px', threshold:0.1});
    els.forEach(el => io.observe(el));
  } else {
    els.forEach(el => el.classList.add('in'));
  }
}

/* ---------- tutors: draggable auto-drift carousel ----------
   Clones the card set once for a gapless loop, sizes cards so exactly
   N fit the viewport (4 desktop → 1 mobile), gently drifts right→left,
   pauses on hover, and can be dragged/swiped or stepped with the
   prev/next buttons. Speed is a fixed px/sec so it feels the same at
   any tutor count. */
function initTutorCarousel(){
  document.querySelectorAll('.tutor-carousel').forEach(car => {
    const track = car.querySelector('.tutor-track');
    if(!track || track.dataset.cloned) return;
    const originals = [...track.children];
    const count = originals.length;
    if(!count) return;
    originals.forEach(node => {
      const c = node.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.removeAttribute('data-reveal');
      c.classList.add('in');
      track.appendChild(c);
    });
    track.dataset.cloned = '1';

    // wrap so the nav buttons sit OUTSIDE the masked/clipped viewport
    const wrap = document.createElement('div');
    wrap.className = 'tutor-carousel-wrap';
    car.parentNode.insertBefore(wrap, car);
    wrap.appendChild(car);
    const mkBtn = (dir, icon, label) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tutor-nav ' + dir;
      b.setAttribute('aria-label', label);
      b.innerHTML = '<i data-lucide="' + icon + '"></i>';
      wrap.appendChild(b); return b;
    };
    const prevBtn = mkBtn('prev', 'chevron-left', 'Previous tutors');
    const nextBtn = mkBtn('next', 'chevron-right', 'Next tutors');

    const GAP = 20;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let cardW = 0, step = 0, setW = 0;
    const size = () => {
      const w = car.clientWidth;
      let n = 4;
      if(w <= 440) n = 1; else if(w <= 760) n = 2; else if(w <= 980) n = 3;
      cardW = (w - (n - 1) * GAP) / n;
      step = cardW + GAP; setW = count * step;
      track.style.setProperty('--card-w', cardW + 'px');
    };
    // clientWidth can be 0 when this runs at end-of-body before layout settles;
    // retry on the next frame until it resolves, then keep it in sync on resize/load.
    const ensureSize = () => { if(car.clientWidth === 0){ requestAnimationFrame(ensureSize); return; } size(); };
    ensureSize();
    window.addEventListener('resize', size, {passive:true});
    window.addEventListener('load', size);

    let pos = 0;                    // current translateX (drifts negative)
    const DRIFT = reduce ? 0 : 24;  // px per second — gentle
    let paused = false, dragging = false, startX = 0, startPos = 0, moved = false;
    let target = null, tweenFrom = 0, tweenStart = 0; const TWEEN = 520;

    const norm = p => { if(setW > 0){ while(p <= -setW) p += setW; while(p > 0) p -= setW; } return p; };
    const apply = () => { track.style.transform = 'translate3d(' + pos + 'px,0,0)'; };

    let last = performance.now();
    function frame(now){
      const dt = Math.min(now - last, 50) / 1000; last = now;
      if(target !== null){
        const t = Math.min((now - tweenStart) / TWEEN, 1);
        const e = t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; // easeInOutQuad
        pos = tweenFrom + (target - tweenFrom) * e;
        if(t >= 1){ pos = target; target = null; }
      } else if(!paused && !dragging){
        pos -= DRIFT * dt;
      }
      pos = norm(pos); apply();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const nudge = d => { tweenFrom = pos; target = pos - d * step; tweenStart = performance.now(); };
    nextBtn.addEventListener('click', () => nudge(1));
    prevBtn.addEventListener('click', () => nudge(-1));

    car.addEventListener('pointerenter', () => { paused = true; });
    car.addEventListener('pointerleave', () => { paused = false; });

    // drag / swipe
    track.addEventListener('pointerdown', e => {
      dragging = true; moved = false; target = null;
      startX = e.clientX; startPos = pos;
      track.classList.add('dragging');
      try { track.setPointerCapture(e.pointerId); } catch(_){}
    });
    track.addEventListener('pointermove', e => {
      if(!dragging) return;
      const dx = e.clientX - startX;
      if(Math.abs(dx) > 4) moved = true;
      pos = startPos + dx;
    });
    const endDrag = e => {
      if(!dragging) return;
      dragging = false; track.classList.remove('dragging');
      try { track.releasePointerCapture(e.pointerId); } catch(_){}
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    // swallow the click that follows a drag so it doesn't feel twitchy
    track.addEventListener('click', e => { if(moved){ e.preventDefault(); e.stopPropagation(); } }, true);

    if(window.lucide) lucide.createIcons();
  });
}

/* ---------- helpers ---------- */
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* Single combined button — same link previews AND downloads (Mega). */
function actionButtons(link){
  return `<div class="rdoc-actions">
      <a class="rbtn solid" href="${esc(link||'#')}" target="_blank" rel="noopener"><i data-lucide="download"></i> Preview &amp; Download</a>
    </div>`;
}

/* ---------- paper-style document grid ----------
   opts = {
     mountId, icon, subjects:[...], levels:[...]|null,
     editions:[{title, sub?}],            // sessions or mocks
     links(subject, level, edition) -> {preview, download}  (optional)
   }
   Produces one card per subject x level x edition.
*/
function buildDocGrid(opts){
  const mount = document.getElementById(opts.mountId);
  const levels = opts.levels && opts.levels.length ? opts.levels : [null];
  let i = 0, html = '';
  opts.subjects.forEach(sub => {
    levels.forEach(lvl => {
      opts.editions.forEach(ed => {
        const d = (typeof ed === 'string') ? {title:ed} : ed;
        const lk = opts.links ? opts.links(sub, lvl, d) : {};
        const link = lk.link || lk.download || lk.preview;
        const delay = Math.min(i, 11) * 0.04;
        html += `<div class="rdoc" data-reveal style="--d:${delay}s" data-subject="${esc(sub)}"${lvl?` data-level="${esc(lvl)}"`:''}>
          <div class="rdoc-top">
            <div class="rdoc-ic"><i data-lucide="${esc(opts.icon||'file-text')}"></i></div>
            ${lvl?`<span class="lvl lvl-${esc(lvl)}">${esc(lvl)}</span>`:''}
          </div>
          <div class="rdoc-subject">${esc(sub)}</div>
          <div class="rdoc-title">${esc(d.title)}</div>
          ${d.sub?`<div class="rdoc-meta">${esc(d.sub)}</div>`:''}
          ${actionButtons(link)}
        </div>`;
        i++;
      });
    });
  });
  mount.innerHTML = html + `<div class="empty" hidden><i data-lucide="search-x"></i>No documents match your filters.</div>`;
  if(window.lucide) lucide.createIcons();
}

/* ---------- paper grid (Past Papers) ----------
   opts = {
     mountId, icon,
     entries: [{
       subject,            // IB group, used for the Subject filter
       course,             // course name shown on the card (e.g. "Business Management")
       year, session,      // e.g. 2020, "November"
       papers: [{ title, level, link }]   // level: "HL" | "SL" | "HL & SL"
     }]
   }
   One card per individual paper. Same link previews + downloads.
*/
function buildPaperGrid(opts){
  const mount = document.getElementById(opts.mountId);
  if(!mount) return;
  let i = 0, html = '';
  (opts.entries||[]).forEach(en => {
    (en.papers||[]).forEach(p => {
      const lvl = p.level || '';
      const lvlClass = lvl === 'HL' ? 'lvl-HL' : lvl === 'SL' ? 'lvl-SL' : 'lvl-both';
      const delay = Math.min(i, 11) * 0.04;
      html += `<div class="rdoc" data-reveal style="--d:${delay}s" data-subject="${esc(en.subject)}" data-level="${esc(lvl)}" data-year="${esc(en.year)}">
        <div class="rdoc-top">
          <div class="rdoc-ic"><i data-lucide="${esc(opts.icon||'file-text')}"></i></div>
          ${lvl?`<span class="lvl ${lvlClass}">${esc(lvl)}</span>`:''}
        </div>
        <div class="rdoc-subject">${esc(en.course)}</div>
        <div class="rdoc-title">${esc(p.title)}</div>
        <div class="rdoc-meta">${esc(en.session)} ${esc(en.year)}</div>
        ${actionButtons(p.link)}
      </div>`;
      i++;
    });
  });
  mount.innerHTML = html + `<div class="empty" hidden><i data-lucide="search-x"></i>No documents match your filters.</div>`;
  if(window.lucide) lucide.createIcons();
}

/* ---------- course -> topic accordion ----------
   opts = {
     mountId, icon, courses:[{name, topics:[{name, preview?, download?}]}]
   }
*/
function buildCourseList(opts){
  const mount = document.getElementById(opts.mountId);
  let html = '';
  opts.courses.forEach((c, i) => {
    const delay = Math.min(i, 8) * 0.05;
    const topics = c.topics.map((t, ti) => `<div class="topic">
        <span class="topic-num">${String(ti+1).padStart(2,'0')}</span>
        <div class="topic-name">${esc(t.name)}</div>
        <div class="topic-actions">
          <a class="rbtn solid" href="${esc(t.link||t.download||t.preview||'#')}" target="_blank" rel="noopener"><i data-lucide="download"></i> Preview &amp; Download</a>
        </div>
      </div>`).join('');
    html += `<div class="course" data-reveal style="--d:${delay}s" data-subject="${esc(c.name)}">
        <button class="course-head" type="button">
          <span class="course-ic"><i data-lucide="${esc(opts.icon||'layers')}"></i></span>
          <span><span class="course-name">${esc(c.name)}</span>${c.sub?`<span class="course-sub">${esc(c.sub)}</span>`:''}</span>
          <span class="course-meta">${c.topics.length} topics <i data-lucide="chevron-down" class="chev"></i></span>
        </button>
        <div class="course-body"><div class="course-body-in"><div class="course-body-pad">${topics}</div></div></div>
      </div>`;
  });
  mount.innerHTML = html + `<div class="empty" hidden><i data-lucide="search-x"></i>No courses match your search.</div>`;
  if(window.lucide) lucide.createIcons();

  mount.querySelectorAll('.course-head').forEach(h => {
    h.addEventListener('click', () => h.closest('.course').classList.toggle('open'));
  });
}

/* ---------- filtering ---------- */
function initFilters(){
  const state = {subject:'all', level:'all', year:'all', q:''};
  const countEl = document.querySelector('[data-count]');

  function apply(){
    const items = document.querySelectorAll('[data-subject]');
    let shown = 0;
    items.forEach(el => {
      const subj = (el.dataset.subject||'').toLowerCase();
      const lvl = (el.dataset.level||'').toLowerCase();
      const yr = (el.dataset.year||'').toLowerCase();
      const okSubj = state.subject === 'all' || subj === state.subject;
      const okLvl = state.level === 'all' || !el.dataset.level || lvl.includes(state.level);
      const okYear = state.year === 'all' || !el.dataset.year || yr === state.year;
      const okQ = !state.q || subj.includes(state.q);
      const show = okSubj && okLvl && okYear && okQ;
      el.hidden = !show;
      if(show) shown++;
    });
    document.querySelectorAll('.empty').forEach(e => e.hidden = shown !== 0);
    if(countEl) countEl.innerHTML = `<b>${shown}</b> ${countEl.dataset.count || 'items'}`;
  }

  document.querySelectorAll('[data-filter="subject"] .chip-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-filter="subject"] .chip-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.subject = (b.dataset.value || 'all').toLowerCase();
      apply();
    });
  });
  document.querySelectorAll('[data-filter="level"] button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-filter="level"] button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.level = (b.dataset.value || 'all').toLowerCase();
      apply();
    });
  });
  document.querySelectorAll('[data-filter="year"] .chip-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-filter="year"] .chip-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.year = (b.dataset.value || 'all').toLowerCase();
      apply();
    });
  });
  const search = document.querySelector('[data-search]');
  if(search) search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); apply(); });

  // initialize state from whichever chip/segment is marked active in the markup
  const aSubj = document.querySelector('[data-filter="subject"] .chip-btn.active');
  if(aSubj) state.subject = (aSubj.dataset.value || 'all').toLowerCase();
  const aLvl = document.querySelector('[data-filter="level"] button.active');
  if(aLvl) state.level = (aLvl.dataset.value || 'all').toLowerCase();
  const aYear = document.querySelector('[data-filter="year"] .chip-btn.active');
  if(aYear) state.year = (aYear.dataset.value || 'all').toLowerCase();

  apply();
}
