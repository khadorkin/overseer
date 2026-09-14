# Slop prevention research

Use this analysis when evaluating lint policy, parser-API enforcement, complexity-driven refactors,
or unused workspace exports. These are proposals, not installed rules. The root `vite.config.ts` and
the plugin entrypoints it loads own enforcement; [`coding-standards.md`](../coding-standards.md) owns
current engineering policy. The installed tooling boundary is recorded in
[`oxlint-custom-type-aware-rules.md`](oxlint-custom-type-aware-rules.md).

## Establish actual enforcement

Before evaluating a proposal, follow
[`Revalidate repository facts`](oxlint-custom-type-aware-rules.md#revalidate-repository-facts) to
identify the active command path, root configuration, plugin entrypoints, resolved APIs, and dated
probe evidence. That research section is the authority for the root-versus-bundled toolchain split
and JavaScript-plugin type-information limit.

## Pilot unnecessary-condition lint

`typescript/no-unnecessary-condition` is a native type-aware pilot candidate. Evaluate it with
intentional constant loops allowed, then classify every diagnostic against its producer and runtime
boundary. Declaration files and SQL generic annotations do not prove external runtime integrity, so
an apparently redundant guard may still own validation that must move to a schema rather than
vanish.

**Complete when:** intentional loops and declaration/runtime trust have fixtures or focused tests;
every diagnostic has an honest correction or a documented rule limitation; and genuine boundary,
cross-field, and corruption validation remains observable. This rule finds type-impossible guards,
not repeated parsing or persistence precedence errors.

## Propose narrow exported decoder enforcement

Candidate: `anti-slop-effect/no-exported-schema-decoder-factory`. Diagnose direct exports and
export-list aliases of Schema-generated decoder functions when they expose library `ParseOptions`
as an application API. Resolve Effect import aliases and exported bindings instead of matching
identifier text. Prefer a private reusable codec plus a domain-named unary wrapper with the codec's
actual `Encoded` input type.

The rule must permit deliberately public low-level codec APIs whose real contract includes unknown
input or parse options. It cannot infer the correct input provenance. In particular,
`Schema.decodeEffect` accepts the codec's `Encoded` type: a raw string is not a valid substitution
for a literal-union encoded type, and no autofix may insert a cast. Unknown decoding remains correct
at honest raw I/O boundaries.

The installed `anti-slop/no-unknown-parameters` diagnostic currently tells a genuine I/O Adapter to
expose `Schema.decodeUnknownEffect(ExpectedSchema)`. That wording conflicts with the application API
default above, which keeps the decoder private unless unknown input and parse options are the real
public contract. This docs-only work leaves the diagnostic unchanged; reconcile its implementation
and fixtures in a separately scoped lint-rule follow-up before enabling this candidate. Aliases or
casts are not a workaround.

**Complete when:** RuleTester fixtures cover direct exports, export aliases, renamed Schema imports,
unrelated same-name functions, private-codec/unary-wrapper pairs, and intentional low-level codec
APIs; the diagnostic offers no provenance-guessing autofix; and the installed unknown-parameter
rule gives compatible guidance.

## Keep semantic review out of same-call AST rules

Duplicate validation, repeated reads, persistence selection, transaction order, cross-field
refinements, and actual runtime work removed are data-flow questions. Identical calls can enforce
different boundaries. Verify them through public behavior, real SQLite where applicable, corruption
and precedence cases, and migration/restart evidence rather than a same-call-count rule.

JavaScript Oxlint plugins receive Oxc syntax and scopes but no TypeScript inferred types even when
root typechecking is enabled. Keep syntax rules conservative. If recurring semantic false negatives
justify another checker, apply the decision in
[`oxlint-custom-type-aware-rules.md`](oxlint-custom-type-aware-rules.md) rather than loading a
compiler inside a JavaScript plugin.

## Audit workspace exports before removing them

Review consumers across production, tests, declarations, re-exports, package entrypoints,
type-only imports, dynamic loading, and external SDK contracts. Remove an export only when that
evidence shows it is private and unused. Prefer an existing workspace-aware tool if this recurs;
do not treat ordinary unused-variable results as proof that an export has no consumer.

## Complexity review

Use the repository's actual configured policy. Extract cohesive responsibilities while retaining
precise domain inputs, tagged errors, Effect requirements, transaction/effect order, and recovery
evidence. Smaller branch counts, forwarding helpers, speculative generics, dispatch tables,
suppressions, or option bags are not acceptance evidence.
