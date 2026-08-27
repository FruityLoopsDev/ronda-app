# PROVISIONAL PATENT APPLICATION (DRAFT) — System & Method for Dynamic Encounter Scheduling with Recency-Weighted Memory and Constraint-Driven Optimization

> **Documento de trabajo para el agente de patentes.** Borrador de provisional US.
> **Instrucciones (ES):** este es el texto técnico en inglés listo para la USPTO. El agente lo
> revisará/ampliará y ajustará reivindicaciones. Vinculado a `docs/invention-disclosure-mem-rr-v2.md`
> (evidencia de concepción) y a `docs/ip-patent-strategy.md` (estrategia). NO es asesoría legal.

| Field | Value |
|---|---|
| **Title** | System and Method for Dynamically Scheduling Encounters in a Live Event Venue with Recency-Weighted Encounter Memory, Constraint-Driven Optimization, and Optimized Rest-Resource Allocation |
| **Applicant** | [RONDA — completar] |
| **Inventor(s)** | [completar] |
| **Docket** | RND-MEMRR-V2-PROV |
| **Date** | [fecha de presentación] |
| **Type** | Provisional (35 U.S.C. § 111(b)) — establece prioridad; 12 meses para Utility |

---

## FIELD OF THE INVENTION

The present disclosure relates generally to computer-implemented scheduling systems for live,
in-person events, and more particularly to a system and method for automatically generating and
dynamically reconfiguring seating/encounter assignments among a plurality of participants in a venue,
subject to hard constraints, using a recency-weighted memory of prior encounters and optimized
allocation of a rest resource.

## BACKGROUND OF THE INVENTION

Organized speed-dating events and network-rotation events assign participants to tables across a
sequence of rounds. Conventional scheduling approaches use a fixed "round-robin" rotation: one side
of participants remains seated while the other side rotates one position per round. While such a
rotation guarantees that each participant meets each participant of the opposite side once within a
night, it suffers from several technical deficiencies:

1. **No cross-night memory.** The rotation does not account for participants who have already met on a
   prior night, causing repeated, non-novel encounters.
2. **No constraint enforcement.** The fixed rotation cannot avoid seating pairs that are undesirable or
   prohibited (e.g., blocked/flagged users, orientation-incompatible participants, couples attending
   together, unverified users).
3. **Static planning.** The schedule is computed once and cannot adapt to real-time venue events, such
   as no-shows, late arrivals, early departures, or check-in events, which render the precomputed plan
   invalid.
4. **Blind rest-resource allocation.** When the number of participants is odd, a "rest" seat (e.g., a
   bar seat) is assigned by mechanical rotation, without fairness guarantees or consideration of the
   physical layout.
5. **No transition-cost awareness.** The rotation ignores the physical distance participants must walk
   between tables, which consumes limited transition time (e.g., a fixed two-minute interval between
   rounds in a venue).
6. **No auditable quality metrics.** There is no objective measure of schedule quality (novelty,
   coverage, fairness, transition distance) to allow host operators to verify or tune the schedule.

## SUMMARY OF THE INVENTION

The present invention addresses these deficiencies with a system and method that model the encounter
scheduling problem as a **constrained maximum-weight matching** over the set of participants plus at
least one ghost/rest node, solved per round (and per sequence of rounds), with:

- a **recency-weighted encounter memory**, where the cost of seating a pair that has previously met
  decays with elapsed time (a "forgetting curve") and is reduced when the pair previously achieved a
  mutual positive match (i.e., they already have an established channel);
- **hard constraints** encoded as prohibitions (blocked/flagged users, orientation-incompatible
  pairs, unverified users, couples attending together, age-range restrictions);
- **dynamic re-optimization** in response to real-time venue events, recomputing the remaining-round
  schedule with a hard constraint that prevents re-seating participants who have already met earlier
  in the current event ("already-met set");
- **infeasibility detection with graceful termination**, whereby if the maximum feasible number of
  rounds is reached while respecting hard constraints, the system terminates the schedule at its
  feasible maximum rather than violating a constraint;
- **optimized rest-resource allocation**, wherein the ghost/rest node is solved within the same
  optimization problem, guaranteeing that no participant rests more than once before all participants
  have rested once, with optional side-alternation and consumption-preference weighting;
- **transition-cost awareness** using a venue graph, so that the rotating side's physical movement
  between tables is minimized;
- **block-based seating** generalized to tables of capacity 4 (2+2) via block rotation; and
- an **instrumentation/metrics layer** producing auditable quality measures (novelty, coverage, rest
  fairness, transition distance).

## DETAILED DESCRIPTION

### 1. System Architecture

A scheduling system for a live event venue comprises:

- a **memory store** configured to maintain an encounter-history data structure associating pairs of
  participants with encounter metadata, including a total encounter count, a time elapsed since the
  most recent encounter, and a mutual-match flag;
- an **optimizer** configured to solve, for each round, a weighted matching problem over the set of
  participants and at least one rest (ghost) node, subject to a set of hard constraints;
- a **real-time constraint engine** configured to receive venue event data (e.g., check-in events from
  a scanning device, sensor events, presence updates) and to recompute the matching of the remaining
  rounds in response to said events;
- an **output interface** configured to emit table assignments and physical transition instructions to
  a display of a host device.

The components may be implemented on one or more computer processors with memory, in a client-server
architecture (e.g., a server-side optimizer communicating with a client device displaying assignments).

### 2. Weight Function

For a candidate pair (i, j), the optimizer computes a weight w(i, j) as a weighted combination:

```
w(i, j) = α·A(i, j) + β·F(i, j) − γ·R(i, j) − δ·D(i, j)
```

where:

- **A(i, j)** is an **affinity score** based on declared compatibility (e.g., orientation/gender
  compatibility as a hard filter) and soft signals such as age proximity and shared interests;
- **F(i, j)** is a **freshness score** implementing a forgetting curve. For pairs that have previously
  met, F is an increasing function of the time elapsed since the last encounter, e.g.,
  `F = 1 − exp(−λ·Δt)`, where λ is a decay parameter; for pairs that have never met, F = 1;
- **R(i, j)** is a **repeat-cumulative penalty** that aggregates historical encounters weighted by
  recency, e.g., `R = Σ_n exp(−λ·Δt_n)`, and is reduced (e.g., scaled by a factor less than one) when
  the pair previously achieved a mutual match;
- **D(i, j)** is a **transition-distance cost** derived from a venue graph, representing the physical
  distance between the pair's table positions, normalized by a maximum distance;
- α, β, γ, δ are non-negative calibratable weights.

If the pair violates a hard constraint, w(i, j) is set to a prohibitively negative value (a hard
penalty), removing the edge from the feasible matching.

### 3. Solvers

- **Bipartite (two-sided) standard format:** the optimization is formulated as a **minimum-cost
  maximum-flow** problem on a bipartite graph, with source→left-participant edges, left→right edges
  weighted by −w(i, j), right→sink edges, and, when one side is larger, ghost/rest nodes inserted on
  the smaller side. The exact solution is obtained by successive shortest-path augmentation.
- **General (mixed, e.g., open-format) groups:** the optimization is formulated as a maximum-weight
  perfect matching on a general graph. For small participant counts, an exact subset-DP solver is
  used; for larger counts, a multi-restart greedy-plus-2-opt local-search heuristic is used. (An exact
  blossom-based solver may be substituted without loss of generality.)

### 4. Rest-Resource (Ghost) Optimization

Rather than assigning the rest seat by mechanical rotation, the ghost/rest node is included in the
optimization graph. The optimizer elects which participant rests each round subject to: (a) no
participant rests more than once before every participant has rested at least once; and (b) optional
side alternation. The rest weight may be parameterized to prefer participants with higher
consumption propensity (where resting corresponds to bar consumption).

### 5. Fairness (Lexicographic Max-Min)

The per-round optimizer maximizes total weight; the round-sequence planner applies a lexicographic
objective that first minimizes the maximum number of re-encounters per participant, then maximizes the
total number of novel encounters, then minimizes maximum rests, then minimizes total transition
distance.

### 6. Dynamic Re-Optimization and Infeasibility

When the composition of the participant set changes (e.g., a check-in event, a no-show, a departure),
the system recomputes the plan for the remaining rounds. An "already-met" set (pairs seated earlier in
the current event) is treated as a hard constraint in the recomputation, guaranteeing novelty relative
to the prior plan. If, due to hard constraints, the flow is forced to use a prohibited edge, the system
detects the infeasibility and terminates the night at its maximum feasible round count rather than
seating a prohibited pair.

### 7. Block-Based Seating (Tables of Capacity 4)

For tables of capacity four, participants on each side are grouped into blocks of two, and the
rotation operates on blocks (block index rotation), so that each table seats a 2+2 arrangement. Each
block pairing contributes the sum of the pairwise weights of all cross-block person pairs.

### 8. Metrics / Instrumentation

The system computes and exposes auditable metrics including: novelty (fresh-face count), coverage
percentage, maximum re-encounters per participant, rest-allocation Gini coefficient, and transition
distance, enabling host verification and SaaS-grade quality reporting.

### 9. Example Integration

In an illustrative embodiment, a host device displays a button to activate a camera-based QR scanner.
A participant device displays a machine-readable code encoding a check-in payload (e.g., a
participant identifier). Upon decoding, the host registers the participant's presence by adding them
to the event's participant set, which triggers the real-time constraint engine to recompute the
remaining-round schedule. Participant devices subscribe to the event and render the live
assignments/round as the host updates them. Encounter history is persisted (e.g., in a cloud
database) and read back at the start of a subsequent night, so that the recency-weighted memory
continues to improve with use.

## CLAIMS (DRAFT)

1. A computer-implemented system for scheduling encounters in a live event venue, comprising:
   a memory store configured to maintain an encounter history associating pairs of participants with
   encounter metadata including at least one of a total encounter count, a time elapsed since a most
   recent encounter, and a mutual-match flag; an optimizer configured to solve, for a round, a
   maximum-weight matching problem over a set of participants and at least one rest node, subject to a
   set of hard constraints, using a weight function that penalizes encounters of pairs whose recency
   is high and reduces said penalty when the pair has a recorded mutual match; a real-time constraint
   engine configured to recompute the matching of remaining rounds in response to a change in the
   participant set; and an output interface configured to emit table assignments to a display device.

2. The system of claim 1, wherein the weight function comprises a freshness term that increases with
   the time elapsed since a last encounter and a repetition-penalty term that aggregates historical
   encounters weighted by an exponential decay of recency.

3. The system of claim 1, wherein the optimizer applies a lexicographic objective that minimizes a
   maximum number of re-encounters per participant before maximizing a total number of novel
   encounters.

4. The system of claim 1, wherein the at least one rest node is solved within the matching problem,
   and the optimizer prevents any participant from resting more than once before every participant has
   rested at least once.

5. The system of claim 1, wherein the real-time constraint engine is responsive to a check-in event
   from a device that decodes a machine-readable code carried by a participant, and registers the
   participant's presence by updating the participant set.

6. The system of claim 1, wherein the weight function further comprises a transition-distance term
   derived from a venue graph representing distances between table positions.

7. The system of claim 1, wherein the optimizer operates on blocks of participants for tables of
   capacity four.

8. The system of claim 1, wherein, when a round cannot be completed without violating a hard
   constraint, the system terminates the schedule at a maximum feasible number of rounds.

9. The system of claim 1, wherein the memory store persists the encounter history across events and
   reads it at the start of a later event.

10. A method for scheduling encounters in a live event venue, comprising: maintaining an encounter
    history associating pairs of participants with encounter metadata; solving, for a round, a
    maximum-weight matching problem over a set of participants and at least one rest node, subject to
    hard constraints, using a weight function that penalizes encounters of pairs whose recency is high
    and reduces the penalty when the pair has a recorded mutual match; recomputing the matching of
    remaining rounds in response to a change in the participant set; and emitting table assignments.

## ABSTRACT

A system and method for scheduling encounters in a live event venue. The system maintains a
recency-weighted encounter history, solves a constrained maximum-weight matching per round over
participants plus a rest node, re-optimizes remaining rounds in real time in response to venue events,
detects and gracefully terminates on hard infeasibility, and emits table assignments and transition
instructions, optionally accounting for physical venue layout.

---
*Prepared as an input for the patent attorney. Not legal advice.*
