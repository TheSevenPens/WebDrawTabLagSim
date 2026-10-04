# Drawing Tablet Lag Simulator

An interactive visualization of the lag between a pen tip (a), the OS pointer (b), and the brush stroke (c). See [USERMANUAL.md](USERMANUAL.md) for how to use it and [ARCHITECTURE.md](ARCHITECTURE.md) for how it works.

## Development

Requires Node 22 or newer and [Bun](https://bun.sh) (the version is pinned in `package.json`).

```sh
bun install --frozen-lockfile   # install exactly what bun.lock specifies
bun run dev                     # dev server with hot reload
bun run test                    # unit tests (node:test, no browser needed)
bun run build                   # production build into dist/
```

Pull requests run `test` and `build` in CI with `CI=true`, which makes the build fail on any Svelte compiler warning. Reproduce that locally with `CI=true bun run build`. Pushes to `master` run the same checks and then deploy to GitHub Pages.

To change dependencies, use `bun add` / `bun update` and commit the updated `bun.lock`. Do not commit a `package-lock.json`.

### Adding a setting

Add one entry to `SETTINGS` in `src/lib/settings.js` (default, range or options). Reset, preset save/load/import validation, and the slider and dropdown ranges all derive from it. Then add the control in `src/components/SidePanel.svelte` and use `settings.<name>` where it takes effect.
