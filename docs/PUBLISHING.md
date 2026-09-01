# Publishing KeyJump to the Chrome Web Store

Two halves. The **one-time setup** below has to happen by hand — Google requires a paid
developer account and a first upload through the dashboard before an item id even exists.
After that, the **release routine** is a version bump and a tag.

Nothing in this repo can change the live listing on its own. CI uploads drafts; submitting
for review is always a deliberate click or an explicit `--publish`.

---

## One-time setup

### 1. Developer account

Register at the [developer dashboard](https://chrome.google.com/webstore/devconsole). There
is a **one-time US$5 registration fee**, and the account needs a verified contact email.
That email is used by Google to reach you about reviews; it is not shown on the listing.

### 2. Create the item and get its id

Build a package and upload it manually the first time:

```bash
pnpm package                 # → dist/keyjump-1.0.0.zip
```

In the dashboard: **Items → Add new item → upload the zip**. When it lands you get a URL
like:

```
https://chrome.google.com/webstore/devconsole/.../abcdefghijklmnopabcdefghijklmnop/edit
                                                └──────── the 32-char item id ────────┘
```

Save that id. It is `CWS_EXTENSION_ID` everywhere below.

### 3. Fill in the listing

Copy is written out ready to paste in [`store/listing.md`](../store/listing.md). The fields
that block submission:

| Field | What to use |
| --- | --- |
| Store icon | `icons/icon128.png` (128×128, already the right size) |
| Screenshots | **At least one**, either 1280×800 or 640×400, max 5. See below. |
| Category | See `store/listing.md` |
| Language | English |
| Privacy policy URL | `https://github.com/vliejo/keyjump/blob/main/PRIVACY.md` |
| Single purpose | See `store/listing.md` |
| Permission justifications | One for `storage`, one for the host permission. Both in `store/listing.md`. |
| Data usage | Tick "does not collect", then all three certification boxes |

### 4. Screenshots

**Two are already captured**, both exactly 1280×800, in
[`store/screenshots/`](../store/screenshots/) — hints over a Wikipedia article, and the same
page after one keystroke narrows 57 targets to 14. Upload them in numbered order; the first
is what appears on the search result card. `store/listing.md` records what each one shows
and the exact recipe for reshooting them.

Two things worth knowing if you reshoot:

- What matters is the **viewport**, not the window — captures are page-only, with no browser
  chrome in frame. Check `window.innerWidth/innerHeight`, not the window size.
- Keep `devicePixelRatio` at 1. At DPR 2 the capture is downsampled below 1280 wide and
  upscaling will not bring the detail back.

Note that the Chrome Web Store's own pages block content scripts, so the extension cannot be
demonstrated on them — pick an ordinary public page. The bundled demo page also works and
runs the content scripts without installing anything:

```bash
pnpm demo    # then open http://localhost:8137/test/demo.html?standalone
```

A third shot of the options page is a nice-to-have; it lives at
`chrome-extension://<your-item-id>/src/options/options.html`.

### 5. Submit the first version

Click **Submit for review** in the dashboard. First reviews are slower than later ones —
budget a few days. Because the content script matches `<all_urls>`, expect the listing to
draw the more thorough review path; the justification in `store/listing.md` is written for
that.

---

## Automating uploads

Optional. Skip it and `pnpm package` plus a manual dashboard upload works forever.

### 6. Enable the API

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project.
2. **APIs & Services → Library → Chrome Web Store API → Enable**.
3. **OAuth consent screen** → External. **Set the publishing status to "In production".**
   Leaving it in "Testing" is the single most common thing that breaks this later: refresh
   tokens issued by a Testing app stop working after 7 days.
4. **Credentials → Create credentials → OAuth client ID → Desktop app.** Note the client id
   and client secret.

### 7. Mint a refresh token

```bash
CWS_CLIENT_ID=your-id CWS_CLIENT_SECRET=your-secret pnpm store:token
```

It prints a consent URL, catches the loopback redirect, and prints a refresh token. Run it
once; the token is long-lived. Google retired the old copy-the-code-from-your-browser flow,
which is why this needs a local server rather than a URL you can paste by hand.

### 8. Store the four secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
| --- | --- |
| `CWS_EXTENSION_ID` | the 32-character item id from step 2 |
| `CWS_CLIENT_ID` | from step 6 |
| `CWS_CLIENT_SECRET` | from step 6 |
| `CWS_REFRESH_TOKEN` | from step 7 |

Until all four exist, the release workflow still builds and attaches the zip to a GitHub
release — it just skips the store upload and says so.

Verify from your own machine, with the same four values exported:

```bash
pnpm store:status
```

---

## The release routine

1. **Bump the version in both `manifest.json` and `package.json`.** The release workflow
   fails if the tag and the manifest disagree. Store versions must strictly increase; the
   same number cannot be uploaded twice.
2. **Confirm it packages** with `pnpm package`.
3. **Commit, tag `vX.Y.Z`, and push the tag.**

The tag fires `.github/workflows/release.yml`, which:

1. checks the tag matches `manifest.json`,
2. builds and validates the package,
3. creates a GitHub release with the zip attached,
4. uploads the zip to the store **as a draft**.

Then open the dashboard and click **Submit for review** when you are happy with it.

To do the upload from your own machine instead:

```bash
pnpm store:upload    # upload as a draft; live listing untouched
pnpm store:submit    # upload AND submit for review
```

---

## When it goes wrong

| Symptom | Cause |
| --- | --- |
| `invalid_grant` getting a token | Refresh token expired or revoked. Usually the consent screen is still "Testing" — set it to "In production" (step 6) and mint a new one. |
| Upload returns `FAILURE` with no obvious error | Almost always a version that does not strictly exceed the published one. Bump it. |
| `Invalid manifest` | Run `pnpm package` locally; the validations there mirror what the store enforces. |
| Review rejected over the host permission | The `<all_urls>` justification in `store/listing.md` is what to paste; make sure the privacy policy URL resolves publicly. |
| Release workflow fails at the tag check | `manifest.json` and the tag disagree. Fix the manifest, re-tag. |
