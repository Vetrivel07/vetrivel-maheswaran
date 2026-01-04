// --- Typed line (no library) ---
const typedEl = document.getElementById('typed');
const phrases = [
  'RAG pipelines that cite sources',
  'Hybrid retrieval (FAISS + Neo4j)',
  'evaluation-driven LLM apps',
  'agentic workflows with guardrails'
];

if (typedEl) {
  let pi = 0, ci = 0, deleting = false;

  function typeLoop(){
    const current = phrases[pi];
    if (!deleting) {
      typedEl.textContent = current.slice(0, ci++);
      if (ci > current.length + 10) deleting = true;
    } else {
      typedEl.textContent = current.slice(0, ci--);
      if (ci <= 0) { deleting = false; pi = (pi + 1) % phrases.length; }
    }
    const speed = deleting ? 35 : 55;
    setTimeout(typeLoop, speed);
  }
  typeLoop();
}

// --- Scroll reveal ---
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('show'); });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// --- Cursor glow ---
const glow = document.getElementById('cursorGlow');
window.addEventListener('mousemove', (e) => {
  if (!glow) return;
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
});

// --- Starfield canvas ---
const canvas = document.getElementById('starfield');
const ctx = canvas?.getContext('2d');
let w, h, stars;

function resize(){
  if (!canvas) return;
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  const count = Math.min(200, Math.floor((w*h)/16000));
  stars = Array.from({length: count}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: Math.random()*1.2 + 0.2,
    s: Math.random()*0.25 + 0.05,
    a: Math.random()*0.45 + 0.15
  }));
}

window.addEventListener('resize', resize);
resize();

function tick(){
  if (!canvas || !ctx) return;
  ctx.clearRect(0,0,w,h);
  for (const st of stars) {
    st.y += st.s;
    if (st.y > h + 10) { st.y = -10; st.x = Math.random()*w; }
    ctx.globalAlpha = st.a;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(tick);
}
tick();

// --- 0/1 smoky effect canvas ---
const bcan = document.getElementById('binarySmoke');
const bctx = bcan?.getContext('2d');
let bw, bh, bits;

function bResize(){
  if (!bcan) return;
  bw = bcan.width = window.innerWidth;
  bh = bcan.height = window.innerHeight;
  const count = Math.min(260, Math.floor((bw*bh)/9000));
  bits = Array.from({length: count}, () => ({
    x: Math.random()*bw,
    y: Math.random()*bh,
    vy: Math.random()*0.35 + 0.12,
    vx: (Math.random()-0.5)*0.25,
    s: Math.random()*14 + 10,
    a: Math.random()*0.22 + 0.06,
    ch: Math.random() > 0.5 ? '1' : '0',
    wob: Math.random()*1000
  }));
}

window.addEventListener('resize', bResize);
bResize();

function bTick(){
  if (!bcan || !bctx) return;

  bctx.clearRect(0,0,bw,bh);

  // smoky fade overlay
  bctx.globalCompositeOperation = 'source-over';
  bctx.fillStyle = 'rgba(0,0,0,0.08)';
  bctx.fillRect(0,0,bw,bh);

  // draw bits
  bctx.globalCompositeOperation = 'lighter';
  for (const p of bits) {
    p.wob += 0.008;
    p.y -= p.vy;
    p.x += p.vx + Math.sin(p.wob) * 0.18;

    // recycle
    if (p.y < -30) {
      p.y = bh + 30;
      p.x = Math.random()*bw;
      p.ch = Math.random() > 0.5 ? '1' : '0';
    }
    if (p.x < -30) p.x = bw + 30;
    if (p.x > bw + 30) p.x = -30;

    bctx.font = `${Math.floor(p.s)}px Outfit, sans-serif`;
    bctx.globalAlpha = p.a;
    bctx.fillStyle = 'rgba(0,229,255,0.9)';
    bctx.fillText(p.ch, p.x, p.y);

    bctx.globalAlpha = p.a * 0.55;
    bctx.fillStyle = 'rgba(138,43,226,0.55)';
    bctx.fillText(p.ch, p.x + 1, p.y + 10);
  }
  bctx.globalAlpha = 1;
  requestAnimationFrame(bTick);
}
requestAnimationFrame(bTick);

// Navbar mobile layout

(() => {
  const btn = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  // close after clicking a link (mobile)
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  // close if tap outside
  document.addEventListener('click', (e) => {
    if (!links.classList.contains('open')) return;
    if (links.contains(e.target) || btn.contains(e.target)) return;
    links.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
})();


// --- Tilt cards (lightweight) ---
function tiltMove(card, e){
  const r = card.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const rx = ((y / r.height) - 0.5) * -8;
  const ry = ((x / r.width) - 0.5) * 10;
  card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
  card.style.setProperty('--mx', (x / r.width) * 100 + '%');
  card.style.setProperty('--my', (y / r.height) * 100 + '%');
}

function tiltReset(card){
  card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)';
  card.style.setProperty('--mx', '50%');
  card.style.setProperty('--my', '50%');
}

document.querySelectorAll('[data-tilt]').forEach(card => {
  card.addEventListener('mousemove', (e) => tiltMove(card, e));
  card.addEventListener('mouseleave', () => tiltReset(card));
});

// Education pop-up
(() => {
  const btn = document.getElementById('EducationStat');
  const overlay = document.getElementById('educOverlay');
  const modal = document.getElementById('educModal');
  const close = document.getElementById('educClose');

  if (!btn || !overlay || !modal || !close) return;

  const open = () => {
    overlay.classList.add('open');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const shut = () => {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  btn.style.cursor = 'pointer';
  btn.addEventListener('click', open);
  overlay.addEventListener('click', shut);
  close.addEventListener('click', shut);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut();
  });
})();

// Achievments pop-up
(() => {
  const btn = document.getElementById('achievementsStat');
  const overlay = document.getElementById('achOverlay');
  const modal = document.getElementById('achModal');
  const close = document.getElementById('achClose');

  if (!btn || !overlay || !modal || !close) return;

  const open = () => {
    overlay.classList.add('open');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const shut = () => {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  btn.style.cursor = 'pointer';
  btn.addEventListener('click', open);
  overlay.addEventListener('click', shut);
  close.addEventListener('click', shut);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut();
  });
})();

// certifications pop-up
(() => {
  const btn = document.getElementById('certificationStat');
  const overlay = document.getElementById('cerOverlay');
  const modal = document.getElementById('cerModal');
  const close = document.getElementById('cerClose');

  if (!btn || !overlay || !modal || !close) return;

  const open = () => {
    overlay.classList.add('open');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const shut = () => {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  btn.style.cursor = 'pointer';
  btn.addEventListener('click', open);
  overlay.addEventListener('click', shut);
  close.addEventListener('click', shut);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut();
  });
})();


// Hide scroll arrows once About is out of view
(() => {
  const about = document.querySelector('#about');
  const indicator = document.querySelector('.scroll-indicator');
  if (!about || !indicator) return;

  const obs = new IntersectionObserver(
    ([entry]) => {
      indicator.style.opacity = entry.isIntersecting ? '1' : '0';
      indicator.style.pointerEvents = entry.isIntersecting ? 'auto' : 'none';
    },
    { threshold: 0.3 }
  );

  obs.observe(about);
})();

// project pop-up poster cards

(() => {
  const cards = document.querySelectorAll(".project-card");
  const overlay = document.getElementById("projOverlay");
  const modal = document.getElementById("projModal");
  const closeBtn = document.getElementById("projClose");
  
  if (!cards.length || !overlay || !modal || !closeBtn) return;
  
  const pImg = document.getElementById("pImg");
  const pPillL = document.getElementById("pPillL");
  const pPillR = document.getElementById("pPillR");
  const pTitle = document.getElementById("pTitle");
  const pShort = document.getElementById("pShort");
  const pMetricStrong = document.getElementById("pMetricStrong");
  const pMetricText = document.getElementById("pMetricText");

  const pDesc = document.getElementById("pDesc");
  const pTags = document.getElementById("pTags");
  const pTech = document.getElementById("pTech");
  const pGithub = document.getElementById("pGithub");
  // const pLivedemo = document.getElementById("pLivedemo");


  const splitCSV = (s) =>
    s.split(",").map(v => v.trim()).filter(Boolean);

  const splitPipes = (s) =>
    s.split("|").map(v => v.trim()).filter(Boolean);

  function openModal() {
    overlay.classList.add("open");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    overlay.classList.remove("open");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  
  cards.forEach(card => {
    card.addEventListener("click", () => {
      /* LEFT CARD */
      pImg.style.backgroundImage = `url('${card.dataset.img}')`;
      pPillL.textContent = card.dataset.pillLeft;
      pPillR.textContent = card.dataset.pillRight;
      pTitle.textContent = card.dataset.title;
      pShort.textContent = card.dataset.short;
      pMetricStrong.textContent = card.dataset.metricStrong;
      pMetricText.textContent = card.dataset.metricText;

      /* DESCRIPTION */
      pDesc.textContent = card.dataset.desc;

      /* TAGS */
      pTags.innerHTML = "";
      splitCSV(card.dataset.tags).forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = tag;
        pTags.appendChild(pill);
      });

      /* TECH STACK (SINGLE BOX, LINE BY LINE) */
      pTech.innerHTML = "";
      splitPipes(card.dataset.tech).forEach(line => {
        const [key, ...rest] = line.split(":");
        const value = rest.join(":").trim();

        const row = document.createElement("div");
        row.className = "pTechRow";
        row.innerHTML = `
          <strong>${key.trim()}:</strong>
          <span>${value}</span>
        `;
        pTech.appendChild(row);
      });

      /* GITHUB */
      pGithub.href = card.dataset.github;
      pGithub.textContent = "Open repository";
    
      openModal();
    });
  });

  overlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });
})();

(() => {
  const catEl = document.getElementById("projCat");
  const rxEl  = document.getElementById("projRx");
  const cards = Array.from(document.querySelectorAll(".project-card"));

  if (!catEl || !rxEl || !cards.length) return;
  
  const norm = (s) => (s || "").toLowerCase().trim();

  function apply(){
    const cat = norm(catEl.value);
    const raw = rxEl.value.trim();

    // build regex if provided
    let re = null;
    rxEl.classList.remove("rxBad");
    if (raw) {
      try { re = new RegExp(raw, "i"); }
      catch { rxEl.classList.add("rxBad"); re = null; }
    }

    cards.forEach(card => {
      // category uses your existing data-pill-left: "Personal"/"Academic"
      const cardCat = norm(card.dataset.pillLeft); // academic/personal
      const okCat = (cat === "all") || (cardCat === cat);

      const hay = [
        card.dataset.title,
        card.dataset.short,
        card.dataset.desc,
        card.dataset.tags,
        card.dataset.pillLeft,
        card.dataset.pillRight
      ].join(" ");

      const okRx = !raw ? true : (re ? re.test(hay) : true);

      card.style.display = (okCat && okRx) ? "" : "none";
    });
  }

  catEl.addEventListener("change", apply);
  rxEl.addEventListener("input", apply);
  apply();
})();
