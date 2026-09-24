import path from "node:path";
import { MESSAGE, messageReport, stats } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

/**
 * README screenshots from the fixture report (run: CAPTURE_SCREENSHOTS=1 npx playwright test
 * screenshots). Skipped otherwise, so CI never rewrites docs. SCREENSHOT_DIR overrides the output.
 */
const OUT = process.env.SCREENSHOT_DIR ?? path.join(import.meta.dirname, "../../docs");

for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
        test.use({ colorScheme: scheme, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

        test(`@screenshots results page in ${scheme} mode`, async ({ page, api, app }) => {
            test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 to regenerate");
            await api.stream(fullStream(messageReport()));
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await expect(app.verdictLabel("Dangerous")).toBeVisible();
            await app.settle();
            await page.screenshot({ path: path.join(OUT, `screenshot-${scheme}.png`), fullPage: false });
        });

        test(`@screenshots home page in ${scheme} mode`, async ({ page, api, app }) => {
            test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 to regenerate");
            await api.stats(stats);
            await page.goto("/");
            await expect(app.statsRegion()).toBeVisible();
            await app.settle();
            await page.screenshot({ path: path.join(OUT, `home-${scheme}.png`), fullPage: true });
        });
    });
}
