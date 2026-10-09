# Deploying Kym Gfx

The ZIP is a static website export. Its root contains `index.html`. You may upload the whole extracted folder, or use `tools/package-site.py` to copy only web files. No backend server or Site-specific credentials are needed for the published pages.

| Hosting option | Upload / settings | Security headers |
| --- | --- | --- |
| Netlify | Extract the ZIP; drag the folder containing `index.html` to [Netlify Drop](https://app.netlify.com/drop). For Git deployment, publish `.` with no build command; `netlify.toml` is included. | Keep `_headers` at the publish root. |
| Cloudflare Pages | Choose Direct Upload and upload the ZIP or extracted folder. For a web-only upload, use `python3 tools/package-site.py --zip Kym-Gfx-Upload.zip`. Git builds can publish `.` without a build command. | Keep `_headers` at the publish root. |
| Vercel | Use the extracted folder as the project root through Git import or the Vercel CLI. Framework preset: Other. No install/build command. Output directory: `.`. | The included `vercel.json` supplies the headers. |
| cPanel / Apache shared hosting | Upload and extract the files into the domain's `public_html`, or another document root. Put `index.html` directly there. | Optional Apache example below. The host must permit `mod_headers` and `.htaccess` overrides. |
| Nginx / VPS | Copy web files to your configured document root and enable HTTPS. | Merge `nginx-headers.conf` into your server configuration. |
| GitHub Pages | Set Pages to GitHub Actions and use the supplied workflow template; it uploads only web files. Configure your domain or project URL. | GitHub Pages does not expose custom response-header configuration. Use a suitable CDN/proxy if these headers are required. HTML CSP and integrity remain present. |
| Other static hosts | Publish the directory containing `index.html`, preserve file names/paths, and serve HTML/CSS/JS/JSON/images/fonts/video with correct MIME types. No build command. | Adapt the headers in `_headers` to the host's supported configuration. |

Website builders with proprietary themes or CMS import formats may need their own integration; a static ZIP is not a WordPress theme or a Wix/Squarespace template.

## Domain and indexing

After the host assigns a URL, run:

```sh
python3 tools/configure-site.py --url https://YOUR-FINAL-DOMAIN.com
python3 tools/check-site.py
```

Upload the updated HTML, `robots.txt` and `sitemap.xml`. The URL may include a path for GitHub Pages. If you later change domains, rerun the same command with the new URL. Connect your domain/DNS and HTTPS in the hosting account. Submit `https://YOUR-FINAL-DOMAIN.com/sitemap.xml` in your search console if desired.

Cloudflare Pages redirects `.html` URLs to their extensionless paths. For that host, add `--clean-urls` to the domain command so SEO URLs use `/book` and `/testimonials`. Use this option on another host only when it serves those paths. The supplied Vercel configuration keeps `.html` URLs.

Disable host optimizations that modify or minify the supplied JavaScript/CSS after packaging; exact integrity hashes require the original bytes. Review any asset-processing setting for your provider and deployment method.

Leave the `.html` page links intact. Do not add a single-page-app catch-all rewrite; this is a multi-page site, and a missing asset should remain a 404. The supplied `404.html` can be selected as a custom error page. Configure missing-page routing in your host if it does not use `404.html` automatically.

## Header configuration

Each HTML page has a strict Content Security Policy with exact JSON-LD hashes and integrity on local styles/scripts. The supplied HTTP configuration adds anti-framing, `nosniff`, a referrer policy, a permissions policy, opener isolation, HTTPS strict transport and revalidation. The HTTP `frame-ancestors` policy supplements the page CSP; it does not replace it. Keep these configurations aligned after manual edits.

Netlify and Cloudflare parse `_headers`. Other servers do not necessarily read it. Vercel reads `vercel.json`. For Apache, copy `deployment/apache.htaccess` to the document root as `.htaccess` after checking host support. For Nginx, merge the snippet and set the actual document root. Apply HSTS only on a working HTTPS domain. Do not deploy server configuration examples as if every platform understands them.

Check the actual deployed response headers in browser developer tools or with `curl -I https://YOUR-DOMAIN.com/`. Header examples are included and checked for consistency; no deployment to an external account was performed for this export.

## Booking verification after deployment

Open `/book.html`, select Google Meet and then Zoom, enter a future date/time with the correct timezone, and review the details. Edit a field and confirm the review resets. The final action should open an email draft to `kymfestus@gmail.com`; sending it remains the visitor's responsibility. Test with an email app configured on the device. You still confirm the time and provide the meeting link. Tally is an external onboarding service.

Check home-page media, each project preview, service filters, the responsive menu, portrait/social links, reduced-motion behavior and both feedback permissions. Use a real phone for the visual check that remains outstanding.

## Official platform references

Reviewed on 9 October 2026:

- [Netlify deployment methods and folder upload](https://docs.netlify.com/deploy/create-deploys/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Vercel configuration](https://vercel.com/docs/project-configuration)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Platform limits, plan features and access-protection options depend on your hosting account.
