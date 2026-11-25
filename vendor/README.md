# Vendored third-party code

| File | Source | Version | License |
| --- | --- | --- | --- |
| `chart.umd.min.js` | npm package [`chart.js`](https://www.npmjs.com/package/chart.js), file `dist/chart.umd.min.js` | 4.5.1 | MIT (`chartjs-LICENSE.md`) |

The file is copied unmodified from the published npm tarball. The tarball's npm integrity value is
`sha512-GIjfiT9dbmHRiYi6Nl2yFCq7kkwdkp1W/lp2J99rX0yo9tgJGn3lKQATztIjb5tVtevcBtIdICNWqlq5+E8/Pw==`
and the SHA-256 of the extracted file is
`48444a82d4edcb5bec0f1965faacdde18d9c17db3063d042abada2f705c9f54a`
(checked by `tests/vendor.test.js`).

Serving Chart.js from this repository lets the Content Security Policy restrict scripts to `'self'`
and removes the runtime dependency on a third-party CDN.

## Updating

```bash
npm pack chart.js@<version>
tar xzf chart.js-<version>.tgz
cp package/dist/chart.umd.min.js vendor/chart.umd.min.js
cp package/LICENSE.md vendor/chartjs-LICENSE.md
sha256sum vendor/chart.umd.min.js   # update this file and tests/vendor.test.js
```
