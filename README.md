# Kym Gfx — portable website

This is the editable, ready-to-deploy version of your portfolio, exported on **9 October 2026**. `index.html` is at the ZIP root. The site uses plain HTML, CSS and JavaScript; there is no required npm install, framework build, database or paid API.

## Deploy in a few steps

1. Extract `Kym-Gfx-Portable.zip` into a folder. Keep the HTML, CSS, JavaScript and `assets/` together.
2. Upload the extracted folder, or its contents, using a host that serves static websites. Point its publish directory to the folder containing `index.html`. Leave build and install commands empty.
3. Enable HTTPS and connect your domain in the host's settings. Follow the platform instructions in [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md).
4. Once you know the final URL, update SEO URLs with the command below and upload the updated files. Python is needed only for the optional maintenance tools, not for serving the site.

```sh
python3 tools/configure-site.py --url https://YOUR-DOMAIN.com
python3 tools/check-site.py
```

On Windows, use `py -3` instead of `python3` if that is your Python launcher. The tools require Python 3.10 or newer and use only its standard library. Domain URLs can include a subdirectory, for example `https://YOUR-ACCOUNT.github.io/portfolio`.

## Included

| File or folder | Purpose |
| --- | --- |
| `index.html` | Home, projects, services, about, FAQs and contact |
| `book.html` | Reviewed Google Meet / Zoom call request |
| `onboarding.html` | Client onboarding page with the embedded Tally form |
| `404.html` | Missing-page screen |
| `assets/` | Your supplied portrait, portfolio media, Safari video, local fonts, real icons and licenses |
| `portfolio.json`, `assets/behance/` | All 12 saved public Behance projects and their local cover images |
| `styles.css`, `*.js` | Editable styling, motion, navigation, Tally embeds and project previews |
| `_headers`, `netlify.toml`, `vercel.json` | Static hosting and security configuration |
| `tools/` | Domain setup, safe Behance refresh, verification and deployment packaging |
| `deployment/` | Hosting guides, optional refresh workflow, server header examples and export notes |

The six curated projects remain in place. The three newest public projects outside that selection are rendered directly in the home-page HTML, so featured work remains visible if the JSON request fails or JavaScript is unavailable. Core images, fonts, icons and the included video are local. Project links and full collections still open Behance; onboarding opens your Tally form.

## Forms (Tally)

All forms are embedded from Tally (tally.so), so submissions reach you by email without a visitor needing a mail app. Project inquiry: `VLRzQl` (home page). Discovery call request: `jadl69` (`book.html`). Client onboarding: `5BREPb` (`onboarding.html`). Change the questions in Tally; the site picks the changes up automatically. The booking form is a request only: you confirm a time and send the Meet or Zoom link by email.

## Keep Behance work current

```sh
python3 tools/refresh-behance.py
python3 tools/check-site.py
```

Then deploy the updated files. A ZIP upload alone does **not** bring over the hosted Site's six-hour task or storage. [deployment/BEHANCE-REFRESH.md](deployment/BEHANCE-REFRESH.md) includes a six-hour GitHub Pages workflow template and instructions for another host's scheduler. No account credentials or private write API are included.

## Edit and repackage

Edit the HTML, CSS and JavaScript directly. After changing files, run the check tool with `--stamp` to refresh script/style integrity and structured-data CSP hashes:

```sh
python3 tools/check-site.py --stamp
python3 tools/package-site.py --zip Kym-Gfx-Upload.zip
```

That creates a smaller web-only ZIP with `index.html` at its root. For a web-only folder instead:

```sh
python3 tools/package-site.py --output upload
```

Keep `tools/` and `deployment/` in your private working copy if you deploy only the web files. Hosting setup files contain no credentials. For a local HTTP preview, run `python3 -m http.server 8000` in the extracted folder and visit `http://localhost:8000`; opening HTML with `file://` can block JSON loading and clipboard support.

## Privacy, SEO and verification

The existing hosted Site and its owner-private access settings are unchanged. External hosting does not inherit that sign-in boundary; set access protection on the new host if you want it private. No visitor messages or private account records are in this export.

Page metadata, service/person structured data and direct-answer FAQs are retained. Run the domain tool to set canonical and sharing URLs, absolute structured-data identifiers and `sitemap.xml` for your chosen domain. No guessed public domain or old private-site canonical is shipped. Public indexing requires public access; SEO/AEO placement is not guaranteed.

Testimonials were removed until approved client quotes are available.
