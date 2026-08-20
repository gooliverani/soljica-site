/* THE HOME PAGE'S HERO SEQUENCE (D3, 2026-08-16). goolio's own brief, 2026-08-15:
   "Š goes to the O in Šoljica and fades. At the same time the letters 'Specialty coffee
   and tea bar' appear like someone writing them with an invisible pencil, and it goes to
   the left up corner as site logo."

   THREE PHASES, AND THIS FILE OWNS LESS OF THEM THAN YOU WOULD EXPECT:
     1  DOCK      the Š-coin travels and scales until its traced ring sits exactly on the
                  logotype's o, ring to ring, and clears before the dock completes so that
                  only the ring hands over. CSS, not script: this file measures the geometry
                  ONCE and hands it over as three custom properties.
     2  WRITE     the strapline arrives letter by letter under a mask sweep on a steps(24)
                  function. Pure CSS, nothing of it here.
     3  FLY       the whole lockup shrinks and travels into the masthead's mark on scroll,
                  then hands over to the static copy already sitting there. ALSO CSS, on a
                  scroll timeline, with the path measured here and handed over as generated
                  keyframes. See the next block for why it stopped being a scroll handler.

   PHASE 3 WAS A requestAnimationFrame SCRUB UNTIL 2026-08-16 AND IT VISIBLY JUMPED.
   goolio, on watching it: "when scrolling logo at the end jumps few times before settle on
   top left side." The geometry was never wrong. Measured against the masthead the travel was
   monotonic and the handover landed on the nav slot's box to the hundredth of a pixel. The
   fault was the mechanism: a page scrolls on the COMPOSITOR and a scroll handler runs on the
   MAIN THREAD, so any frame the compositor presents before the handler has run paints the
   mark at its previous transform.

   That is harmless early in the travel and ruinous at the end, which is exactly what he saw.
   Past about 55% of the track the transform is doing 1:1 compensation, holding the mark still
   against a page moving underneath it, so a late frame does not show the mark slightly behind:
   it shows it falling the WHOLE scroll delta and snapping back. Measured on this box before
   the change, by stepping the scroll without letting the handler run:

       at 30% of the travel   40px of scroll  ->  12.4px of snap
       at 55%                 40px            ->  40.0px
       at 80%                 40px            ->  44.2px
       at 95%                 80px            ->  82.3px

   The handler cost 0.11ms, so there was nothing to optimise. A scroll-linked transform cannot
   be made reliable by making it cheaper; it has to stop being scroll-linked JavaScript. So the
   path is now sampled into @keyframes and driven by `animation-timeline: scroll(root block)`,
   which the compositor advances with the scroll itself. There is no frame in which the
   transform can be stale, because no frame has to run any of this code.

   WHY BOTH ANIMATED PHASES ARE NOW CSS WITH JS-MEASURED CONSTANTS. The dock needs layout
   (where is the o, how big is the coin) and the flight needs layout (where is the nav slot,
   how big is the lockup), but both need it ONCE: from there each path is a fixed function of
   its own progress. Handing measured numbers to CSS is less code, cheaper per frame, and it
   is SEEKABLE, which is what makes tools/hero-filmstrip.html possible: a rAF loop cannot be
   parked, and a headless browser gives one about three frames and then stops producing them.
   D3 learned that the hard way on phase 1 and this file has now learned it twice.

   THE FLIGHT IS SAMPLED RATHER THAN INTERPOLATED, and that is the one thing worth knowing
   before editing it. Two of the three channels are plain interpolations: the horizontal
   travel and the scale go from a fixed start to a fixed end under one easing curve. The
   VERTICAL travel is not, because the lockup scrolls away while it flies, so its end value
   grows with the scroll position: ty(u) = (K + y(u)) * ease(u), a product of two functions
   of u rather than a ramp between two numbers. No single timing function draws that. Sampling
   the exact expression at FLIGHT_STOPS points and emitting them as keyframes does, to well
   under a pixel, and it keeps the shipped motion identical to the scrub it replaces rather
   than approximately like it.

   IT IS THE THIRD JS FILE IN assets/ AND THE ONLY ONE THE PAGE CAN DO WITHOUT ENTIRELY.
   The drawer is a CSS checkbox because a nav that needs JS is a nav that can fail to exist;
   the theme button hides itself unless JS proves it works, because a control that does
   nothing when tapped is worse than one never offered. This one is a third case: the thing
   it enhances (D2's static hero) is complete and correct on its own, so the whole file is
   allowed to be missing. cms/publish.mjs copies it because its ASSET_RE reads the script
   src, exactly as it does for nav.js and theme.js.

   THE OPT-IN IS A CLASS SET BEFORE FIRST PAINT by a tiny inline script in index.html, and
   only when JS runs AND the visitor has not asked for reduced motion. Everything this file
   needs hidden is hidden by that class in CSS, never by this file, so:
     - no JS at all           -> no class -> D2's static hero, masthead mark and all
     - prefers-reduced-motion -> no class -> the same
     - this file 404s         -> the inline script's load listener takes the class off
     - this file throws       -> fail() takes the class off here
   All four land on the same hero, which is the point of having built the static state first.

   PHASE 3 HAS A SECOND, NARROWER OPT-IN: html.hero-fly, stamped by the same head script and
   only where `animation-timeline: scroll()` is supported. A browser without scroll timelines
   is not sent to the static hero, because phases 1 and 2 are plain CSS animations and work
   there perfectly; it keeps them, keeps D1's masthead mark visible from the first frame, and
   simply never flies. That is a fifth landing and it is deliberately NOT the same as the
   other four: sending it to the static hero would throw away two working phases to avoid a
   third, and re-shipping the old scrub as a fallback would be keeping the jump on purpose for
   the browsers least able to absorb it. */
(() => {
  const doc = document.documentElement;
  if (!doc.classList.contains('hero-seq')) return;

  const hero = document.querySelector('.hero');
  const lock = document.querySelector('.hero-lock');
  const wm = document.querySelector('.wm');
  const coin = document.querySelector('.hero-coin');
  const navSlot = document.querySelector('.nav-mark .wordmark-slot');

  /** The generated sheet holding phase 3's measured path. Named so fail() can pull it. */
  let flightSheet = null;

  /** Any failure at all: take both opt-ins off, drop every inline style and every generated
   *  rule this file added, and leave the page as the static hero. A half-played sequence is
   *  the one outcome worse than no sequence, because it can hide the wordmark AND the
   *  masthead's own mark. */
  const fail = () => {
    doc.classList.remove('hero-seq', 'hero-fly');
    if (flightSheet) flightSheet.remove();
    if (hero) hero.classList.remove('hero-play', 'hero-arrived', 'hero-skip');
    for (const el of [lock, coin, navSlot]) if (el) el.removeAttribute('style');
    for (const p of ['--fly-from', '--fly-to', '--say-from', '--say-to']) doc.style.removeProperty(p);
  };

  /** THE SAME LANDING, FOR THE CODE THAT RUNS LATER. The try below covers SETUP and only
   *  setup. relay's body runs inside a requestAnimationFrame callback reached from the
   *  observer, from fonts.ready and from a resize, and the animationend handler runs whenever
   *  phase 1 lands, so an exception in any of them escapes the try that was written to catch
   *  it. Until 2026-08-19 one did: both opt-ins stayed set with nothing left to take them off,
   *  and since a measurement clears .hero-lock's own animation-name and transform before
   *  reading its box, a throw between clearing and restoring left the flight switched OFF
   *  while the classes that hide the masthead's mark stayed ON. That is the half-played
   *  sequence above, reached by the one route the try could not see.
   *  So nothing here is handed to the platform raw, and the test is where the code RUNS FROM
   *  rather than whether today's body looks like it could throw: reasoning body by body is
   *  exactly how the gap was argued into existence. Twice around relay for the same reason:
   *  the outer call covers scheduling the frame, the inner one covers the frame itself, and
   *  those are two different tasks. */
  const guard = (fn) => (...args) => {
    try { return fn(...args); } catch (e) { fail(); }
  };

  if (!hero || !lock || !wm || !coin || !navSlot) return fail();

  try {
    /* Traced-vector geometry, ring to ring:
         LR = the o-ring's bounding box as fractions of logo-word.svg's 602x210 box
         MR = the coin ring's bounding box as fractions of monogram-mark.svg's 259x251 box
       The dock can be exact at all because both are potrace traces of the same drawn ring.

       THEY DESCRIBE THE FILES THIS PAGE ACTUALLY RENDERS, WHICH IS NOT WHERE THEY CAME FROM.
       Until 2026-08-16 they were the deleted cine hero's numbers, taken off logo.svg and
       monogram.svg, while the hero renders logo-word.svg and monogram-mark.svg. Measured with
       getBBox against the shipped files, every one of the six was wrong: the o-ring read
       0.19086 of the width where the constant said 0.19688, and the coin ring 0.60405 where it
       said 0.62332. The dock still landed, because the two width errors are both about 3.15%
       and the scale divides one by the other, so they cancelled. A dock that is accurate because
       two mistakes agree is one mistake away from being wrong, so these are now measured. */
    const LR = { cx: 0.24123, cy: 0.51967, w: 0.19086 };   // o-ring in logo-word.svg
    const MR = { cx: 0.49710, cy: 0.50191, w: 0.60405 };   // ring in monogram-mark.svg

    /* ---------- phase 1's geometry, measured RING TO RING ----------
       Off the coin's own untransformed box, never off the stage's centre: the coin is
       absolutely placed, so assuming its centre is the stage's lands the ring a scaled
       half-width down and to the right of the o. The CSS transform is `translate() scale()`,
       which scales about the coin's centre FIRST, so the ring's landing point is
       cc + s(r - cc) + d, and d is what this solves for. */
    function measureDock() {
      const prev = coin.style.transform;
      coin.style.transform = 'none';
      const cr = coin.getBoundingClientRect();
      coin.style.transform = prev;
      const wr = wm.getBoundingClientRect();
      if (!cr.width || !wr.width) return false;
      const s = (LR.w * wr.width) / (MR.w * cr.width);
      const oX = wr.left + LR.cx * wr.width;
      const oY = wr.top + LR.cy * wr.height;
      const ccx = cr.left + cr.width / 2;
      const ccy = cr.top + cr.height / 2;
      const rx = cr.left + MR.cx * cr.width;
      const ry = cr.top + MR.cy * cr.height;
      coin.style.setProperty('--dock-x', (oX - (ccx + s * (rx - ccx))).toFixed(3) + 'px');
      coin.style.setProperty('--dock-y', (oY - (ccy + s * (ry - ccy))).toFixed(3) + 'px');
      coin.style.setProperty('--dock-s', s.toFixed(5));
      return true;
    }

    /* ---------- phase 3's geometry ----------
       THE TRACK IS 62% OF THE HERO'S OWN HEIGHT, so the lockup has arrived before the hero
       has finished leaving. Everything is reduced to constants here and to one variable u,
       the flight's own progress, so that nothing below has to run again while scrolling.

       Vertical positions are carried in DOCUMENT coordinates and the masthead's in VIEWPORT
       coordinates, because .topbar is `position: sticky; top: 0`: the slot does not move as
       the page does, and the whole reason the vertical channel is not a plain ramp is that
       the lockup does. */
    const FLIGHT_STOPS = 48;

    /* THE CURVE IS SYMMETRIC AND IT FINISHES EARLY, AND BOTH HALVES OF THAT ARE goolio'S SECOND
       REPORT: "logo still move on last few scrolls after goes in upper left corner".

       It was `1 - (1-u)^3`, a plain ease-out, and an ease-out is FRONT LOADED: at half the track
       it has already covered 87.5% of the distance. So the mark looked like it had arrived in
       the corner around the halfway mark and then dribbled the last eighth over the remaining
       200-odd pixels of scrolling. Shortening the track and making the path monotonic did not
       touch that, because the shape of the curve was never the thing either of those changed.
       Nothing here is a bug in the sense of being wrong; it just reads as a mark that arrives
       and then will not settle, which is what he saw twice.

       Smoothstep is symmetric, so the mark does not look arrived until it nearly is. And the
       whole travel is remapped to finish at MOTION_END of the range, so the last quarter is a
       genuine HOLD: the transform at u = 0.8 is byte-identical to the transform at u = 1, and
       only then does the handover swap in the masthead's sticky copy. "Arrives, stops, then
       locks" is three separate things and this is the middle one. */
    const MOTION_END = 0.75;
    const ease = (u) => {
      const t = u <= 0 ? 0 : u >= MOTION_END ? 1 : u / MOTION_END;
      return t * t * (3 - 2 * t);
    };

    /* HOW MUCH SCROLL THE WHOLE FLIGHT TAKES, as a fraction of the hero's own height. It was
       0.62 until goolio watched it: "šoljica logo still moves after few scrolls down in upper
       left corner." He was right, and the cause was the long lazy tail an ease-out leaves. The
       mark looked arrived at roughly 55% of the old track and then went on shrinking from 163px
       to 132px and drifting back down about 6px over the remaining 200px of scrolling. Ending
       the flight sooner is half the answer; sample() rewriting the path is the other half.
       IT IS PUBLISHED AS --fly-from / --fly-to AND NOTHING ELSE MAY RECOMPUTE IT.
       tools/hero-filmstrip.html and tools/hero-flight-probe.html both carried their own copy of
       `hero.offsetHeight * 0.62`, which is two more places for this number to be wrong in. They
       read the custom properties now. */
    const TRACK_FRACTION = 0.45;

    function measureFlight() {
      const prevT = lock.style.transform;
      const prevA = lock.style.animationName;
      lock.style.animationName = 'none';   // the flight itself would otherwise be in the box
      lock.style.transform = 'none';
      const wr = wm.getBoundingClientRect();
      const lr = lock.getBoundingClientRect();
      const hr = hero.getBoundingClientRect();
      const nr = navSlot.getBoundingClientRect();
      lock.style.transform = prevT;
      lock.style.animationName = prevA;
      const track = hr.height * TRACK_FRACTION;
      if (!wr.width || !nr.width || track <= 0) return null;
      const sy = window.scrollY;
      const ox = (wr.left + wr.width / 2) - (lr.left + lr.width / 2);
      const oy = (wr.top + wr.height / 2) - (lr.top + lr.height / 2);
      return {
        y0: hr.top + sy,               // scroll at which the flight starts
        track,
        sEnd: nr.width / wr.width,
        lockCx: lr.left + lr.width / 2,
        lockCyDoc: lr.top + lr.height / 2 + sy,
        /* The lockup scales about its own centre while the thing that has to land in the slot
           is the WORDMARK inside it, so every step carries the wordmark's offset from that
           centre. Read off untransformed boxes, the arithmetic is exact at both ends. */
        ox,
        oy,
        // where the mark's own centre sits, on screen, before any of this starts
        startCx: lr.left + lr.width / 2 + ox,
        startCy: lr.top + lr.height / 2 + oy,
        navCx: nr.left + nr.width / 2,
        navCy: nr.top + nr.height / 2,
        navBottom: nr.bottom,
      };
    }

    /* ONE SAMPLE OF THE FLIGHT, AND IT DESCRIBES THE PATH RATHER THAN REPRODUCING THE OLD ONE.
       This is the part that answers "can it be locked in upper left side once it is there".

       The scroll handler this replaced, and the first version of these keyframes after it,
       computed the transform and let the on-screen path be whatever fell out. What fell out was
       not what anyone would have drawn. The lockup scrolls away while it flies, so its vertical
       target grows with the scroll position, and the sum of a saturating ease and a linear
       scroll term OVERSHOOTS: the mark rose past the masthead and settled back down into it,
       and the last third of the track did almost no work while still visibly shrinking. From
       the corner of your eye that reads as a mark that has arrived and then keeps fidgeting.

       So the path is stated instead. The mark's own centre travels from where it sits to the
       centre of the masthead slot under one easing curve, and the transform is solved backwards
       from that. Monotonic by construction, in the coordinates a person actually watches. It
       arrives exactly at u = 1, where the handover hides it and the masthead's sticky copy takes
       over, and a sticky element cannot move afterwards no matter how far the page goes.

       Note it uses the LIVE scale s rather than the end scale when correcting for the
       wordmark's offset inside the lockup. The old expression used sEnd throughout, which is
       exact at both ends and wrong in between; with the path stated up front, being right in
       between is the whole point. */
    function sample(m, u) {
      const k = ease(u);
      const s = 1 + (m.sEnd - 1) * k;
      const markCx = m.startCx + (m.navCx - m.startCx) * k;
      const markCy = m.startCy + (m.navCy - m.startCy) * k;
      const lockCyVp = m.lockCyDoc - (m.y0 + u * m.track);
      return {
        s,
        markCy,
        tx: markCx - (m.lockCx + s * m.ox),
        ty: markCy - (lockCyVp + s * m.oy),
      };
    }

    /* THE MARK CHANGES INK MID-FLIGHT, and without it a third of the travel is a mark nobody
       can see: the hero is a band of ink and the lockup is painted in --on-band, which is
       cream, and the masthead it is flying into is also cream.

       THE MOMENT IS SOLVED, NOT CHOSEN. An earlier version switched at a fixed 55% of the
       travel and the filmstrip's 50% pane came out blank, because where the mark is against
       the bar depends on the viewport. This walks the same samples the transform is built
       from and takes the first at which the mark's centre has crossed the masthead's lower
       edge, so the answer is whatever the geometry says on the screen it is running on. The
       blend that follows is the width of one sixth of the flight rather than a hard step,
       which is what the old CSS transition on .hero-lock bought and is now spent here. */
    function buildFlight(m) {
      const at = new Map();
      const put = (pct, decl) => {
        const key = pct.toFixed(4);
        at.set(key, (at.get(key) || '') + decl);
      };

      /* -1 IS THE SENTINEL BECAUSE 1 IS A LEGAL ANSWER. A `cross` of 1 meaning "not found
         yet" cannot be told apart from a crossing found at the last sample, and both of them
         then emit the band colour at 0% and both colours at 100%, where the later declaration
         wins: the ink interpolates across the WHOLE travel and the mark spends the middle of
         the flight in a colour matching neither the band it is leaving nor the bar it is
         entering. One of the two is unreachable and the other is not. The ease saturates at
         MOTION_END, so from u = 0.75 the mark's centre sits on the slot's centre, half the
         slot's height above its bottom edge, and the crossing is always found by then: 20000
         randomised geometries produced the whole-flight drift only if the slot measured
         ZERO high, where the centre and the bottom edge are the same line and a mark approaching from below can never
         cross it. */
      const BLEND = 1 / 6;
      let cross = -1;
      for (let i = 0; i <= FLIGHT_STOPS; i++) {
        const u = i / FLIGHT_STOPS;
        const f = sample(m, u);
        if (cross < 0 && f.markCy < m.navBottom) cross = u;
        put(u * 100, `transform:translate(${f.tx.toFixed(2)}px,${f.ty.toFixed(2)}px) scale(${f.s.toFixed(5)});`);
      }

      put(0, 'color:var(--on-band);visibility:visible;');
      if (cross < 0) {
        /* The mark never reached the bar, so it never leaves the band's ink: one colour for the
           whole flight, and the swap at the end is the only change. It has to be said at 100%
           as well as at 0%, or the missing stop is filled in with the element's own colour and
           the interpolation this branch exists to avoid returns by the other door. */
        put(100, 'color:var(--on-band);');
      } else {
        /* The blend is a sixth of the travel wide and it has to END by the handover, so a late
           crossing pulls the window back rather than squeezing it: a mark still cream when the
           masthead's own copy swaps in is a cream mark on a cream bar. Below 5/6 this is
           `from = cross` and the emitted numbers are the shipped ones, which is every case the
           geometry reaches today. */
        const from = Math.min(cross, 1 - BLEND);
        put(from * 100, 'color:var(--on-band);');
        put((from + BLEND) * 100, 'color:var(--text);');
        /* AND AGAIN AT THE HANDOVER, for the reason the no-cross branch below already states.
           With no colour stop at 100% the browser builds the missing to-keyframe from the
           element's own colour, which .hero sets to var(--on-band), so the mark washed straight
           back to cream over the last fifth of the travel and landed invisible on the cream bar.
           Measured in Chrome on the shipped geometry, reading the letterform fill back off a
           canvas: rgb(28,19,12) at 79.17% of the travel, rgb(135,129,123) at 90%, and
           rgb(251,248,244) at 99.9%. THE SUITE CANNOT SEE THIS: the stub DOM reads the
           keyframe text as a string, so it models "the last declaration wins" and not the
           browser's implicit to-keyframe. */
        put(100, 'color:var(--text);');
      }
      /* THE HANDOVER IS A SWAP, NOT A REVEAL. The travelling mark and the masthead's static
         copy are the same mark at the same size in the same place at the end of the flight,
         so there is nothing to cross-fade and nothing to give the swap away. It has to happen
         at all because the keyframes stop here: past the end of the range the transform is
         held, and a held transform scrolls away with the hero it belongs to. visibility and
         not opacity on either copy, or the bar holds a link a keyboard can tab into for the
         whole of the first screen. */
      put(99.9, 'visibility:visible;');
      put(100, 'visibility:hidden;');

      const frames = [...at.entries()]
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .map(([pct, decl]) => `${parseFloat(pct)}%{${decl}}`)
        .join('');
      return `@keyframes hero-to-nav{${frames}}`;
    }

    /** Measure, generate, and hand the range over as custom properties. Runs on load and on
     *  resize, and never while scrolling. */
    function layFlight() {
      const m = measureFlight();
      if (!m) return false;
      if (!flightSheet) {
        flightSheet = document.createElement('style');
        flightSheet.id = 'hero-flight';
        document.head.appendChild(flightSheet);
      }
      flightSheet.textContent = buildFlight(m);
      doc.style.setProperty('--fly-from', m.y0.toFixed(2) + 'px');
      doc.style.setProperty('--fly-to', (m.y0 + m.track).toFixed(2) + 'px');
      /* The line and its actions leave first, so what travels the last stretch is the mark
         alone. Their range starts a little into the flight rather than at 0: an animation in
         range at the top of the page would overrule "hidden until phase 1 has landed" and put
         the tagline on screen before the mark it belongs under exists. */
      doc.style.setProperty('--say-from', (m.y0 + m.track * 0.02).toFixed(2) + 'px');
      doc.style.setProperty('--say-to', (m.y0 + m.track * 0.45).toFixed(2) + 'px');
      return true;
    }

    const flies = doc.classList.contains('hero-fly');
    if (flies && !layFlight()) return fail();

    /* EVERY NUMBER IN THE FLIGHT IS A MEASUREMENT, SO EVERY ONE OF THEM CAN GO STALE, and a
       stale flight does not fail loudly: it lands the mark near the masthead instead of on it.
       Caught on this box on 2026-08-16 with the window changed after load, where the range
       still described the taller viewport and the mark finished 22px above the slot.

       A `resize` listener is not enough, and that is the whole point of what follows. Two
       things move this layout without ever resizing the window. WEBFONTS: hero.js is deferred
       and can measure before Prata and Archivo arrive, and the tagline inside .hero-lock is
       what sets that box's height and, through `max-width: 34ch`, its width, so the lockup's
       centre moves under the flight when the real faces land. And a REGISTER CHANGE or any
       later reflow can do the same. The observer asks the only question that matters, which is
       whether the boxes this was measured from are still the boxes on the screen.

       Debounced onto a frame because a ResizeObserver fires once per observed element and
       relaying is not free; and re-entrant relays are harmless anyway, since measuring clears
       the transform and a transform never changed a layout. */
    let pending = false;
    const relay = guard(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(guard(() => {
        pending = false;
        /* PHASE 1 IS RE-AIMED TOO, AND LEAVING IT OUT WAS THE BUG BEHIND "Š coin not going into
           O of šoljica". The dock was measured once, at load, and webfonts had not arrived. The
           wordmark's own box does not depend on them, so this looked safe and is not: .hero-say
           sits under the mark inside .hero-lock, its height is set by the tagline, and .hero-core
           centres the whole lockup. When Prata and Archivo land, that column changes height and
           the wordmark MOVES, taking the o with it and leaving the coin aimed where the o used
           to be. Re-aiming under a running animation is free here, because the keyframes read
           --dock-x/y/s live. After it has landed there is nothing left to aim. */
        if (!hero.classList.contains('hero-arrived')) measureDock();
        /* A NULL RE-MEASURE IS DELIBERATELY NOT A FAILURE HERE, where at setup it is one.
           There `!layFlight()` lands on the static hero because there is nothing else to fall
           back on; here the path measured a moment ago is still a coherent one, and a box that
           reads zero wide in the middle of a resize is ordinary enough that tearing the whole
           sequence down for it would cost more than the stale path does. The next relay
           re-measures. A condition that PERSISTS leaves the mark landing near the slot instead
           of on it, which is the lesser of the two and is why this is a decision rather than an
           oversight. */
        if (flies) layFlight();
      }));
    });
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(relay);
      ro.observe(hero);
      ro.observe(lock);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(relay, () => {});
    }

    /* THE ONE REVIEW HOOK IN THIS FILE, and it survives the rewrite because the thing it
       works around does. tools/hero-filmstrip.html photographs phase 3 by scrolling a pane
       and shooting it, and a headless browser stops handing out frames: the pane gets the
       scroll and never the frame that would sample the timeline, so the landing pane came out
       one frame short of landing. Reading a scroll-driven animation's own progress and then a
       computed style forces the sample and flushes it into the box. It reads state, changes
       nothing for a visitor, and is what makes "the mark lands in the masthead" a claim with
       a picture behind it rather than an assurance. */
    hero.__heroSync = () => {
      const anims = lock.getAnimations();
      for (const a of anims) void a.currentTime;
      void getComputedStyle(lock).transform;
      const timing = anims[0] && anims[0].effect && anims[0].effect.getComputedTiming();
      return timing && timing.progress != null ? timing.progress : 0;
    };

    /* The observer above already catches a window resize, because resizing changes the hero's
       box. This is here for the case it does not: a viewport change that leaves both observed
       boxes the same size but moves what is around them. */
    addEventListener('resize', relay);

    if (!measureDock()) return fail();

    /* Told the inline watchdog we are alive, so it stops counting. */
    doc.setAttribute('data-hero-ready', '');

    /* A visitor arriving at #gde, or restoring a scrolled position on a back navigation, is
       already past the hero, and the sequence has to be found finished rather than played to
       an empty screen. Phase 3 needs nothing here: its timeline is the scroll position, so it
       is already wherever the page is. Phases 1 and 2 are clocks and do. */
    const past = hero.getBoundingClientRect().top < -0.02 * hero.offsetHeight * TRACK_FRACTION;
    if (past) {
      /* hero-skip is what kills the animations; hero-arrived only means phase 1 has landed,
         and on its own it must never truncate phase 2's write. */
      hero.classList.add('hero-skip', 'hero-arrived');
    } else {
      hero.classList.add('hero-play');
      coin.addEventListener('animationend', guard(() => hero.classList.add('hero-arrived')), { once: true });
    }
  } catch (e) {
    fail();
  }
})();
