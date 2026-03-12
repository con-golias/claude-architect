# Logic Programming

> **Domain:** Fundamentals > Programming Paradigms > Declarative
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Logic programming expresses computation as **logical facts and rules**, then queries the system to find solutions. The programmer defines *what* is true (relationships, constraints), and the runtime uses **unification and backtracking** to derive answers. The canonical language is Prolog (1972).

**Key Concepts:** facts, rules, queries, unification, backtracking, Horn clauses.

## How It Works

```prolog
% Prolog — facts (things we know to be true)
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).
male(tom).
male(bob).
female(liz).
female(ann).
female(pat).

% Rules (derived relationships)
father(X, Y) :- parent(X, Y), male(X).
mother(X, Y) :- parent(X, Y), female(X).

grandparent(X, Z) :- parent(X, Y), parent(Y, Z).

sibling(X, Y) :- parent(P, X), parent(P, Y), X \= Y.

ancestor(X, Y) :- parent(X, Y).                      % base case
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).      % recursive

% Queries
?- father(tom, bob).          % true
?- grandparent(tom, ann).     % true
?- sibling(ann, pat).         % true
?- ancestor(tom, ann).        % true
?- grandparent(tom, Who).     % Who = ann ; Who = pat
```

```prolog
% Prolog — list operations
% append/3 — works bidirectionally!
append([], L, L).
append([H|T1], L2, [H|T3]) :- append(T1, L2, T3).

?- append([1,2], [3,4], X).     % X = [1,2,3,4]
?- append(X, [3,4], [1,2,3,4]). % X = [1,2] — Prolog runs it "backwards"!
?- append(X, Y, [1,2,3]).       % X=[], Y=[1,2,3] ; X=[1], Y=[2,3] ; ...

% Sorting
sorted([]).
sorted([_]).
sorted([A,B|T]) :- A =< B, sorted([B|T]).

permutation([], []).
permutation(List, [H|Perm]) :-
    select(H, List, Rest),
    permutation(Rest, Perm).

% Sort by generating permutations and checking — declarative but slow!
slow_sort(List, Sorted) :- permutation(List, Sorted), sorted(Sorted).
```

```prolog
% Sudoku solver in Prolog (constraint logic programming)
:- use_module(library(clpfd)).

sudoku(Rows) :-
    length(Rows, 9),
    maplist(same_length(Rows), Rows),
    append(Rows, Vs), Vs ins 1..9,
    maplist(all_distinct, Rows),
    transpose(Rows, Columns),
    maplist(all_distinct, Columns),
    Rows = [A,B,C,D,E,F,G,H,I],
    blocks(A, B, C), blocks(D, E, F), blocks(G, H, I).

blocks([], [], []).
blocks([A,B,C|T1], [D,E,F|T2], [G,H,I|T3]) :-
    all_distinct([A,B,C,D,E,F,G,H,I]),
    blocks(T1, T2, T3).
```

### Datalog — Logic Programming for Databases

```
% Datalog — restricted Prolog for querying (guaranteed termination)
parent(tom, bob).
parent(bob, ann).

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).

?- ancestor(tom, ann).  % true — derived through two rules

% Used in: Datomic (database), static analysis tools, Souffle (Datalog engine)
```

### Logic Programming vs Other Paradigms

```
Paradigm           Programmer specifies          System provides
──────────────────────────────────────────────────────────────
Imperative         Step-by-step instructions     Execution
Functional         Function transformations      Evaluation
Logic              Facts + Rules + Query          Search for solutions
Constraint         Variables + Constraints        Constraint solving

Logic programming excels when:
  - The problem is naturally expressed as relationships
  - You need to search a solution space
  - Rules change frequently (just add/remove facts)
  - Bidirectional reasoning is needed
```

## Real-world Examples

- **Erlang pattern matching** — inspired by Prolog unification.
- **Datalog engines** — Souffle, Datomic, LogicBlox for program analysis.
- **Type inference** — Hindley-Milner uses unification (Prolog-like).
- **Expert systems** — medical diagnosis, legal reasoning.
- **Natural language processing** — grammar parsing with definite clause grammars.
- **Static analysis** — Facebook Infer, CodeQL use Datalog-like engines.

## Sources

- Kowalski, R.A. (1974). "Predicate Logic as Programming Language." *IFIP Congress*.
- Colmerauer, A. & Roussel, P. (1993). "The Birth of Prolog." *ACM SIGPLAN Notices*.
- Sterling, L. & Shapiro, E. (1994). *The Art of Prolog*. 2nd ed. MIT Press.
