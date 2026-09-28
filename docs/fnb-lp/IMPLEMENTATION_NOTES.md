# FHM Food & Beverage LP — Implementation Notes

Source of truth: `FHM_FnB_Prototype_Handoff_v1.0` (prototype v1.0) + `FHM_Claude_Implementation_Prompt.md`.
This document records only what was changed in this repository. Nothing was redesigned.

## Files added

| Path | Origin | Notes |
| --- | --- | --- |
| `food-beverage.html` | `prototype/index.html` | Copy with path/route rewrites only (see below). Copy, markup and section order unchanged. |
| `assets/fnb/fnb.css` | `prototype/styles.css` | Verbatim. Loaded only by `food-beverage.html`, so none of its element selectors reach the homepage. |
| `assets/fnb/fnb.js` | `prototype/script.js` | Verbatim except the locale-link selector (see below). |
| `assets/fnb/homepage-fnb.css` | `homepage-integration/homepage-additions.css` | Only the `.fhm-businesses*` rules were ported. Every rule is scoped under `#our-businesses`; the preview-only `.corporate-*` scaffolding was dropped. Colours/fonts reuse the homepage tokens (`--cream`, `--cream-d`, `--sand`, `--gold`, `--ink`, `--mid`, `--warm`). |
| `assets/fnb/images/` | `assets/` (9 files) | `fhm-logo-dark.png`, `fhm-logo-light.png`, `founder.jpg`, `hospitality.jpg`, `japan-sourcing-map.png`, `logistics.webp`, `matcha.webp`, `private-label.webp`, `tea-fields.webp`. Self-hosted, original crops, not re-encoded. |

## Rewrites applied to `food-beverage.html`

- `../assets/…` → `assets/fnb/images/…`
- `styles.css` → `assets/fnb/fnb.css`; `script.js` → `assets/fnb/fnb.js`
- `<meta name="robots" content="noindex,nofollow">` removed (approved production release)
- `<link rel="canonical" href="https://www.fukudahotel.com/food-beverage.html">` added
- Brand / home links `../homepage-integration/homepage-preview.html` → `/index.html` with `data-locale-link="true"` so the locale travels across pages
- `title` / `meta description` left exactly as specified (EN default; `fnb.js` swaps them on locale change)

## Rewrite applied to `assets/fnb/fnb.js`

The prototype tagged cross-page links by their prototype filenames. One line now tags the production routes instead:

```js
document.querySelectorAll('a[href*="food-beverage.html"],a[href$="/index.html"]').forEach(a=>a.dataset.localeLink='true');
```

Everything else (locale precedence `?lang=` > `localStorage['fhm-lang']` > EN, `document.lang`, `body.lang-en`, `aria-pressed`, localised `alt`, composed `mailto:` / `wa.me` payloads, disclosure menu with Escape handling, auto-close above 1100px) is unchanged.

## Changes to `index.html` (3 entry points)

1. **Header nav** — new link in `#mainNav .nav-links`, between `Properties` and `Company`.
2. **`<section id="our-businesses" class="fhm-businesses">`** — inserted after the `#philosophy` section's closing tag and before the `.rule-line` / `#about`.
3. **Footer `Navigate` column** — new link after `Properties`, before `Founder's Message`.

The module's markup was converted from the prototype's paired `data-lang` spans to the homepage's existing `.t-ja` / `.t-en` + `body.lang-en` system, so **no second language controller and no duplicate event listener was added**. The existing inline `applyLang()` gained one extra responsibility: keeping `?lang=` on `a[data-locale-link]` hrefs in sync, so the locale travels to `food-beverage.html`.

`assets/fnb/homepage-fnb.css` is linked from `index.html`'s `<head>`. The homepage's own `<style>` block, title, description, hero, portfolio, philosophy, company, founder and legal copy were not touched.

## Deliberately not done

- `docs/`, `qa/`, `package.json`, `package-lock.json`, `vite.config.js` from the handoff package were **not** migrated. `qa/` is internal and must never be deployed.
- No new CMS, database, framework, hosting, build step, form endpoint, mail API or analytics.
- No new AI or stock imagery; no re-cropping, re-generation or re-encoding of the supplied assets.
- No server-side rendering of `?lang=ja`. Locale switching is client-side, so search engines and social crawlers see the **English** `title`/`description` for `/food-beverage.html`. Static per-language pages can be added later within the existing stack if required.
- Founder copy retains the handoff wording for the Deloitte reference ("experience at" / 「勤務経験」); no current/former employment status is asserted.

## Verification performed

2 pages × 2 languages × 1280 / 768 / 390 / 320 px: no horizontal overflow, no broken image, every in-page anchor resolves, `mailto:` and `wa.me` payloads switch with the locale, disclosure menu opens/closes and Escape returns focus, locale persists and travels between the homepage and the LP, no console errors, no 404s.
