# Local assets and provenance

Both assets are vendored so the demonstrator makes no runtime network requests.

## `opensky-logo.jpg`

- The OpenSky logo supplied by the project owner (4–6 October 2026). It is the logo shown in the header and on printed documents. Replace the file, keeping the name, to update it.

## `sanofi-logo.svg` (no longer used in the app)

- **Source:** the Sanofi wordmark as served inline on the official corporate site header, `https://www.sanofi.com/en` (SVG element labelled "Sanofi", viewBox 0 0 80 22). Retrieved 3 October 2026 by copying the element verbatim into a standalone file. Only the framework CSS class and the `focusable` attribute were removed; the paths and fills are unchanged.
- **Not reconstructed or redrawn.** If Sanofi supplies a brand-approved asset, replace this file and keep the filename.
- **Use:** trademark of Sanofi. Used here to brand an internal prototype for a Sanofi audience. Confirm usage permission before wider distribution.
- The surrounding colour palette is a prototype styling choice, not a claimed official brand guide.

## `departements.geojson`

- **Source:** `https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson` (repository `https://github.com/gregoiredavid/france-geojson`), retrieved 3 October 2026.
- **Content verified:** 96 features (metropolitan departments including Corsica 2A and 2B), `code` as string (leading zeros kept, e.g. `01`) and `nom` properties. SHA-256 `C08A1AD48299763B50EF649F05A911C1021500C94719A1AA22A9D06191E43FC3`.
- **Underlying data:** INSEE official geographic code (COG, 2018 vintage) for names and codes; IGN Admin Express COG (2018 edition) for outlines, simplified by the repository author.
- **Licence:** the repository README states the data follow the Admin Express terms of use, the French **Licence Ouverte** (Etalab open licence): <http://www.etalab.gouv.fr/pages/licence-ouverte-open-licence-5899923.html>. The repository has no separate LICENSE file; the README statement is the licence reference. Attribution: "Contours: IGN Admin Express (Licence Ouverte), simplified by Grégoire David (france-geojson)".
- **Join:** departments are joined to geometry on the string `code`, never on name. The three overseas departments in the supplied data (971, 972, 973) are not drawn; the default extent is metropolitan France.
