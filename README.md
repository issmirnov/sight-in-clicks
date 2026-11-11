# Sight-In Clicks

Sight-In Clicks tells you how many clicks to turn your scope or red dot while you sight it in. Tap where your shots hit on a 12 by 18 inch target with a 1-inch grid. The bar at the bottom shows the elevation and windage clicks.

Open it at https://issmirnov.github.io/sight-in-clicks/

## Put it on your phone

Open this link on your phone, or scan the code with your phone's camera:

https://issmirnov.github.io/sight-in-clicks/?install

<img src="install-qr.svg" alt="QR code for the install link" width="180" height="180">

The link opens the page with steps for your phone. On Android, tap Install. On an iPhone or iPad, tap Share, then Add to Home Screen, then Add. If Safari only shows a ··· button, tap it to find Share. The Install button at the top of the page does the same.

No link can add a page to the home screen by itself. Android browsers let the page offer its own Install button. iOS only allows the Share menu, so the iPhone steps stay manual.

After you add it, open it once from the home screen while you have signal. That launch saves the page on your phone, and after that it works offline.

## How to use it

1. Pick the distance in yards, or type your own.
2. Pick your optic's click value: ½ MOA (EOTech, Tango-MSR), ¼ MOA, 0.1 MRAD or 1 MOA.
3. Pick your aim point: the center, or one of the four corner squares.
4. Shoot a group. Tap each hole on the screen where it sits on the paper. The grid matches the paper's 1-inch squares.
5. Turn each dial the number of clicks shown, in the direction of its arrow. HOLD means leave that dial alone.
6. Tap Clear, shoot again and check.

The page opens with an example group, and your first tap replaces it. Undo removes your last tap. The page remembers your distance, optic and aim point between visits.

## How it works

The page averages your holes to find the group center. The correction is the distance from the group center to your aim point, in inches. The page divides it by how far one click moves the impact at your distance:

- MOA: inches per click = click value × 1.047 × yards ÷ 100
- MRAD: inches per click = click value × 3.6 × yards ÷ 100

For example, ½ MOA clicks at 50 yards move the impact 0.26 inches each. A group 2 inches low needs 2 ÷ 0.26 = 7.6 clicks, which rounds to 8 clicks up. The bar shows whole clicks, and the line under it shows the exact values.

## Offline and privacy

Everything runs on your phone. Nothing you tap is sent anywhere, and there is no account or tracking. The page loads its fonts from Google Fonts, and the offline copy includes them.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles and script, with no build step. |
| `sw.js` | The service worker. It saves the page, icons and fonts for offline use. |
| `manifest.webmanifest` | The name, colors and icons for the home screen. |
| `icons/` | `icon.svg` and `icon-maskable.svg` are the sources of the PNG icons. |
| `install-qr.svg` | The QR code for the install link. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Updating it

Commit and push to `main`. GitHub Pages deploys the change in about a minute. A phone that already has the app downloads the new version in the background and shows it on the next launch.

If you add a file the page needs offline, add it to `SHELL` in `sw.js` and bump `VERSION`. If you change the Google Fonts link in `index.html`, change `FONT_CSS` in `sw.js` to match.

To rebuild the icons and the QR code, you need `rsvg-convert`, ImageMagick and `qrencode`:

```sh
rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
rsvg-convert -w 180 -h 180 icons/icon.svg -o icons/apple-touch-icon.png
rsvg-convert -w 512 -h 512 icons/icon-maskable.svg -o icons/icon-maskable-512.png
magick mogrify -alpha off icons/*.png
qrencode -t SVG --svg-path -o install-qr.svg 'https://issmirnov.github.io/sight-in-clicks/?install'
```
