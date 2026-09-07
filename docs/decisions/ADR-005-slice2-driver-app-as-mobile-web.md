# ADR-005: Slice 2's driver-facing flows ship as mobile web, not a native app

**Context:** Part E locks the mobile architecture to React Native + Expo,
and dev.md §45-46 describe a driver app with today's deliveries,
navigation, status updates, and POD (signature + photo + GPS +
timestamp). That is a second codebase and a genuinely separate,
multi-week build -- and Part E itself says Tauri (the desktop
equivalent decision) should be deferred if the web app can do the job.

**Options:**
- Build the React Native driver app now, alongside the web app.
- Build the driver-facing flows as a mobile-responsive web page instead:
  signature capture via an HTML canvas, photo capture via
  `<input type="file" capture="environment">`, location via the browser
  Geolocation API -- all of which work in a mobile browser with no app
  install.

**Choice:** The second option. Every capability dev.md §46 lists for POD
(signature, photo, GPS, timestamp, receiver name, shortage/damage notes)
has a direct, well-supported browser API. A driver opens a URL on their
phone; nothing to install, nothing to release to an app store to fix a
bug.

**Consequence:** No push notifications, no offline queue (Part E scopes
offline to four specific flows including "delivery status update + POD
capture" -- the web version here is online-only for now), and no
background GPS tracking. These are the real capabilities a native app
adds; they are not built here and are not silently approximated.

**Reversibility:** Reversible, and cheap to reverse. The API this page
calls (`/trips`, `/delivery-challans/{id}/pod`) is the same API a native
app would call. Replacing the web page with an Expo app later changes
nothing server-side.
