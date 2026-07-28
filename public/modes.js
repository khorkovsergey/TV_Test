/* =========================================================================
   Experience modes — one policy, three presets.

   Before this file the three modes were an idea implemented nine times: an
   ORDER map in home.js, another in ia.js, a fallback copy in symbol.html, a
   labels array in nav.js, a density block in the stylesheet and per-page
   conditionals in charts, markets, index and academy. Each copy drifted, so
   the same word meant something different depending on the page you were on.

   The product rule this file encodes (§2 of the brief):

     Mode controls HOW capability is presented.
     Subscription controls WHAT is commercially available.
     Permissions control WHAT the user is allowed to do.

   These are three dimensions and they never touch. Nothing here may be used
   as a paywall, and nothing here may remove a capability — only move it
   between "shown by default", "collapsed", "behind More" and "in a drawer".
   ========================================================================= */

window.Modes = (function () {

  const LIST = ['simple', 'standard', 'pro'];
  const ORDER = { simple: 0, standard: 1, pro: 2 };

  const POLICIES = {
    simple: {
      id: 'simple', label: 'Simple', shortLabel: 'Simple',
      description: 'Понятный путь и объяснения',
      tagline: 'essentials, with the terms explained',
      hint: 'fewer panels by default, plain language, one obvious next step',
      complexity: 1,
      density: 'comfortable',
      explanationDepth: 'guided',
      /* §7 — the four profiles that turn a mode from a density setting into a
         composition. Each names a policy the surfaces read; none of them is a
         permission, and none changes a number. */
      navigationProfile: 'guided',
      homeProfile: 'guided-home',
      formProfile: 'wizard',
      copilotProfile: 'teacher',
      maxPrimaryActions: 3,
      maxPrimaryTabs: 5,
      chartPreset: 'simple',
      defaultCommunityFeed: 'editors',
      showContextualEducation: true,
      showAdvancedByDefault: false,
      tableDensity: 'comfortable'
    },
    standard: {
      id: 'standard', label: 'Standard', shortLabel: 'Standard',
      description: 'Полноценная ежедневная платформа',
      tagline: 'the complete everyday product',
      hint: 'full asset hub, screeners, fundamentals, saved layouts',
      complexity: 2,
      density: 'balanced',
      explanationDepth: 'contextual',
      navigationProfile: 'balanced',
      homeProfile: 'daily-home',
      formProfile: 'grouped',
      copilotProfile: 'researcher',
      maxPrimaryActions: 5,
      maxPrimaryTabs: 8,
      chartPreset: 'standard',
      defaultCommunityFeed: 'for-you',
      showContextualEducation: true,
      showAdvancedByDefault: false,
      tableDensity: 'standard'
    },
    pro: {
      /* §GAP-01 — the internal id stays `pro`: it is in stored preferences, in
         every `data-min` attribute and in three migrations. What changes is the
         word a person reads. `shortLabel` exists because a mobile switcher has
         room for three words, not for "Professional". */
      id: 'pro', label: 'Professional', shortLabel: 'Pro',
      description: 'Скорость, плотность и продвинутые инструменты',
      tagline: 'speed, density and the advanced tools',
      hint: 'compact layout, multi-chart, Pine, strategy tester, shortcuts',
      complexity: 3,
      density: 'compact',
      explanationDepth: 'minimal',
      navigationProfile: 'professional',
      homeProfile: 'professional-desk',
      formProfile: 'dense',
      copilotProfile: 'analyst',
      maxPrimaryActions: 8,
      maxPrimaryTabs: 12,
      /* Внутренний токен, а не подпись: он совпадает с идентификатором режима
         и потребляется кодом. Переименовать его — churn без пользы; менять
         надо то, что человек читает, а это `label`. */
      chartPreset: 'pro',
      defaultCommunityFeed: 'full',
      showContextualEducation: false,
      showAdvancedByDefault: true,
      tableDensity: 'compact'
    }
  };

  /* Migration, versioned. The misspelling with a trailing "t" keeps coming
     back in conversation; it is accepted on the way in and normalised on the
     way out, so a stored typo can never strand somebody on a value that no
     comparison matches. "beginner" is what Simple was called two releases
     ago and is migrated the same way. */
  function migrate(value) {
    if (typeof value !== 'string') return null;
    const s = value.replace(/^"|"$/g, '').trim().toLowerCase();
    if (s === 'standart' || s === 'standart mode') return 'standard';
    if (s === 'beginner' || s === 'novice') return 'simple';
    if (s === 'advanced' || s === 'expert') return 'pro';
    return LIST.includes(s) ? s : null;
  }

  const isMode = m => LIST.includes(m);
  const policy = m => POLICIES[isMode(m) ? m : 'simple'];
  const atLeast = (mode, min) => (ORDER[mode] ?? 0) >= (ORDER[min] ?? 0);

  /* ------------------------------------------------------------ visibility

     A module declares once how it presents itself at each level. Nothing
     returns "hidden": the weakest state is `more-menu`, which still leaves a
     door. This is the mechanism that stops a mode from deleting a product.

       always           shown, and never folded
       default          shown at this level
       collapsed        present, folded into a disclosure
       more-menu        present, behind a "More" affordance
       advanced-drawer  present, behind an explicit "Advanced tools" drawer
  */
  const VISIBILITY = ['always', 'default', 'collapsed', 'more-menu', 'advanced-drawer'];

  function presentation(complexity) {
    /* The default policy for a module of a given complexity, so most callers
       do not have to spell out three states by hand. */
    if (complexity <= 1) return { simple: 'default',   standard: 'default', pro: 'default' };
    if (complexity === 2) return { simple: 'collapsed', standard: 'default', pro: 'default' };
    return { simple: 'more-menu', standard: 'collapsed', pro: 'default' };
  }

  function visibility(pres, mode) {
    const p = pres && pres[mode] ? pres[mode] : presentation(pres?.complexity || 1)[mode];
    return VISIBILITY.includes(p) ? p : 'default';
  }

  const isVisibleByDefault = (pres, mode) => {
    const v = visibility(pres, mode);
    return v === 'always' || v === 'default';
  };

  /* ------------------------------------------------------------- storage

     One authoritative record. `ui_mode` stays as a plain-string mirror
     because four scripts still read it directly and a silent break there
     would be worse than a duplicated byte; `experience_prefs` is the real
     preference object and carries where the choice came from.

     Precedence: profile (not on this stand) → stored preference →
     onboarding recommendation → Simple for a genuinely new visitor.
  */
  const K_MODE  = 'ui_mode';
  const K_PREFS = 'experience_prefs';
  const PREFS_VERSION = 2;

  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  function prefs() {
    let raw = null;
    try { raw = JSON.parse(read(K_PREFS) || 'null'); } catch { raw = null; }
    const legacy = migrate(read(K_MODE));

    if (!raw || typeof raw !== 'object') {
      return {
        version: PREFS_VERSION,
        mode: legacy || 'simple',
        selectedAt: null,
        source: legacy ? 'migration' : 'default',
        dismissedUpgradePrompts: []
      };
    }
    const mode = migrate(raw.mode) || legacy || 'simple';
    return {
      version: PREFS_VERSION,
      mode,
      selectedAt: raw.selectedAt || null,
      source: raw.source || 'migration',
      dismissedUpgradePrompts: Array.isArray(raw.dismissedUpgradePrompts) ? raw.dismissedUpgradePrompts : []
    };
  }

  function savePrefs(next) {
    const p = { ...prefs(), ...next, version: PREFS_VERSION };
    p.mode = migrate(p.mode) || 'simple';
    write(K_PREFS, JSON.stringify(p));
    write(K_MODE, p.mode);            // the plain mirror older scripts read
    return p;
  }

  const current = () => prefs().mode;

  function dismissPrompt(id) {
    const p = prefs();
    if (!p.dismissedUpgradePrompts.includes(id)) {
      p.dismissedUpgradePrompts.push(id);
      savePrefs(p);
    }
  }
  const isDismissed = id => prefs().dismissedUpgradePrompts.includes(id);

  /* --------------------------------------------------------- the promise

     What the switch changes, and — the part people actually worry about —
     what it does not. Rendered verbatim by the comparison dialog, so the
     copy in the UI cannot drift from the rule in the code.
  */
  const CHANGES = [
    'which sections lead the top menu — everything else moves under "More"',
    'what the home page opens with: a guided task, your day, or a working desk',
    'the order modules appear in, and which one leads a page',
    'how much is shown by default — information density',
    'which panels, tabs and columns open without being asked for',
    'how much explanation comes with each number',
    'the chart preset: tools, indicators and side panels',
    'how a form is laid out: one step at a time, grouped, or dense',
    'how the Copilot answers — teacher, researcher or analyst',
    'how many primary actions a page offers before "More"',
    'the default community feed'
  ];

  const KEEPS = [
    'your plan and billing — mode is never a paywall',
    'what market data you are entitled to',
    'every saved thing: watchlists, alerts, portfolios, research, layouts',
    'your account and permissions',
    'the prices themselves — no number changes with the mode',
    /* §10 — the old promise was "the six sections", and mode-specific top
       navigation deliberately breaks it: Professional leads with Screeners and
       Charts. What can still be promised is the part that actually matters —
       nothing becomes unreachable. */
    'every route and every destination — what moves is the order, never the access',
    'every strategic feature: Academy, Copilot, Wealth Hub, AI Private, Expert Marketplace, Rewards'
  ];

  /* Onboarding recommendation. A recommendation, never a forced choice. */
  function recommend(answer) {
    if (answer === 'professional' || answer === 'develop' || answer === 'trade') return 'pro';
    if (answer === 'analysis' || answer === 'invest') return 'standard';
    return 'simple';
  }

  /* Normalise on load. Reading a broken value and quietly working around it
     leaves the broken value in storage forever; §10 asks for a migration, not
     a permanent tolerance. Runs once, writes only when something changed. */
  (function normaliseOnLoad() {
    const stored = read(K_MODE);
    const fixed = migrate(stored);
    if (stored !== null && fixed && stored !== fixed) {
      savePrefs({ mode: fixed, source: 'migration' });
    } else if (stored !== null && !fixed) {
      savePrefs({ mode: 'simple', source: 'migration' });
    }
  })();

  return {
    LIST, ORDER, POLICIES, VISIBILITY, CHANGES, KEEPS,
    migrate, isMode, policy, atLeast, presentation, visibility, isVisibleByDefault,
    prefs, savePrefs, current, dismissPrompt, isDismissed, recommend,
    K_MODE, K_PREFS
  };
})();
