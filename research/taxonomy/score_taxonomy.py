"""
Evidence-based prioritisation of dark-pattern types for the detector.

Score(type) = Detectability x (wP * Prevalence + wR * Regulation)

- Prevalence: how often the type is observed in published sweeps/datasets
  (data/prevalence.csv). Each source is normalised to 0-1 on its own scale
  (sources measure different things), then averaged over the sources that
  report the type.
- Regulation: how strongly the type is legislated and enforced worldwide
  (deceptive.design law/enforcement counts) and how many independent
  regulatory frameworks name it (data/frameworks.csv).
- Detectability: whether a single-page scanner can observe it
  (data/detectability.csv). Multiplicative, because a type the extension
  cannot see is not a target however common it is.

A Monte Carlo sensitivity analysis varies the weights, the normalisation,
the detectability levels and an ambiguous source mapping, and reports how
often each type stays in the selected set.

Usage: python score_taxonomy.py   (writes results/ and figures/)
"""
import csv
import math
import os
import random
from collections import defaultdict

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RESULTS = os.path.join(HERE, 'results')
FIGURES = os.path.join(HERE, 'figures')

COVERAGE_TARGET = 0.80   # selected set must cover >= 80% of observed instances
ROBUST_SHARE = 0.90      # "robust" = selected in >= 90% of simulations
SIMULATIONS = 10000
SEED = 42


def read_csv(name):
    with open(os.path.join(DATA, name), encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def load():
    types = read_csv('types.csv')
    names = [t['type'] for t in types]
    laws = {t['type']: int(t['deceptive_design_laws']) for t in types}
    enforcements = {t['type']: int(t['deceptive_design_enforcements']) for t in types}

    prevalence_rows = read_csv('prevalence.csv')

    frameworks = {}
    for row in read_csv('frameworks.csv'):
        cols = [c for c in row if c not in ('type', 'mapping_note')]
        frameworks[row['type']] = sum(int(row[c]) for c in cols) / len(cols)

    detectability = {r['type']: float(r['detectability']) for r in read_csv('detectability.csv')}

    for table, label in ((frameworks, 'frameworks.csv'), (detectability, 'detectability.csv')):
        missing = set(names) - set(table)
        if missing:
            raise ValueError(f'{label} is missing types: {sorted(missing)}')

    return names, laws, enforcements, prevalence_rows, frameworks, detectability


def source_shares(prevalence_rows, pressured_selling_to='Preselection'):
    """Per source, the share of that source's observations attributed to each type."""
    shares = defaultdict(lambda: defaultdict(float))
    for row in prevalence_rows:
        type_name = row['type']
        if row['source_label'] == 'Pressured Selling':
            type_name = pressured_selling_to
        shares[row['source']][type_name] += float(row['count']) / float(row['denominator'])
    return shares


def normalise(values, method):
    """Scale a {type: value} dict to 0-1 within one source."""
    if method == 'linear':
        top = max(values.values())
        return {k: v / top for k, v in values.items()}
    if method == 'log':
        # log1p on a common scale so tiny shares are not flattened to zero
        scaled = {k: math.log1p(v * 1000) for k, v in values.items()}
        top = max(scaled.values())
        return {k: v / top for k, v in scaled.items()}
    if method == 'rank':
        ordered = sorted(values, key=values.get)
        if len(ordered) == 1:
            return {ordered[0]: 1.0}
        return {k: i / (len(ordered) - 1) for i, k in enumerate(ordered)}
    raise ValueError(method)


def prevalence_scores(names, shares, method):
    per_type = defaultdict(list)
    for source, values in shares.items():
        for type_name, value in normalise(values, method).items():
            per_type[type_name].append(value)
    # Types no source reports get 0: no observed evidence of prevalence
    return {n: (sum(per_type[n]) / len(per_type[n]) if per_type[n] else 0.0) for n in names}


def regulation_scores(names, laws, enforcements, frameworks):
    max_laws = math.log1p(max(laws.values()))
    max_enf = math.log1p(max(enforcements.values()))
    return {
        n: (math.log1p(laws[n]) / max_laws + math.log1p(enforcements[n]) / max_enf + frameworks[n]) / 3
        for n in names
    }


def total_scores(names, prevalence, regulation, detectability, w_prevalence):
    return {
        n: detectability[n] * (w_prevalence * prevalence[n] + (1 - w_prevalence) * regulation[n])
        for n in names
    }


def mathur_counts(prevalence_rows, pressured_selling_to='Preselection'):
    counts = defaultdict(float)
    for row in prevalence_rows:
        if row['source'] != 'mathur2019':
            continue
        type_name = pressured_selling_to if row['source_label'] == 'Pressured Selling' else row['type']
        counts[type_name] += float(row['count'])
    return counts


def coverage(chosen, shares, detectability):
    """
    Mean, over sources, of the share of *observable* instances the chosen types
    cover. Each source's mass is weighted by detectability, so occurrences a
    single-page scanner could never see don't count towards the target.
    """
    per_source = []
    for values in shares.values():
        observable = {n: v * detectability[n] for n, v in values.items()}
        total = sum(observable.values())
        if total > 0:
            per_source.append(sum(observable.get(n, 0.0) for n in chosen) / total)
    return sum(per_source) / len(per_source)


def select(ranking, shares, detectability):
    """Smallest top-of-ranking set whose mean observable coverage reaches COVERAGE_TARGET."""
    chosen = []
    for type_name in ranking:
        chosen.append(type_name)
        if coverage(chosen, shares, detectability) >= COVERAGE_TARGET:
            break
    return chosen


def baseline(names, laws, enforcements, prevalence_rows, frameworks, detectability):
    shares = source_shares(prevalence_rows)
    prevalence = prevalence_scores(names, shares, 'linear')
    regulation = regulation_scores(names, laws, enforcements, frameworks)
    scores = total_scores(names, prevalence, regulation, detectability, 0.5)
    ranking = sorted(names, key=lambda n: -scores[n])
    return prevalence, regulation, scores, ranking


def sensitivity(names, laws, enforcements, prevalence_rows, frameworks, detectability):
    rng = random.Random(SEED)
    regulation = regulation_scores(names, laws, enforcements, frameworks)
    selected_count = defaultdict(int)
    rank_sum = defaultdict(float)
    set_sizes = []

    for _ in range(SIMULATIONS):
        method = rng.choice(['linear', 'log', 'rank'])
        mapping = rng.choice(['Preselection', 'Visual interference'])
        w_prevalence = rng.random()  # uniform = Dirichlet(1, 1) over two weights
        jittered = {
            n: min(1.0, max(0.0, d + rng.choice([-0.25, 0.0, 0.25]))) for n, d in detectability.items()
        }
        shares = source_shares(prevalence_rows, mapping)
        prevalence = prevalence_scores(names, shares, method)
        scores = total_scores(names, prevalence, regulation, jittered, w_prevalence)
        ranking = sorted(names, key=lambda n: -scores[n])
        chosen = select(ranking, shares, jittered)
        set_sizes.append(len(chosen))
        for n in chosen:
            selected_count[n] += 1
        for i, n in enumerate(ranking):
            rank_sum[n] += i + 1

    return (
        {n: selected_count[n] / SIMULATIONS for n in names},
        {n: rank_sum[n] / SIMULATIONS for n in names},
        set_sizes,
    )


def write_csv(path, header, rows):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def main():
    os.makedirs(RESULTS, exist_ok=True)
    os.makedirs(FIGURES, exist_ok=True)
    names, laws, enforcements, prevalence_rows, frameworks, detectability = load()

    prevalence, regulation, scores, ranking = baseline(
        names, laws, enforcements, prevalence_rows, frameworks, detectability)
    counts = mathur_counts(prevalence_rows)
    shares = source_shares(prevalence_rows)
    chosen = select(ranking, shares, detectability)
    selected_share, mean_rank, set_sizes = sensitivity(
        names, laws, enforcements, prevalence_rows, frameworks, detectability)

    def tier(n):
        if detectability[n] == 0:
            return 'Out of scope (not observable on one page)'
        if selected_share[n] >= ROBUST_SHARE:
            return 'Core'
        if n in chosen or selected_share[n] >= 0.5:
            return 'Core (weight-sensitive)'
        return 'Extended'

    rows = []
    for i, n in enumerate(ranking, 1):
        cumulative = coverage(ranking[:i], shares, detectability)
        rows.append([
            i, n, f'{scores[n]:.3f}', f'{prevalence[n]:.3f}', f'{regulation[n]:.3f}',
            f'{detectability[n]:.2f}', int(counts.get(n, 0)), f'{cumulative:.3f}',
            f'{selected_share[n]:.3f}', f'{mean_rank[n]:.1f}', tier(n),
        ])
    write_csv(os.path.join(RESULTS, 'ranking.csv'),
              ['rank', 'type', 'score', 'prevalence', 'regulation', 'detectability',
               'mathur_instances', 'cumulative_observable_coverage', 'selected_in_simulations',
               'mean_rank_in_simulations', 'tier'], rows)

    size_hist = defaultdict(int)
    for s in set_sizes:
        size_hist[s] += 1
    write_csv(os.path.join(RESULTS, 'selected_set_size.csv'), ['set_size', 'simulations'],
              sorted(size_hist.items()))

    # Figure 1: score breakdown
    fig, ax = plt.subplots(figsize=(9, 6))
    ordered = list(reversed(ranking))
    ax.barh(ordered, [scores[n] for n in ordered], color=['#2a6fdb' if n in chosen else '#b8c4d6' for n in ordered])
    ax.set_xlabel('Priority score = D x (0.5 P + 0.5 R)')
    ax.set_title('Dark-pattern types ranked by priority (selected set highlighted)')
    fig.tight_layout()
    fig.savefig(os.path.join(FIGURES, 'priority_ranking.png'), dpi=150)
    plt.close(fig)

    # Figure 2: coverage curve
    fig, ax = plt.subplots(figsize=(9, 5))
    cum = [float(r[7]) for r in rows]
    ax.plot(range(1, len(cum) + 1), cum, marker='o', color='#2a6fdb')
    ax.axhline(COVERAGE_TARGET, linestyle='--', color='#d9534f', label=f'{int(COVERAGE_TARGET * 100)}% coverage target')
    ax.axvline(len(chosen), linestyle=':', color='#555', label=f'selected set: {len(chosen)} types')
    ax.set_xticks(range(1, len(ranking) + 1))
    ax.set_xticklabels(ranking, rotation=60, ha='right', fontsize=8)
    ax.set_ylabel('Cumulative observable coverage\n(mean of Mathur 2019, EU CPC 2023, ICPEN 2024)')
    ax.set_ylim(0, 1.02)
    ax.legend(loc='lower right')
    fig.tight_layout()
    fig.savefig(os.path.join(FIGURES, 'coverage_curve.png'), dpi=150)
    plt.close(fig)

    # Figure 3: robustness
    fig, ax = plt.subplots(figsize=(9, 6))
    by_share = sorted(names, key=lambda n: selected_share[n])
    ax.barh(by_share, [selected_share[n] for n in by_share], color='#5cb85c')
    ax.axvline(ROBUST_SHARE, linestyle='--', color='#d9534f', label=f'{int(ROBUST_SHARE * 100)}% robustness threshold')
    ax.set_xlabel(f'Share of {SIMULATIONS:,} simulations in which the type is selected')
    ax.set_title('Robustness to weights, normalisation, detectability and mapping choices')
    ax.legend(loc='lower right')
    fig.tight_layout()
    fig.savefig(os.path.join(FIGURES, 'robustness.png'), dpi=150)
    plt.close(fig)

    print(f'{"#":>2}  {"type":22} {"score":>6} {"P":>6} {"R":>6} {"D":>5} {"cover":>6} {"robust":>7}  tier')
    for r in rows:
        print(f'{r[0]:>2}  {r[1]:22} {r[2]:>6} {r[3]:>6} {r[4]:>6} {r[5]:>5} {r[7]:>6} {r[8]:>7}  {r[10]}')
    print(f'\nBaseline selected set ({len(chosen)} types, >= {int(COVERAGE_TARGET * 100)}% coverage): {", ".join(chosen)}')
    print('Selected set size across simulations:', dict(sorted(size_hist.items())))


if __name__ == '__main__':
    main()
