# Export notes — 9 October 2026

This package was created from the existing portfolio revision `1a1c11671c48dafa1889f835344df479de852041` and a fresh read of its persisted public-work cache. It is an export only: the existing hosted Site, its source checkout, its private audience and its refresh task were not changed or republished.

## Preserved

- Home, work, six service titles, about, supplied Festus portrait, social/tool icons and Allura signature.
- Project previews, local fonts, included Safari video, responsive navigation, scrolling/reveal motion, spring call buttons and reduced-motion support.
- Contact, reviewed call request, feedback and external Tally onboarding flow.
- Labeled sample testimonials, direct-answer FAQs and person/organization/service structured data.
- Six curated projects plus a local snapshot of all 12 saved public Behance projects and their covers.

## Changes needed for portability

The Sites Worker, R2 binding, private refresh writer, bypass runner, project/account identifiers, Git credentials and managed build environment are not part of this package. No credential, visitor message, node_modules directory or framework build dependency is shipped.

The browser reads same-host `portfolio.json`. Featured cards are pre-rendered and progressively refreshed from that JSON with safe DOM nodes; they remain visible if the request fails. Covers use local content-hashed file names. A standard-library Python tool replaces the private backend refresh mechanism by producing static files for redeployment. Your chosen host must run a configured pipeline for unattended updates.

Old private-domain canonical URLs were removed. The domain tool generates your final canonical/sharing URLs, absolute structured-data IDs and sitemap without requiring a guessed domain. Netlify/Cloudflare header declarations, Vercel configuration and optional Apache/Nginx examples are included. Their enforcement depends on the chosen server; verify actual response headers after deployment.

## Validation

Passed against the exported files:

- Four HTML page structures, local links/anchors, form labels, asset/font references, every cached cover, stylesheet/script integrity and exact JSON-LD CSP hashes.
- Project dialogs and media-error fallback; service filters; desktop/mobile navigation behavior; keyboard focus; encoded mail drafts; malformed input and header-injection rejection.
- Google Meet/Zoom requests, timezone-aware future dates, invalid values, review-before-email, review invalidation after edits and final revalidation.
- Scroll/motion math, frame-rate handling, reversal/bounds, four-card ordering and featured-card deduplication.
- Portable feed owner/URL/size/raster checks, malicious text escaping, cover-download failure retention, successful insertion and unchanged refresh readback.
- Domain setup for a root URL and a subdirectory, subsequent domain change, extensionless SEO URLs, rejection of unsafe URLs, web-only folder generation and web-only ZIP CRC/content checks.
- Final archive entry paths, checksums, expected content and exclusion of managed/private runtime files.

The included tools let you repeat the checks:

```sh
python3 tools/check-site.py
python3 tools/test-refresh.py
node tools/check-site.cjs
node tools/check-forms.cjs
node tools/check-booking-review.cjs
node tools/check-motion.cjs
node tools/test-featured.cjs
```

Node is needed only for the optional interaction tests. Python tools have no third-party dependencies. `tools/check-site.py --stamp` refreshes integrity/CSP hashes after edits. `SHA256SUMS.txt` records the original export's file contents; edits or maintenance runs legitimately change those hashes.

## Limits that remain

Physical-phone visuals and exact parity with the Framer reference remain unverified. No external hosting account was provisioned or tested by publishing this export. ZIP packaging and code checks do not prove complete security on every server.

Forms open an email draft, require the visitor to send it, and do not store submissions in a backend. Calls require your manual confirmation and your meeting link. Testimonials are samples requiring client approval. Full new-project media stays on Behance; the updater imports only recent public RSS metadata and covers. Automatic refresh requires host/CI setup, and SEO/AEO visibility requires an accessible deployment on your actual domain.
