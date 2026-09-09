/**
 * Runs after `vite build` (wired as the "postbuild" npm script). Loads
 * the marketing route manifest and every real component through Vite's
 * own SSR module graph (so aliases/JSX/TS work exactly as they do in
 * the app, no second build config), renders each public marketing route
 * to static HTML with react-helmet-async, and writes it into dist/ as
 * dist/<path>/index.html -- real, crawlable HTML per page, not only a
 * client-rendered shell. Also generates dist/robots.txt and
 * dist/sitemap.xml from the same real route/nav data.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, "dist");

async function main() {
  const server = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
  });

  const { PRERENDER_ENTRIES, ALL_INDUSTRIES } = await server.ssrLoadModule("/src/marketing/prerenderManifest.tsx");
  const { renderEntry } = await server.ssrLoadModule("/src/marketing/renderEntry.tsx");
  const { SITE_URL } = await server.ssrLoadModule("/src/components/marketing/Seo.tsx");
  const { NAVIGATION_CONFIG } = await server.ssrLoadModule("/src/lib/navigation.ts");

  const template = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");

  for (const entry of PRERENDER_ENTRIES) {
    const rendered = renderEntry(entry.path, entry.routePath, entry.element);
    const { headExtras, body } = splitHoistedHeadTags(rendered);

    const page = template
      .replace(/<title>.*?<\/title>/s, "")
      .replace(/<meta name="description"[^>]*\/?>/s, "")
      .replace("</head>", `    ${headExtras}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

    const outDir = entry.path === "/" ? distDir : path.join(distDir, entry.path.slice(1));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), page);
  }

  writeRobotsTxt(distDir, NAVIGATION_CONFIG);
  writeSitemap(distDir, SITE_URL, PRERENDER_ENTRIES);

  console.log(`Prerendered ${PRERENDER_ENTRIES.length} marketing routes (of ${ALL_INDUSTRIES.length} total industries).`);

  await server.close();
}

/** React 19's renderer natively hoists <title>/<meta>/<link> rendered
 * anywhere in the tree to the very front of renderToString()'s output
 * (see renderEntry.tsx's docstring for how this was verified). Pulls
 * that leading run off so it can be placed in <head>, leaving the
 * actual app markup (and any inline JSON-LD <script>, left in place)
 * for <div id="root">. */
function splitHoistedHeadTags(rendered) {
  const headTagPattern = /^(?:<title>.*?<\/title>|<meta\b[^>]*\/>|<link\b[^>]*\/>)/s;
  let rest = rendered;
  const headTags = [];
  while (true) {
    const match = rest.match(headTagPattern);
    if (!match) break;
    headTags.push(match[0]);
    rest = rest.slice(match[0].length);
  }
  return { headExtras: headTags.join("\n    "), body: rest };
}

function writeRobotsTxt(distDir, navigationConfig) {
  const authenticatedPaths = new Set();
  for (const section of navigationConfig) {
    for (const item of section.items) {
      // "/" is intentionally dual-purpose (RootRoute in App.tsx): the
      // Dashboard for a logged-in session, the public marketing
      // homepage otherwise. A crawler is always anonymous, so it must
      // see the marketing page there -- never disallow "/" itself.
      if (item.href !== "/") authenticatedPaths.add(item.href);
    }
  }
  // Not in NAVIGATION_CONFIG but also real authenticated/utility routes,
  // not marketing content.
  for (const extra of ["/pod", "/portal", "/server-settings"]) authenticatedPaths.add(extra);

  const disallow = [...authenticatedPaths].sort().map((p) => `Disallow: ${p}`).join("\n");
  const robots = `User-agent: *\nAllow: /\n${disallow}\n\nSitemap: https://materialos.com/sitemap.xml\n`;
  fs.writeFileSync(path.join(distDir, "robots.txt"), robots);
}

function writeSitemap(distDir, siteUrl, entries) {
  const extraPublicPaths = ["/pricing", "/login", "/signup"];
  const urls = [...entries.map((e) => e.path), ...extraPublicPaths];
  const urlEntries = urls.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
