# What Dark Patterns Detector looks for, and why

Dark patterns are design tricks that push you into choices you might not otherwise make, like buying sooner, spending more or sharing more. This page lists the types the extension detects, what each one looks like, and how we decided which ones to focus on.

> **Detected doesn't mean proven fake.** The extension can see that a page shows a countdown timer, a low-stock message or a crossed-out M.R.P., but it can't check whether the timer resets, whether stock is really low, or whether the product ever sold at that price. It flags these as **pressure tactics** so you can decide for yourself.

---

## Core types
These are the types we prioritise, based on how common they are, how strongly regulators act on them, and whether they're visible on a single page.

| Type | What it looks like | Example |
|---|---|---|
| **Fake scarcity** | Claims of limited stock or high demand that push you to buy now | "Only 2 left in stock – order soon", "20 people have this in their cart" |
| **Fake urgency** | A time limit that pressures you to decide quickly | "Deal ends in 04:59:12", "Offer valid today only" |
| **Fake social proof** | Claims about other people's activity or opinions to make something seem popular | "500+ bought in past month", "Priya from Pune just bought this" |
| **Confirmshaming** | Wording that guilts or shames you for saying no | "No thanks, I don't like saving money" |
| **Trick wording** | Confusing language, often double negatives, that leads you to the opposite choice | "Uncheck this box if you don't want to not receive offers" |
| **Preselection** | An option that benefits the business is already ticked for you | A pre-ticked "Add 1-year extended warranty for ₹299" |
| **Hidden subscription** | You're enrolled in recurring payments without a clear, upfront disclosure | "Start free trial" that renews at ₹999/month in small print |
| **Forced action** | You must do something unwanted to get what you came for | "Create an account to continue", card details required for a free trial |
| **Sneaking** | Items are added, or key information is hidden, without your clear consent | An add-on or donation automatically placed in your cart |
| **False discount** | A discount shown against a reference price that may be inflated | "M.R.P. ₹4,999 → ₹529 (89% off)" when the product never sold at ₹4,999 |

## Extended types
These are detected on a best-effort basis. They're common or regulated, but often only partly visible on one page (for example, costs that only appear at checkout).

| Type | What it looks like | Example |
|---|---|---|
| **Hidden costs** | Fees that appear late in the purchase | A "convenience fee" or "platform fee" added at checkout |
| **Visual interference** | Design that steers your attention to the business's preferred option | A big bright "Keep subscription" button next to a tiny grey "cancel" link |
| **Disguised ads** | Ads made to look like regular content or results | A "recommended" product that is actually a paid placement |
| **Comparison prevention** | Prices presented so products are hard to compare | Different units, or per-week pricing without the total |
| **Currency confusion** | Prices in coins or points that hide the real cost | "Unlock for 500 gems" |

## Flagged only when the page shows it
These types usually need several steps, or observation over time, to confirm. A single-page scan can't reliably detect them, but the extension flags them when the evidence is visible on the page you scan.

| Type | Also known as | Example |
|---|---|---|
| **Hard to cancel** | Roach motel | "To cancel your membership, please call our support line" |
| **Obstruction** | Immortal accounts | No visible way to delete your account |
| **Nagging** | | A pop-up that keeps coming back, with "Not now" but never "No" |
| **Addictive design** | Autoplay, infinite scroll | The next video plays automatically |

---

## How we chose these types
We didn't pick these types by intuition. We ranked 19 candidates using published evidence:

**Score = Detectability × (Prevalence + Regulation)**

- **Prevalence:** how often each type appears in real websites, combining four independent studies:
  - Mathur et al. (2019): 1,818 dark patterns found across ~11,000 shopping sites
  - EU consumer authorities' 2023 sweep: 399 online shops
  - ICPEN's 2024 international sweep: 642 subscription sellers
  - Our own user study (Kulkarni et al.): 351 detections on Indian sites including Flipkart, Myntra and Amazon.in
- **Regulation:** how many laws and enforcement actions target each type (from [deceptive.design](https://www.deceptive.design/types)), and whether the OECD (2022), the US FTC (2022) and India's CCPA (2023) name it.
- **Detectability:** whether the type can be seen on one page at all. Types that need several steps (like a roach motel) score zero here, however common they are.

We then kept the smallest set of top-ranked types that covers **at least 80% of real-world occurrences** across all four studies. To make sure the result isn't an artefact of our assumptions, we re-ran the ranking **10,000 times** with different weights, scoring methods and detectability levels:
- **Fake scarcity, fake urgency and fake social proof** were selected in at least 99.6% of runs.
- The other core types were selected in 50–86% of runs.

Full data, sources, charts and the reproducible script are in [`research/taxonomy`](../research/taxonomy/README.md).

**Further reading:** [deceptive.design](https://www.deceptive.design/types) · [OECD Dark Commercial Patterns (2022)](https://doi.org/10.1787/44f5e846-en) · [FTC, Bringing Dark Patterns to Light (2022)](https://www.ftc.gov/reports/bringing-dark-patterns-light)
