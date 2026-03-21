# Dev Notes

## Next.js dev-mode stale bundle issue

### Symptom
- A tool route such as `/tools/solar` returns `200`, but the browser shows:
  - `Application error: a client-side exception has occurred`
  - missing or stale `_next/static/chunks/*`
  - intermittent `500` or `404` errors only in dev mode

### Root cause
- This project uses `next dev` on a long-lived local port.
- After repeated route/component changes and server restarts, the browser can keep an old dev bundle or HMR state while the current server is serving a newer build graph.
- Result: the page code is valid, but the browser is executing stale client chunks against a newer server state.

### How to verify
- Check the dev log first.
- If the route compiles and logs `GET /tools/... 200` with no component stack trace, the problem is usually stale dev chunks, not the route implementation itself.
- Confirm with `npm run build`; if production build passes, suspect the dev server/browser cache before changing component code.

### Recovery
1. Stop the stale process holding the dev port.
2. Restart `next dev` on the same port.
3. Hard refresh the browser (`Ctrl+F5`).
4. If needed, close the broken tab and reopen the route.

### Prevention rule
- When tool routes, chart-heavy pages, or shared layout files change repeatedly, do not trust an old `next dev` instance after client-side exception screens appear.
- First response should be:
  - inspect the dev log
  - verify the route returns `200`
  - if build is clean but the browser still breaks, restart the dev server before editing app code

## Chart.js mixed dataset rule

### Symptom
- Pages using `react-chartjs-2` render a blank area or the generic Next.js client-side exception screen.
- This can happen even when the route itself loads and simpler chart pages still work.

### Root cause
- A chart rendered with `<Bar />` can still contain datasets with `type: "line"`.
- In that case `LineController` must be registered explicitly with Chart.js, not only `LineElement` and `PointElement`.
- Solar and Wind both use mixed `bar + line` datasets, so missing controller registration crashes them on the client.

### Prevention rule
- For every mixed Chart.js dataset, register both the element and its controller.
- Minimum checklist for `bar + line` pages:
  - `BarElement`
  - `BarController`
  - `LineElement`
  - `LineController`
  - `CategoryScale`
  - `LinearScale`
  - `PointElement`
  - `Tooltip`
  - `Legend`
