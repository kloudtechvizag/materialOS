# ADR-047: real navigation reorganization, a real Organization/Platform Setup split, and real permission-based nav filtering

**Context:** a 13-section master prompt asked for a full navigation and
Setup architecture overhaul -- profile-driven sidebar navigation across
every MaterialOS industry, a redesigned School ERP sidebar with ~50
proposed nav items across 10 groups, a full Setup landing page with
completion-status cards and a first-time checklist, a three-way split
between School Setup / Organization Settings / Platform Administration,
and role-aware navigation for six school personas. Consistent with how
every large spec this project has received was handled, this was
audited before any code was written. The audit found the sidebar was
already a real, config-driven, profile-aware framework (`lib/
navigation.ts`'s `NavigationSection[]`/`buildNavigation(enabledModules,
terminology)`, with real collapse/expand, active-section tracking, and
entity de-duplication across profiles) -- sections 2, 3, and 10 of the
master prompt were already true architecture, not something to rebuild.
It also found `IndustryProfile.navigation_config` is dead (every
profile sets it to `[]`; nothing reads it), that a `permission` field
already existed on every nav item but was **never enforced** (the
comment on it said so explicitly), and that roughly 10 of the master
prompt's ~50 proposed School ERP nav items (Promotion & Transfers,
Concessions, Circulars, Parent Communication, Visitor Management,
Events & Facilities, Report Cards as a distinct page, Academic Calendar,
Admission Pipeline as a distinct page, Student Documents) have no real
backend behind them. The user confirmed the scope explicitly: reorganize
the School sidebar using only real pages, split Setup into Organization
Settings / Platform Administration (a shared-framework fix, applied to
every profile at once since it's the same code), and wire up real
permission-based nav filtering (also applied globally) -- defer the
Setup landing page and every not-yet-real nav item, named rather than
faked.

## What shipped

**The School ERP sidebar reorganized into five real, focused sections**
(`lib/navigation.ts`), using only routes that already exist and work:
**Students** (Student Directory, Attendance, Branches -- Classes/
Timetable/Examinations/Homework moved out, since those are the
curriculum's own structure, not the roster), **Admissions** (Enquiries,
Applications -- unchanged), **Academics** (Classes & Sections, Academic
Years, Timetable, Homework, Examinations), **Finance** (Fees -- the one
real page that already holds fee structures, invoices, payments, and
outstanding balances together), **Campus Operations** (Transport,
Library, Hostel, split out of the old catch-all "Students" section),
plus the unchanged Communications and Analytics sections. Every item
still maps to a real, already-shipped route; nothing new was invented
to fill out the master prompt's fuller proposed structure.

**"Setup" split into Organization Settings and Platform Administration
-- for every industry profile at once**, since it's the same shared
section in the same shared file. Organization Settings (day-to-day,
org-scoped: Users, Company settings, Import from Tally/Busy, Receipts,
Metal rates) vs Platform Administration (MaterialOS-the-platform's own
administration: Industry profile, Subscription, Capabilities, Webhooks,
Support) -- the exact distinction the master prompt's own section 7
draws, minus a dedicated "School Setup" category (no genuinely
school-specific *configuration* pages exist yet beyond the operational
pages that already own their own master data -- Academic Years, Classes
& Sections, and Fee structures are real pages, already reachable from
their own operational sections, not duplicated into a third setup
menu).

**Real, backend-enforced permission-based navigation filtering --
applied globally, not just to School ERP.** The `permission` field on
`NavigationItem` existed before this ADR but did nothing; `buildNav
igation()` now takes a third argument (`permissions: string[] |
undefined`) and drops any item whose `permission` the caller doesn't
actually hold. The permission list itself is real: `CurrentUserResponse`
(`GET /auth/me`) gained a `permissions: list[str]` field, populated by a
new `deps.user_permission_codes(db, user_id)` helper (one query,
reusing the exact same `RolePermission`/`UserRole`/`Permission` join
`require_permission` already runs) -- the same helper and philosophy
ADR-046 established for the School Dashboard, now generalized to
navigation. `SidebarNav.tsx` fetches this once (`["current-user"]`,
sharing `AppShell`'s own cache, no extra round-trip) and passes it
through. Every existing tenant's first (and usually only) real user is
the seeded `owner` role, which the signup flow already grants the
*entire* permission catalog -- so this ships with **zero visible change
for every existing account**; the gating only bites for a role that was
deliberately scoped down, exactly as intended. This pass also assigned
real permission codes to every School ERP nav item that didn't have one
yet (Student Directory -> `students.view`, Admissions -> `admissions.
view`, Fees -> `fees.view`, Timetable -> `timetable.view`, and so on --
verified against each real backend endpoint's own `require_permission`
call, not guessed), since the master prompt's own section 9 explicitly
asked for school role-aware navigation and the plumbing that makes it
real was exactly what this pass built. Other profiles' items keep
whatever partial `permission` coverage already existed (e.g. Leads,
Subscription, Webhooks) -- retrofitting the rest of the ~200 nav items
across every other profile was out of this pass's footprint.

## Deliberately not built in this pass

- **New RBAC role personas** (Principal, Teacher, Accountant, Admission
  Counsellor, Transport Manager, Librarian) -- still none exist; this
  pass makes real, already-existing permissions actually gate
  navigation, it does not invent new named roles. A custom role with
  exactly the right permission subset (as demonstrated live in
  verification, below) produces the same effect a "Teacher" role would.
- **A Setup landing page** with completion-status cards, search, and a
  dismissible first-time checklist (master prompt sections 5, 8) --
  named as deferred; would need new aggregation logic this pass didn't
  build.
- **A dedicated "School Setup" configuration category** distinct from
  the operational pages that already own their own master data --
  Academic Years/Classes & Sections/Fee structures are real, already
  reachable from their own sections; a third "Setup mirror" of the same
  screens would be the exact duplicate-configuration-system anti-
  pattern the master prompt's own section 6 warns against.
- **The ~10 proposed School ERP nav items with no real backend**
  (Promotion & Transfers, Concessions, Circulars, Parent Communication,
  Visitor Management, Events & Facilities, a distinct Report Cards
  page, a distinct Academic Calendar page, a distinct Admission
  Pipeline page, student-level Documents) -- named above; no dead links
  were added.
- **Retrofitting real `permission` tags onto every nav item across
  every other industry profile** (Building Materials, Retail, Pharmacy,
  Laboratory, Printing, Travel, Real Estate, ...) -- the filtering
  mechanism itself is now real and global; extending per-item
  permission coverage to ~200 more items across 8+ profiles is real,
  separate, later work.
- **Searchable navigation and pinned/favorite modules** (master prompt
  section 11) -- the existing collapse/expand, active-section tracking,
  icon-rail, and mobile drawer were already real and are unchanged;
  search and pinning are new UI surface this pass didn't build.

## Verification

Backend: 2 new/extended tests in `test_auth_flow.py` -- the existing
signup-then-login-then-me test now asserts the owner's real
`permissions` includes real catalog codes, and a new test creates a
role holding exactly one permission (`customers.view`) and asserts
`GET /auth/me` returns exactly `["customers.view"]`, nothing more.
Full backend suite: 324 passed (323 + 1 net new), zero regressions.
`tsc --noEmit`, `npm run build` (the stricter `tsc -b` project-
reference check), `npm run check:nav-modules`, and `oxlint` all clean.

Live-verified via CDP headless Chromium against the real, already-
seeded `greenwood-demo` tenant: the reorganized sidebar renders with
the five real school sections plus the Organization Settings/Platform
Administration split, confirmed by scrolling through the full rail. A
real owner-role fetch of `/auth/me` returned all 528 real permission
codes (48 resources x 11 actions), confirming zero behavior change for
the account every existing demo/test tenant actually uses. A second,
deliberately scoped-down "Teacher" role (`companies.view`, `students.
view`, `student_attendance.view`, `timetable.view`, `homework.view`,
`examinations.view` only -- created via direct role/permission rows,
the same test-fixture pattern already established this session, then
a real minted JWT swapped into the browser's own auth storage) was
verified live: Admissions, Finance, Communications, Campus Operations,
Analytics, People & Payroll, Backups, Audit log, Notification rules,
Subscription, Capabilities, and Webhooks all correctly disappeared from
the sidebar, while Students (Directory + Attendance, Branches
correctly hidden), Academics (Timetable/Homework/Examinations, Classes
& Sections/Academic Years correctly hidden), Command center, Users,
Company settings, and Industry/Support remained -- and the School
Dashboard (ADR-046) rendered the exact same honest, permission-gated
"—"/"You don't have permission" states for that same role, confirming
the two features' permission philosophies agree with each other on the
same real data.

## Reversibility

Every backend change is additive (`CurrentUserResponse.permissions`,
`deps.user_permission_codes`); no existing field or endpoint behavior
changed. The frontend changes are a reorganization of existing
`NavigationItem` entries (same items, new section groupings, added
`permission` tags) plus one new `buildNavigation()` parameter with a
backward-compatible default (`permissions?: string[] | undefined` --
an omitted call site behaves exactly as before, showing every
permission-gated item). No migration to undo; reverting is a pure
frontend diff.
