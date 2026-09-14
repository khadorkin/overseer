# Type-aware custom Oxlint rules: dependency and architecture research

**Research date:** 2026-08-08; installed-tooling revalidation 2026-09-05

**Scope:** the repository's installed Oxlint, Vite+, plugin, tsgolint, and TypeScript packages; first-party documentation; pinned package source; and this repository. Installed API facts marked 2026-09-05 were revalidated then; upstream issue, roadmap, and project-status statements remain evidence from the original 2026-08-08 research unless explicitly marked otherwise. No application, configuration, dependency, or lint code was changed.

## Recommendation

**Do not add `typescript`, `@typescript-eslint/utils`, `ts-morph`, or tsquery to the existing Oxlint JavaScript plugin in an attempt to make its rules semantic.** Both installed plugin API copies give JavaScript plugins an empty `parserServices` object, and Oxlint's separate `tsgolint` process does not expose its TypeScript program or checker to JavaScript. Importing a compiler in the plugin would create a second, plugin-owned project model; it would not reuse Oxlint/tsgolint's programs, AST, source overlays, project assignment, or caches.

For the three rules:

1. **Keep `anti-slop/no-chained-type-assertions` as a syntax-only Oxlint JS rule.** Its question—whether assertion nodes are nested, except an all-`const` chain—is syntactic. Type information would add cost without improving that invariant.
2. **Keep the existing conservative syntax checks for `no-known-value-widening` and `no-widen-then-assert` for immediate, cheap Oxlint feedback.** Their current source and tests intentionally stop where provenance cannot be established syntactically.
3. **If the repository decides the currently documented false-negative space must be enforced, add one separate, read-only semantic checker using the TypeScript compiler API—not code inside the Oxlint plugin.** Run it once per check, group files by owning `tsconfig`, create/reuse one program per project, and add diagnostics only for semantic cases the JS rules intentionally skip (for example imported values, typed call results, resolved aliases, and symbol-identified local flows). At that point, add an explicit root `devDependency` matching the workspace compiler version selected by the installed toolchain. Do not rely on an app dependency or hoisted/transitive resolution.
4. Treat a small, separate ESLint + typescript-eslint pass as the fallback when editor-integrated custom semantic lint diagnostics are more valuable than dependency/startup cost. Use `@typescript-eslint/parser` with `parserOptions.projectService: true` and write the rules with `@typescript-eslint/utils`; do not try to run those typed rules through Oxlint.
5. Long term, propose generic versions upstream to typescript-eslint and then tsgolint. Do not fork either Oxc or tsgolint for three repository policy rules unless maintaining a compiler-coupled toolchain fork is explicitly acceptable.

This means the answer to “should this repo add a TypeScript AST/type-checker dependency to make its custom Oxlint JS rules semantic?” is **no**. The answer becomes **yes, add only a direct `typescript` dependency** if and when a dedicated checker is approved as a separate check.

## Revalidate repository facts

Read the [root package](../../package.json), [lint config](../../vite.config.ts), local plugin
entrypoints, workspace manifests, and project configs. Run `vp --version`; compare direct
`oxlint --version` and resolve each command's Oxlint/plugin manifests when the distinction matters.

The 2026-09-05 probe established these interpretation-sensitive facts:

- The root direct command and Vite+'s bundled toolchain resolved different Oxlint/plugin copies.
  Claims about plugin behavior must name the path actually exercised.
- Both resolved JavaScript-plugin APIs/runtimes exposed AST and scope services with empty
  `parserServices`; enabling root typechecking did not add TypeScript inference to custom rules.
- Root tooling did not directly own the workspace TypeScript dependency. A future root semantic
  checker therefore needs its own direct compiler dependency matching the installed toolchain.
- Root lint configuration enabled native type-aware assertion rules and the local `anti-slop` and
  `overseer` syntax plugins. The unnecessary-condition and exported-decoder-factory rules remained
  proposals; see [`slop-prevention.md`](slop-prevention.md).
- The root config covers tooling while apps and packages own project configs. A future checker must
  group files by their current owning configs rather than build one broad synthetic program
  ([root tsconfig](../../tsconfig.json), [API tsconfig](../../apps/api/tsconfig.json),
  [workspace config](../../pnpm-workspace.yaml)).

## What Oxlint officially supports

### JS plugins do not receive type information

At the original 2026-08-08 research point, Oxlint's JS-plugin guide listed AST traversal, source text/tokens, scope analysis, and control-flow analysis as supported, while listing TypeScript type-aware plugin rules as unsupported. JavaScript plugins were documented as alpha, and the alpha announcement stated “No custom type-aware rules” ([JS plugins: API support](https://oxc.rs/docs/guide/usage/linter/js-plugins.html#api-support), [JS plugins alpha: limitations](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html#what-it-can-t-do-yet)). The installed empty-`parserServices` probe below, rather than an unrefreshed upstream-status claim, supports the repository decision.

Resolved package source is stronger evidence than an assumed API shape. For both the root direct
command and Vite+'s bundled path, resolve `@oxlint/plugins` and Oxlint from that command, then inspect
`SourceCode.parserServices` in the plugin types and its runtime initialization. The 2026-09-05 probe
found `Readonly<Record<string, unknown>>` documented as unavailable and a frozen empty runtime
object in both paths. The [older tagged source](https://github.com/oxc-project/oxc/blob/oxlint_v1.76.0/apps/oxlint/src-js/plugins/source_code.ts#L228-L234)
is historical corroboration only.

Consequently, `options.typeAware: true` does **not** enrich a JS rule context. It starts a different backend for registered `typescript/*` rules.

### Original upstream status evidence

On 2026-08-08, two first-party issues tracked the gap:

- [`sourceCode.parserServices` is always empty](https://github.com/oxc-project/oxc/issues/19962) recorded that typed ESLint-compatible rules either silently stopped or could not obtain `program` and node maps. A maintainer described type-aware rules as unsupported and the problem as hard.
- [Make type information available to custom JS plugins](https://github.com/oxc-project/oxc/issues/19596) was open. A maintainer explained that typescript-go did not expose type information consumable by JavaScript plugins and that repeated Go/JavaScript boundary crossings risked destroying performance; the latest update reviewed then reported no progress.

At that research point, Oxlint expressed an aspiration to complete the plugin API without a released parser-services API, target release, or actionable design. Recheck the issues before making a current roadmap claim; the installed API remains the implementation authority.

### Oxlint type-aware rules are a separate tsgolint pipeline

Oxlint's type-aware guide describes the split: Oxlint handles traversal/configuration/reporting, while tsgolint builds TypeScript programs using typescript-go and runs semantic rules ([Type-Aware Linting: overview](https://oxc.rs/docs/guide/usage/linter/type-aware.html#overview)). The tagged Oxc source sends tsgolint only grouped file paths, names/options for rules already marked as tsgolint rules, optional source overlays, and whether to report compiler diagnostics ([1.76.0 tsgolint payload construction](https://github.com/oxc-project/oxc/blob/oxlint_v1.76.0/crates/oxc_linter/src/tsgolint.rs#L526-L589)). It sends no JS plugin module or callback.

This separation is why a JS plugin cannot “reach sideways” into the checker that Oxlint already started.

## Can `oxlint-tsgolint` load custom or third-party rules?

**The version inspected on 2026-09-05 could not.** It supported configuration of compiled-in rules,
not loading rule implementations. Reinspect the resolved package before relying on this conclusion.

- The executable has a hard-coded `allRules` Go slice ([tagged registration](https://github.com/oxc-project/tsgolint/blob/v7.0.2001/cmd/tsgolint/main.go#L162-L222)).
- Its headless payload accepts only rule `name` and `options` ([tagged payload](https://github.com/oxc-project/tsgolint/blob/v7.0.2001/cmd/tsgolint/payload.go#L19-L36)).
- At execution, a name is looked up in the compiled map; an unknown rule panics ([tagged dispatch](https://github.com/oxc-project/tsgolint/blob/v7.0.2001/cmd/tsgolint/headless.go#L413-L437)).
- The resolved package manifest published a launcher plus platform-specific prebuilt binary, with no plugin API.

At the original research point, the project README said it was not accepting rules beyond those supported by typescript-eslint and was focused on rule coverage and configuration ([tsgolint README: status](https://github.com/oxc-project/tsgolint#status)). Combined with the inspected package mechanics, the practical routes were (a) get a generic rule accepted by typescript-eslint and then tsgolint, or (b) maintain a fork/custom binary. Recheck upstream policy before presenting those routes as current; the inspected package had no repository-local third-party rule mechanism.

## Should an Oxlint JS plugin import compiler packages itself?

### `typescript`

Loading an ordinary npm module from plugin code is not itself forbidden; Oxlint loads JS plugins as JavaScript/TypeScript modules. But using `typescript` there as an independent compiler is not a supported typed-plugin integration and is unwise for these rules:

- Oxc supplies an ESTree-compatible AST; TypeScript supplies a distinct TypeScript AST. A plugin-built `ts.Program` has no official map from Oxc nodes to `ts.Node`s. The plugin would have to locate equivalent nodes by filename/ranges and maintain that bridge.
- It cannot reuse tsgolint's typescript-go programs. The same files, module graph, declarations, and types would be loaded and checked again in another runtime.
- Oxlint can pass in-memory source overrides to tsgolint (for language-server/editor content), but no such overlay is exposed as a project host to JS plugins. A compiler program built from disk risks checking stale text while the Oxc visitor sees current text.
- Correct project ownership, references, path resolution, generated declarations, and files outside a config become plugin responsibilities.
- `createOnce` only reduces Oxlint rule construction overhead; it is not a project-service or cross-backend program cache. The writing guide promises one rule construction and per-file hooks, not a shared TypeScript project lifecycle ([writing JS plugins: `createOnce`](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html#alternative-api)).

If TypeScript is going to own parsing, project creation, and node identity, it is cleaner and more deterministic to let it own the traversal and diagnostics in a separate checker.

### `@typescript-eslint/utils`

This package is the right tool **inside ESLint with `@typescript-eslint/parser`**, not inside Oxlint today. Its documented typed-rule path calls `ESLintUtils.getParserServices(context)`, then uses the returned `program`, ESTree↔TypeScript node maps, `getTypeAtLocation`, and `getSymbolAtLocation` ([custom typed rules](https://typescript-eslint.io/developers/custom-rules#typed-rules)). Oxlint provides none of those services.

Using `@typescript-eslint/utils` only for rule types or syntax helpers would add an overlapping AST/type abstraction without making the rule semantic. Calling its typed helpers under Oxlint will fail or find no program. The official Oxlint limitation takes precedence over general ESLint API compatibility.

## Alternatives and costs

| Approach                                          | Semantic capability                                                                    | Project/program reuse                                                                        | Main costs and risks                                                                                                                                         | Fit here                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import TypeScript inside the Oxlint JS plugin     | Possible only by building an independent program and manually correlating AST nodes    | Cannot reuse tsgolint; uncertain plugin-local lifecycle                                      | Duplicate parsing/checking, stale editor text, hand-built node bridge, project discovery and cache complexity                                                | **Reject**                                                                                                                                          |
| Native Oxc Rust rule                              | Oxc AST, scopes, symbols, and CFG; not the TypeScript checker used by type-aware rules | Reuses Oxc syntax semantics, not tsgolint types                                              | Upstream discussion/acceptance; Rust implementation; repository cannot load a local native rule without a fork/build                                         | Good only for syntax rules; no solution for true TS types                                                                                           |
| Upstream tsgolint Go rule                         | Full typescript-go checker and existing program/workers                                | Best integration and consistency                                                             | The inspected package had no third-party loading; original upstream policy accepted only typescript-eslint-supported rules; recheck current policy           | Best long-term semantic home after upstream acceptance                                                                                              |
| Separate ESLint + typescript-eslint pass          | Full official parser services and checker maps                                         | One Project Service within the ESLint pass; no reuse of tsgolint                             | Adds ESLint/parser/utils/plugin dependencies and a second full semantic pass; slower startup/memory; duplicate configuration/reporting                       | Supported fallback when editor UX is required                                                                                                       |
| Dedicated TypeScript compiler-API checker         | Full `Program`/`TypeChecker`; direct TS node identity                                  | Can create one program per tsconfig within its process; no reuse of tsgolint                 | Adds one direct compiler dependency and a second semantic pass; repository owns traversal, project discovery, diagnostics, tests, and optional watch caching | **Best local semantic option**                                                                                                                      |
| `@typescript-eslint/project-service` in a checker | Full editor-style programs, nearest-project assignment, project references             | Shared service/programs within that checker; no reuse of tsgolint                            | More dependency/API surface than direct compiler API; still a separate semantic pass                                                                         | Consider only when monorepo/project-reference handling outgrows simple program grouping                                                             |
| tsquery                                           | Convenient CSS-style queries over the TypeScript AST                                   | Its `project()` loads project source files, but it does not eliminate checker/program design | Additional selector abstraction; these rules require types, symbols, and flow rather than just node selection                                                | Reject for these rules ([official README](https://github.com/phenomnomnominal/tsquery#tsquery))                                                     |
| ts-morph                                          | Project and checker wrappers over TypeScript                                           | A `Project` can load a tsconfig and dependencies within the checker                          | Additional wrapper/version surface; underlying compiler objects can become invalid after manipulation; little benefit for read-only, low-level checks        | Viable but unnecessary ([project loading](https://ts-morph.com/setup/adding-source-files), [checker](https://ts-morph.com/navigation/type-checker)) |

### Native Oxc is not equivalent to type-aware tsgolint

Oxc calls its scope/symbol/control-flow layer “semantic analysis,” but that is not the TypeScript type checker. The contribution guide points native rules to Oxc `Semantic`, AST nodes, symbols, and per-file rule hooks ([adding Oxc rules](https://oxc.rs/docs/contribute/linter/adding-rules.html#step-4-rule-implementation)); the type-aware guide assigns TypeScript programs and types to tsgolint. A native Oxc port can make `no-chained-type-assertions` faster, but cannot by itself resolve imported/library types for the other two rules.

Oxc also asks contributors to discuss new Rust-native plugins first now that JS plugins exist ([adding rules: pick a rule](https://oxc.rs/docs/contribute/linter/adding-rules.html#step-1-pick-a-rule)). For one small syntactic policy rule, upstream Rust work is optional optimization, not a repository architecture.

### Separate ESLint is supported but duplicates work

typescript-eslint officially recommends typed linting, `@typescript-eslint/utils` for custom typed rules, and `parserOptions.projectService: true` for project information ([typed linting setup](https://typescript-eslint.io/getting-started/typed-linting), [custom rules](https://typescript-eslint.io/developers/custom-rules)). Project Service uses the same class of APIs as editors, automatically selects the nearest tsconfig, and supports project references for monorepos ([Project Service](https://typescript-eslint.io/blog/project-service#scalability)).

The cost is fundamental: typed linting asks TypeScript to build the project, so lint time is roughly type-check time; wide `include`s and complex types increase time and memory ([typed-lint performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance)). This repository would run that in addition to its existing tsgolint/type-check pass. If this route is chosen, restrict ESLint to the two semantic custom rules and the applicable TS files; do not duplicate Oxlint's general rule set.

### Dedicated compiler API is the smallest independent semantic layer

TypeScript defines a `Program` as the whole application and exposes `program.getTypeChecker()`, `getTypeAtLocation`, `getSymbolAtLocation`, and type rendering APIs ([Compiler API: setup and concepts](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-set-up), [Type Checker APIs](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#type-checker-apis)). It also provides semantic builder/watch programs that reuse previous work for changed files ([incremental program watcher](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#writing-an-incremental-program-watcher)).

For one-shot CI in this repository, the initial design should be simpler than a language service:

1. Discover relevant tsconfigs and assign each checked file to one project.
2. Parse each config with TypeScript's own config APIs.
3. Build one program/checker per project, not per file or per rule.
4. Traverse each source file once and run both semantic provenance checks in the same walk.
5. Key bindings by `ts.Symbol`, compare actual source/destination types with checker APIs, and emit deterministic file/range diagnostics.
6. Keep the script read-only and make its cache lifetime the process lifetime. Add builder/watch or `@typescript-eslint/project-service` only if an interactive mode is later required.

This does not avoid a second type-analysis pass beside tsgolint, but it avoids a second ESTree conversion, ESLint engine, parser-services bridge, and wrapper library.

## Consistency and caching requirements

Whichever separate semantic route is chosen:

- **Pin one TypeScript semantic version.** Match the version pairing documented by the currently resolved tsgolint package and declared by the workspace ([tsgolint versioning](https://github.com/oxc-project/tsgolint#versioning), [API package](../../apps/api/package.json)). A root checker should pin that version directly to reduce JS-TypeScript/typescript-go disagreement.
- **Use production tsconfigs, not a broad synthetic root config.** Oxlint's own guide warns that broad root includes create very large programs and recommends a files-empty root for monorepos ([Oxlint type-aware troubleshooting](https://oxc.rs/docs/guide/usage/linter/type-aware.html#common-performance-issues)). The current root config intentionally includes tooling while the API config includes application source; preserve that ownership.
- **Build dependencies/declarations before semantic analysis when project boundaries require them.** This is Oxlint's explicit monorepo guidance ([type-aware monorepos](https://oxc.rs/docs/guide/usage/linter/type-aware.html#monorepos-and-build-outputs)).
- **Do not promise cache sharing across tools or processes.** tsgolint shares its own TypeScript programs across its workers ([tsgolint architecture](https://github.com/oxc-project/tsgolint/blob/v7.0.2001/ARCHITECTURE.md#parallel-processing)); typescript-eslint Project Service caches within its service; a dedicated checker can reuse programs within its own run. None exposes a cache for the others.
- **Avoid double-reporting.** Keep the JS rules' existing proven syntax cases authoritative and define the semantic checker as gap coverage, or migrate a rule wholly to the semantic checker. Do not have both report the same source span.
- **Test compiler-version-sensitive behavior.** Alias resolution, `unknown`/`object` relationships, contextual typing, and assertions can change at compiler boundaries. Pin fixtures to the same TypeScript version and include multi-file/project cases, not only in-memory single files.

## Rule-by-rule decision

### `no-chained-type-assertions`

The implementation counts adjacent `TSAsExpression`/`TSTypeAssertion` nodes after unwrapping parentheses and exempts all-`const` chains ([rule source](../../tools/oxlint/rules/no-chained-type-assertions.ts)). That is complete for its stated invariant. Keep it in the JS plugin. It already complements the broader `typescript/consistent-type-assertions` policy with one focused, agent-friendly diagnostic.

### `no-known-value-widening`

The implementation explicitly describes itself as detecting “sound syntactic cases” and obtains evidence from literals, object/array/function/class/new expressions, and stable local constants. Tests deliberately allow imported values and typed call results because syntax cannot prove their source type ([rule source](../../tools/oxlint/rules/no-known-value-widening.ts), [tests](../../tools/oxlint/rules/no-known-value-widening.test.ts)).

Keep those fast cases. A future semantic complement should ask the checker for the actual source type and resolved destination type, preserve boundary exemptions, resolve imported/local aliases by symbol rather than spelling, and report only when the source already carries materially more precise evidence than `unknown`, `object`, or the configured generic-record shape.

### `no-widen-then-assert`

The implementation intentionally limits itself to immutable local bindings in one function boundary and uses syntax to decide whether the later asserted type is narrower ([rule source](../../tools/oxlint/rules/no-widen-then-assert.ts)). Keep that cheap local pattern. A future semantic complement should identify the binding and use sites by `ts.Symbol`, obtain the initializer's pre-widening type and later asserted type from the same checker/program, and cover typed identifiers/call results and resolved record aliases without expanding into unconstrained interprocedural dataflow.

The semantic checker should remain conservative: a checker can answer types and symbols, but it does not automatically prove application-level provenance or that a value was parsed at a boundary. Cross-function taint/provenance analysis would be a new analysis product with substantially higher complexity and false-positive risk. Duplicate validation, repeated reads, persistence precedence, and runtime-work removal remain semantic/data-flow review and public-behavior test concerns rather than robust same-call AST rules.

## Decision trigger

Do nothing beyond the current JS rules unless one of these occurs:

- review repeatedly finds imported or typed-call widening that the current rules miss;
- an actual regression demonstrates that the false-negative space is costly;
- Oxlint releases a documented custom typed-rule API; or
- the rules are accepted upstream into typescript-eslint/tsgolint.

If the first two occur before native support arrives, implement the single compiler-API checker and
add only an explicit root TypeScript dependency matching the resolved toolchain. Reassess when
Oxlint closes the custom-type-aware-rule issues with a released API.
