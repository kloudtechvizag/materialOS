import ReactDOMServer from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { Route, Routes, StaticRouter } from "react-router-dom";

/** Loaded via Vite's ssrLoadModule by scripts/prerender.mjs (a plain
 * Node script that can't use JSX itself) -- assembles the same provider
 * tree the real client bootstrap (main.tsx) uses, minus QueryClient
 * (marketing pages don't use react-query, see prerenderManifest.tsx's
 * docstring), so route params (:slug) resolve exactly as they would in
 * the browser.
 *
 * react-helmet-async v3's own SSR context mechanism (HelmetProvider's
 * `context` prop) only populates under React <19 -- under React 19 it
 * instead renders real <title>/<meta>/<link> host elements, which React
 * 19's OWN renderer hoists to the front of renderToString()'s output
 * string natively (verified empirically: a <title>/<meta> anywhere in
 * the tree is pulled out and emitted before the rest of the markup).
 * scripts/prerender.mjs relies on that native hoisting -- it parses the
 * leading run of title/meta/link tags off this function's returned
 * `html` string itself, rather than reading a separate helmet object.
 * <script type="application/ld+json"> is NOT hoisted by React 19 (only
 * title/meta/link are) and is left in place in the body -- which is
 * fine, search engines read JSON-LD anywhere in the document, not only
 * <head>. */
export function renderEntry(path: string, routePath: string, element: React.ReactNode): string {
  return ReactDOMServer.renderToString(
    <HelmetProvider>
      <StaticRouter location={path}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </StaticRouter>
    </HelmetProvider>
  );
}
