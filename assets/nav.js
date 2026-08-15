/* The phone nav's drawer, and it is an ENHANCEMENT: with this file removed the drawer
   still opens, still closes, and still locks the page behind it. The mechanism is a CSS
   checkbox (assets/base.css, the .nav-cb block), ported from the Tilltrend site's own
   zero-JS drawer, so the markup works before any script runs and there is no flash of a
   full nav collapsing into a burger.

   WHAT THIS ADDS IS THE ONE THING THAT PATTERN CANNOT DO HERE. On Tilltrend every nav
   link is a full page load, so the drawer closes because the next document arrives with a
   fresh unchecked box. THIS site's nav is mostly IN-PAGE ANCHORS: tap "Ponuda" on the home
   page and the browser scrolls behind a drawer that is still sitting over it. So the close
   on link tap is real work here, not a nicety, and it is the reason this file exists.

   Three smaller jobs come with it: Escape, because a drawer with no keyboard exit is a
   trap; a resize past the breakpoint, so a drawer left open cannot strand the desktop nav
   off-screen; and mirroring the checkbox into a body class for engines with no :has(),
   where the scroll lock would otherwise be silently dead.

   NO LESS-THAN SIGN TOUCHES A LETTER IN HERE, ON PURPOSE, and the same warning is written
   into the menu pages' own script. cms/engine.mjs finds tags by scanning the whole file
   for a less-than sign followed by a letter, and the English page is RENDERED off that
   scan, so a tight numeric comparison in a script reads to it as the open tag of an
   element named after the variable. There is no comparison in here at all; if one is ever
   needed, write it the other way round. */
(() => {
  const cb = document.getElementById('nav-toggle');
  const bar = document.querySelector('.topbar');
  if (!cb || !bar) return;

  /* The scroll lock is `body:has(.nav-cb:checked)` in the stylesheet, which Firefox before
     121 and Safari before 15.4 cannot match. This mirrors the state onto a class those
     engines CAN match. The two rules are declared separately in the CSS on purpose: one
     unsupported selector in a comma list drops the whole rule in exactly the engines that
     needed the fallback. */
  const sync = () => document.body.classList.toggle('nav-open', cb.checked);

  /* Setting .checked in script does not fire `change`, so every close goes through here
     rather than through the event, and the mirror can never drift from the checkbox. */
  const close = (refocus) => {
    if (!cb.checked) return;
    cb.checked = false;
    sync();
    /* focus the CHECKBOX, not the label: the label is what you see, the checkbox is what
       the keyboard drives, and .nav-cb:focus-visible paints the ring onto the label. */
    if (refocus) cb.focus();
  };

  cb.addEventListener('change', sync);

  /* Delegated, so a nav rebuilt by a chat edit keeps working. `closest` also means a tap
     that lands on an element inside a link still counts as that link. */
  bar.addEventListener('click', (e) => {
    if (e.target.closest('.nav-links a')) close(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(true);
  });

  /* Past the breakpoint the drawer's rules stop applying and the links go back to being a
     row in the bar, but the checkbox would still be checked and the scroll lock still on.
     The query is written once, here, and it is the same 560px the stylesheet uses; if one
     moves, the other has to move with it. */
  const phone = matchMedia('(max-width: 560px)');
  const onBreak = () => { if (!phone.matches) close(false); };
  if (phone.addEventListener) phone.addEventListener('change', onBreak);
  else phone.addListener(onBreak); /* Safari before 14 */

  sync();
})();
