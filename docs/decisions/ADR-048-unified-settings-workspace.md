# ADR-048: one Settings entry, one workspace, reused screens -- for every industry profile

**Context:** a follow-up prompt to ADR-047 pointed out that its own
"Organization Settings" / "Platform Administration" split, while a real
improvement over the single undifferentiated "Setup" section it
replaced, still left ordinary users choosing between two separate
top-level settings entry points -- exactly the "fragmented settings
experience" the new prompt asked to eliminate. It asked for ONE
`Settings` navigation entry opening one profile-aware workspace,
organized into Business/Organization/Subscription & Billing/
Integrations & System/Platform Administration categories, with
Operations kept separate, no duplicate routes, and role-based
visibility enforced on the backend. Consistent with this project's own
audit-before-building discipline, the "Platform Administration"
category was re-examined before being carried forward: this app
already has a real, completely separate platform-administration area
(`/platform/*`, its own `PlatformLoginPage`, `PlatformAdmin` entity,
tenant/plan/admin management) that no ordinary tenant `User` can ever
reach, regardless of permissions -- a tenant User and a PlatformAdmin
are different auth entities entirely. What ADR-047 had labeled
"Platform Administration" inside the tenant sidebar (Industry,
Subscription, Capabilities, Webhooks, Support) was, on inspection,
never platform-wide administration at all -- it was this tenant's own
relationship with the MaterialOS platform. Building a fifth
"Platform Administration" tab into the unified tenant Settings
workspace, even permission-gated, would have been UI for an
administration boundary that doesn't structurally exist for a tenant
User -- so it wasn't built; the five items were relabeled and
regrouped into the categories that actually describe them.

## What shipped

**One real Settings entry point.** The sidebar's old "Organization
Settings" and "Platform Administration" sections are gone entirely.
`SidebarFooter.tsx` gained one new link -- "Settings", styled and
positioned like the existing "Log out" utility action (an account-level
concern, not a business-workflow nav item, so it doesn't live in
`lib/navigation.ts`'s module-driven registry) -- linking to `/settings`.

**One real, profile-aware workspace, not a second settings
implementation.** `SettingsLayout.tsx` is a real React Router layout
route (`<Route path="/settings" element={<SettingsLayout />}>`) with a
categorized secondary nav and an `<Outlet>`. Every settings page it
renders is the *exact same component* that already existed and worked
standalone (`UsersPage`, `CompanySettingsPage`, `IndustryConfigPage`,
`SubscriptionPage` + its Invoices/Payments sub-pages,
`CapabilityMarketplacePage`, `WebhooksPage`, `ReceiptSettingsPage`,
`MetalRatesPage`, `ImportsPage` + its wizard) -- nested one level
deeper, not duplicated. `lib/settingsNav.ts` (`SETTINGS_CATEGORIES`,
`buildSettingsNav`) mirrors `lib/navigation.ts`'s own
module-and-permission filtering exactly, so the workspace is real
profile-aware and permission-aware for every industry, verified live
for both School Management (Business Settings/Organization
Settings/Subscription & Billing show; Integrations & System shows only
Webhooks, since education enables neither `accounting` nor
`jewellery`) and Building Materials (the same workspace, same code,
now also showing Receipts and Import from Tally/Busy under
Integrations & System, since that profile enables `accounting`).

**Four real categories, not five.** Business Settings (Industry
Profile -- the one real thing genuinely specific to the active
profile today; a school-specific Academic/Admission/Fee "configuration"
screen doesn't exist as separate master data yet, so nothing was
invented there -- those stay reachable from their own real operational
sections), Organization Settings (Users, Company Settings),
Subscription & Billing (Subscription, Capabilities), Integrations &
System (Webhooks, Receipts, Metal Rates, Import from Tally/Busy --
each still real-permission- and real-module-gated exactly as before).
No "Platform Administration" category -- see Context.

**Support moved to the global header**, per the master prompt's own
"globally accessible... not duplicated as a Settings category and a
separate unrelated navigation item" instruction -- one `LifeBuoy` icon
button in `AppShell`'s header, next to the notification bell, reachable
from every page including inside the Settings workspace itself, and no
longer a sidebar or Settings entry at all.

**Every legacy route still resolves -- via one real redirect each, not
a second live page.** `/users` -> `/settings/users`, `/company-settings`
-> `/settings/company`, `/settings/industry` -> `/settings/business`,
`/imports` -> `/settings/imports`, `/imports/new` ->
`/settings/imports/new`. The one internal link this repo had to the old
`/settings/industry` path (`RequireModule.tsx`'s "module not enabled"
error screen) and the `ImportsPage`/`ImportWizardPage`'s own internal
navigation were updated to the new canonical paths directly, so an
in-app click never round-trips through a redirect; only an old
bookmark or external deep link does.

**Operations stays untouched and separate**, exactly per the master
prompt's own section 4 -- Command Center, Backups, Audit Log,
Notification Rules were never touched by this pass; they were already
their own sidebar section, distinct from Setup, before ADR-047 even
started.

**Authorization was already real on the backend** -- every settings
page's own API calls run through the same `require_permission` checks
they always did; this pass only changed which URL and which secondary
nav item leads to each already-protected page, never what the backend
allows.

**The nav-module-coverage guard was extended, not bypassed.**
`scripts/check-nav-module-coverage.mjs` previously only scanned
`lib/navigation.ts`'s `NAVIGATION_CONFIG`; moving Metal Rates (the
`jewellery` module's only nav-level gate) into `settingsNav.ts` would
have made it a silent false orphan. The script now scans both
registries, so the guard's own coverage promise stays accurate instead
of being quietly weakened by the refactor that moved items out of the
file it originally scanned.

## Deliberately not built in this pass

- **A "Platform Administration" category inside the tenant Settings
  workspace** -- named above; the real thing already exists at
  `/platform/*`, behind a separate `PlatformAdmin` login this tenant
  shell has no access path into.
- **New school-specific "configuration" screens** (Academic
  Configuration, Admission Configuration, Attendance & Timetable Rules,
  Examination & Grading, Fee & Payment Configuration, Documents &
  Certificates, ...) -- none of this master data exists as a separate
  configurable resource yet (ADR-046/047's own "deliberately not
  built" notes still apply); Business Settings shows the one real
  thing that exists (Industry Profile) rather than a fabricated list.
- **Redesigning what each individual settings page looks like** --
  `UsersPage`, `SubscriptionPage`, etc. are unchanged; only their
  position in the URL tree and the nav that leads to them changed.

## Verification

`tsc --noEmit`, `npm run build` (the stricter `tsc -b` project-
reference check), the (now dual-registry-aware) `npm run
check:nav-modules`, and `oxlint` all clean. No backend files were
touched this pass, so the previously-verified 324-passing backend
suite is unaffected.

Live-verified via CDP headless Chromium against two real tenants: the
already-seeded `greenwood-demo` (School Management) and a freshly
signed-up Building Materials tenant. Confirmed: the sidebar's old
Organization Settings/Platform Administration sections are gone,
replaced by a single "Settings" footer link that highlights as active
while inside `/settings/*`; clicking it lands on `/settings/business`
(the real `IndustryConfigPage`, showing the real active profile and
real enabled-modules list); the Users and Subscription tabs render
their full real functionality (a real user list including test
fixtures from earlier ADR-047 verification, a real subscription plan
with real usage bars) with correct active-tab highlighting; all five
legacy routes (`/users`, `/company-settings`, `/settings/industry`,
`/imports`, plus the header Support icon) redirect/navigate correctly;
the Building Materials tenant's Settings workspace showed the same
four categories with real profile-specific differences (Receipts and
Import from Tally/Busy present, since that profile enables
`accounting`, absent for School Management). Mobile viewport (390x844)
verified: the secondary nav collapses to a horizontal scrolling row
above the content, remaining fully usable.

## Reversibility

No backend change, no migration. Every old flat route still resolves
(via `<Navigate replace>`, itself a one-line, easily-reverted
redirect); the underlying page components are completely unmoved and
unmodified. Reverting `App.tsx`'s route block and deleting
`SettingsLayout.tsx`/`lib/settingsNav.ts` fully restores the prior
ADR-047 structure with no data or functionality lost either direction.
