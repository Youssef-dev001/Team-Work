(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* reveal on scroll */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* sticky pill state */
  const bar = document.querySelector('.topbar');
  const onScroll = () => bar.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* word-by-word statement */
  const st = document.querySelector('[data-words]');
  if (st) {
    st.innerHTML = st.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    const words = [...st.querySelectorAll('.w')];
    const paint = () => {
      const r = st.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', reduce || i < n));
    };
    addEventListener('scroll', paint, { passive: true }); addEventListener('resize', paint); paint();
  }

  /* card spotlight */
  document.querySelectorAll('.card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* gentle tilt on the hero window */
  const win = document.getElementById('tilt');
  if (win && !reduce && matchMedia('(hover:hover) and (min-width:981px)').matches) {
    const stage = win.parentElement;
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      win.style.transform = `rotateY(${-9 + x * 8}deg) rotateX(${4 - y * 7}deg)`;
    });
    stage.addEventListener('pointerleave', () => win.style.transform = '');
  }
})();
