# Drawing Tablet Lag Simulator

An interactive visualization of the lag between a pen tip (a), the OS pointer (b), and the brush stroke (c). See [USERMANUAL.md](USERMANUAL.md) for how to use it and [ARCHITECTURE.md](ARCHITECTURE.md) for how it works.

## Development

Requires Node 22.12 or newer (Vite 8 needs it) and [Bun](https://bun.sh) (the version is pinned in `package.json`).

```sh
bun install --frozen-lockfile   # install exactly what bun.lock specifies
bun run dev                     # dev server with hot reload
bun run check                   # type check (svelte-check over src, using jsconfig.json)
bun run test                    # unit tests (node:test, no browser needed)
bun run build                   # production build into dist/
```

Pull requests run `check`, `test` and `build` in CI with `CI=true`, which makes the build fail on any Svelte compiler warning. Reproduce that locally with `CI=true bun run build`. Pushes to `master` run the same checks and then deploy to GitHub Pages.

To change dependencies, use `bun add` / `bun update` and commit the updated `bun.lock`. Do not commit a `package-lock.json`.

### Adding a setting

Add one entry to `SETTINGS` in `src/lib/settings.js` (default, range or options). Reset, preset save/load/import validation, and the slider and dropdown ranges all derive from it. Then add the control in `src/components/SidePanel.svelte` and use `settings.<name>` where it takes effect.

### Types

The code is plain JavaScript with checked JSDoc: `bun run check` runs `svelte-check` over `src` (config in `jsconfig.json`) and fails on type errors, including in `.svelte` files. The shared contracts are typed where they live: `Settings` is derived from `SETTINGS` in `src/lib/settings.js` (so a new setting needs no type edits, and `settings.misspelled` is an error), and `src/lib/types.js` has `Position`, `SimParams`, `SimSnapshot`, `Simulation`, `ScreenState` and `AdvanceScreenOptions`. Annotate new functions and component props with JSDoc (`@param`, `@type`) the same way. `noImplicitAny` is still off, so unannotated internal helpers are not checked yet; turning it on is an incremental sweep.
