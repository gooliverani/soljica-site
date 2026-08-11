# Soljica: published site

Served static artifact for **Soljica** (Specialty Coffee & Drink Bar, Beograd and Uzice),
published with GitHub Pages.

## What's here

Build output only. Every file is rendered by the publish pipeline in the private
authoring repo and copied here by `cms/deploy.ps1`. Do not edit anything in this
repo by hand: the next deploy overwrites it.

- `index.html` is the Serbian page, `en.html` the English one. English is not a
  second source: it is rendered from the same template plus a content store, so the
  design cannot drift between languages.
- The CMS itself (click-and-chat editor, API, Guardian, snapshots) is NOT here and
  never ships to the host.

## Status of the facts on the page

The page marks its own provisional figures. Blend names and prices and the bean
lineup are placeholders and say so on the page; drink prices come from a Wolt
harvest dated 2026-08-11; the dish list comes from a 2024 menu; opening hours are
read from public listings and are not yet confirmed by the owner.

Kept out of search on purpose (`robots.txt` plus a noindex meta tag) while those
placeholders stand.
