/*
 * Dark-pattern taxonomy used for detection.
 *
 * The types and tiers come from the evidence-based analysis in
 * research/taxonomy/ (see its README for the data and method):
 * - core:         prioritised by prevalence, regulation and detectability
 * - extended:     detected on a best-effort basis
 * - out_of_scope: usually needs a multi-step flow or observation over time,
 *                 so it's only flagged when the scanned page itself shows it
 *
 * Definitions follow deceptive.design/types; "False discount" is added from
 * the FTC 2022 compilation and the team's study (Kulkarni et al.).
 * Keep this list in sync with research/taxonomy/results/ranking.csv.
 */

const DARK_PATTERN_TYPES = [
  // Core
  { name: 'Fake scarcity', tier: 'core', aliases: ['low-stock message', 'high-demand message'],
    definition: 'Pressure to act now through an indication of limited supply or high demand (e.g. "Only 2 left", "20 people have this in their cart").' },
  { name: 'Fake urgency', tier: 'core', aliases: ['countdown timer', 'limited-time message'],
    definition: 'Pressure to act now through a time limit (e.g. countdown timers, "offer ends soon", "deal of the day").' },
  { name: 'Fake social proof', tier: 'core', aliases: ['activity notification', 'testimonials of uncertain origin'],
    definition: 'Claims about other people\'s activity or opinions to make a product seem popular or credible (e.g. "500 bought in the past hour", unverifiable testimonials).' },
  { name: 'Confirmshaming', tier: 'core', aliases: [],
    definition: 'Wording that guilts or shames the user for declining (e.g. "No thanks, I don\'t like saving money").' },
  { name: 'Trick wording', tier: 'core', aliases: ['trick questions'],
    definition: 'Confusing or misleading language, such as double negatives, that steers the user into an unintended choice.' },
  { name: 'Preselection', tier: 'core', aliases: ['pressured selling', 'default opt-in'],
    definition: 'An option that benefits the business is selected by default (e.g. a pre-ticked box for insurance, newsletters or a pricier plan).' },
  { name: 'Hidden subscription', tier: 'core', aliases: ['forced continuity', 'subscription trap'],
    definition: 'The user is enrolled in a recurring payment without clear disclosure (e.g. a trial that silently converts to a paid plan).' },
  { name: 'Forced action', tier: 'core', aliases: ['forced enrollment', 'forced registration'],
    definition: 'The user must do something unwanted to get what they came for (e.g. create an account or give payment details to continue).' },
  { name: 'Sneaking', tier: 'core', aliases: ['sneak into basket', 'add-on creep', 'hidden information'],
    definition: 'Relevant information is hidden or delayed, or items are added without consent (e.g. an add-on placed in the cart automatically).' },
  { name: 'False discount', tier: 'core', aliases: ['discount anchoring', 'inflated reference price', 'fake M.R.P.'],
    definition: 'A discount shown against a reference price (e.g. "M.R.P.", "was" price, "% off") that may be inflated to make the deal look better than it is.' },

  // Extended
  { name: 'Hidden costs', tier: 'extended', aliases: ['drip pricing'],
    definition: 'Fees or charges that appear only late in the purchase (e.g. a "convenience fee" or "service fee" added at checkout).' },
  { name: 'Visual interference', tier: 'extended', aliases: ['false hierarchy', 'misdirection'],
    definition: 'Design or wording that steers attention to the option the business prefers while obscuring alternatives.' },
  { name: 'Disguised ads', tier: 'extended', aliases: ['disguised advertisement'],
    definition: 'Advertisements made to look like regular content, search results, recommendations or interface elements.' },
  { name: 'Comparison prevention', tier: 'extended', aliases: ['price comparison prevention'],
    definition: 'Prices or features are presented so products are hard to compare (e.g. different units, bundles, per-payment pricing without a total).' },
  { name: 'Currency confusion', tier: 'extended', aliases: ['intermediate currency'],
    definition: 'Prices in coins, points or credits that obscure the real money cost.' },

  // Out of scope for single-page detection: only flagged when the page itself shows it
  { name: 'Hard to cancel', tier: 'out_of_scope', aliases: ['roach motel', 'roadblocks to cancellation'],
    definition: 'Easy to sign up but hard to cancel (e.g. "to cancel, call us", cancellation only through a long or hidden process).' },
  { name: 'Obstruction', tier: 'out_of_scope', aliases: ['immortal accounts'],
    definition: 'Barriers that make a task needlessly hard, such as deleting an account or reaching information.' },
  { name: 'Nagging', tier: 'out_of_scope', aliases: [],
    definition: 'Repeated interruptions asking the user to do something (e.g. pop-ups that keep returning, "Not now" with no "Never").' },
  { name: 'Addictive design', tier: 'out_of_scope', aliases: ['autoplay', 'infinite scroll'],
    definition: 'Design that exploits psychological vulnerabilities to keep the user engaged compulsively.' }
];

const DARK_PATTERN_TYPE_NAMES = DARK_PATTERN_TYPES.map(t => t.name);

const TIER_ORDER = { core: 0, extended: 1, out_of_scope: 2 };

function getPatternTypeInfo(name) {
  return DARK_PATTERN_TYPES.find(t => t.name === name) || null;
}
