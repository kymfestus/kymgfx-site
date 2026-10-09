# Portable Behance refresh

The exported snapshot includes all 12 saved public projects from `https://www.behance.net/kymgfx0`, plus their cover images. The source Site's saved snapshot was last checked at **2026-10-09 03:06:31 UTC**. This is the saved data's timestamp, not a claim that the feed was newly refreshed while exporting.

The front end reads `portfolio.json` from its own host. Three newest projects outside the six curated projects are also written into `index.html`. This avoids a dependency on the original private Site's API, R2 storage or service token. The original scheduled task still belongs to the original Site and does not update copies uploaded elsewhere.

## Manual refresh

```sh
python3 tools/refresh-behance.py
python3 tools/check-site.py
python3 tools/package-site.py --zip Kym-Gfx-Upload.zip
```

Redeploy the resulting web files or ZIP. The refresh tool fetches only the fixed profile's public RSS feed, validates its owner, gallery URLs and dates, downloads bounded PNG/JPEG/WebP cover images from Behance's allowed CDN, and updates the local JSON and featured HTML. It does not fetch every image/video from full project pages or private projects. The RSS feed is a window of recent public work; the six curated projects are retained independently.

Source retrieval and validation complete before the saved portfolio is replaced. Failure keeps the last saved JSON and featured HTML. Titles are treated as text and escaped in generated HTML. DTD/entities, off-profile URLs, redirects, duplicate IDs, unsupported images and oversized responses are rejected. The script needs outgoing HTTPS access to Behance and its CDN. Behance can block a host/network or change/remove its RSS feed; a failed refresh should be reported and retried without redeploying stale content.

## Six-hour GitHub Pages option

`github-pages.yml.example` is an opt-in workflow template, not an enabled cloud task. It refreshes before creating a deployment artifact, configures your Pages URL and publishes only web files. It runs on source changes, manually, and every six hours. If refresh fails, the build stops and the already-published site remains untouched. GitHub schedule timing is approximate and may be delayed.

1. Put the extracted package in a GitHub repository you control. Review the public portfolio content and repository visibility.
2. Copy `deployment/github-pages.yml.example` to `.github/workflows/portfolio.yml`.
3. If the repository's default branch is not `main`, update the workflow's branch setting.
4. In repository Settings → Pages, choose GitHub Actions as the source. Configure the custom domain there if you have one.
5. Run the workflow manually once; verify its deployment URL and the featured work. Enable notifications for failed runs in your GitHub account.

The workflow does not require a long-lived deployment token or give the refresh script repository write access. Its Pages deployment job receives only the permissions Pages requires. Dependency actions should be reviewed and updated according to your repository policy. This package does not create a repository, enable a workflow, transfer your original schedule or publish anywhere automatically.

## Another hosting provider

Use a scheduled build/deploy pipeline that runs `python3 tools/refresh-behance.py`, then `python3 tools/check-site.py`, then publishes the web files with that host's own deployment integration. Configure an approximate six-hour interval in the provider. A failed refresh must stop publication so the existing live site remains intact. Store any provider deployment credentials in its secret manager, never in these files or browser code.

If you only use drag-and-drop uploads, refresh locally and upload again. There is intentionally no public writer endpoint in this portable static export.
