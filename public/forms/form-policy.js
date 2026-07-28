/* =========================================================================
   Form policy (§27).

   `formProfile` was declared in the mode policy and in every surface, and
   nothing consumed it. This is the thing that consumes it.

   The three profiles are not three stylesheets. They are three answers to
   "how much should a person decide at once":

     wizard    one decision per screen, with an example and a default
     grouped   related fields together, advanced ones folded
     dense     everything visible, keyboard-first

   The rule that outranks all three (§27, state invariant): switching mode
   while a form is open must not lose data, must not submit, must not close
   the form, and must not throw away the step the person is on. A form that
   eats an answer when the interface reflows is worse than a form with the
   wrong layout.
   ========================================================================= */

window.FormPolicy = (function () {

  const PROFILES = ['wizard', 'grouped', 'dense'];

  const RULES = {
    wizard: {
      id: 'wizard',
      /* One question at a time. `stepped` is what makes it a wizard rather
         than a tall form: the fields exist, one group is visible. */
      stepped: true,
      fieldsPerStep: 1,
      showExamples: true,
      showDefaults: true,
      /* Optional fields are folded, never dropped — a field a mode hides is
         still a field the person may need. */
      foldOptional: true,
      foldAdvanced: true,
      primaryActions: 1,
      labelPosition: 'above',
      density: 'comfortable'
    },
    grouped: {
      id: 'grouped',
      stepped: false,
      fieldsPerStep: Infinity,
      showExamples: true,
      showDefaults: true,
      foldOptional: false,
      foldAdvanced: true,
      primaryActions: 2,
      labelPosition: 'above',
      density: 'balanced'
    },
    dense: {
      id: 'dense',
      stepped: false,
      fieldsPerStep: Infinity,
      showExamples: false,
      showDefaults: true,
      foldOptional: false,
      foldAdvanced: false,
      primaryActions: 3,
      labelPosition: 'inline',
      density: 'compact'
    }
  };

  const profileFor = (surface) => {
    if (window.ModeOrchestrator && surface) return window.ModeOrchestrator.formProfile(surface);
    const mode = window.Portal?.mode ? window.Portal.mode() : 'simple';
    return (window.Modes ? window.Modes.policy(mode).formProfile : 'grouped');
  };

  const rules = (surfaceOrProfile) => {
    const p = PROFILES.includes(surfaceOrProfile) ? surfaceOrProfile : profileFor(surfaceOrProfile);
    return RULES[p] || RULES.grouped;
  };

  return { PROFILES, RULES, profileFor, rules };
})();
