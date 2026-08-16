/* The light/dark control, and it is the one control on this site that is allowed to need
   JavaScript. The drawer beside it is a CSS checkbox precisely so a failed script cannot
   remove the nav; this button is the opposite case, because there is no CSS that can write
   a choice down and read it back on the next page. So the rule is: with this file missing,
   the button is NOT SHOWN AT ALL. `html.js-theme` is added by the tiny inline script in
   each page's head, and assets/base.css reveals the control only under that class. A button
   that is visible and does nothing when tapped is worse than one that was never offered.

   WHY THE HEAD SCRIPT IS SEPARATE AND INLINE. The stored choice has to be stamped on the
   html element BEFORE first paint, or a visitor who chose dark gets a cream flash on every
   navigation. A deferred external file runs far too late for that. So the head does two
   cheap things (read storage, stamp the element) and this file does the rest: the click,
   the cycle, the label. The two share one storage key and one attribute name, and that
   pair is the whole contract between them.

   THREE STATES IN A FIXED ORDER: system, light, dark. The system state is the default and
   it is the one a two-way toggle throws away, because once you have forced a register there
   is no gesture that means "go back to following my phone". Cycling keeps it reachable.

   NO LESS-THAN SIGN TOUCHES A LETTER IN HERE, ON PURPOSE, the same warning assets/nav.js
   carries: cms/engine.mjs finds tags by scanning for a less-than sign followed by a letter,
   and the English page is RENDERED off that scan. A comparison written the other way round
   is the whole reason this file uses >= and never the mirror of it. */
(function () {
  var root = document.documentElement;
  var btn = document.querySelector('[data-theme-switch]');
  if (!btn) return;

  var KEY = 'soljica-theme';
  var ORDER = ['system', 'light', 'dark'];

  /* The label is a sentence, not a word, because the button cycles: a reader needs to know
     where they ARE, and "Tema: tamna" plus a visible icon says it. The strings are keyed on
     the document's own lang, which the EN render rewrites on the html element, so this file
     needs no second copy per language and cannot drift from the page it is on. */
  var SAY = {
    sr: { system: 'Tema: sistem. Promeni.', light: 'Tema: svetla. Promeni.', dark: 'Tema: tamna. Promeni.' },
    en: { system: 'Theme: system. Change.', light: 'Theme: light. Change.', dark: 'Theme: dark. Change.' }
  };

  function read() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
    return v === 'light' || v === 'dark' ? v : 'system';
  }

  function apply(state) {
    if (state === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state);
    root.setAttribute('data-theme-state', state);

    var words = SAY[root.getAttribute('lang') === 'en' ? 'en' : 'sr'];
    var say = btn.querySelector('.theme-say');
    if (say) say.textContent = words[state];
  }

  btn.addEventListener('click', function () {
    var next = ORDER[(ORDER.indexOf(read()) + 1) % ORDER.length];
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch (e) { /* private mode: the choice still applies to this page, it just will not survive */ }
    apply(next);
  });

  /* Another tab changing the choice, and the system preference moving under a page that is
     following it. Both are cheap to honour and both look like a bug when they are not. */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(read());
  });

  apply(read());
})();
