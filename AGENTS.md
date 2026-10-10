<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## BIOREFINE AI architecture
- Simulation, Isolation Forest scoring and persistence run in the browser (`src/lib/sim/engine.ts`, external store via useSyncExternalStore) — no backend credentials needed for the demo; data persists in localStorage with in-memory fallback.
- Page content renders only after hydration (AppShell gate) because the live store diverges from SSR output.
- Trained yield prediction is never computed in-app: `src/lib/yieldModel.ts` calls a user-configured external HTTPS endpoint from the browser and shows "Model connection required" otherwise — no trained model is bundled, so nothing may be faked.
