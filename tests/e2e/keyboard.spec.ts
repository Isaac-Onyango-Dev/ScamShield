import { MESSAGE, messageReport, stats } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;

test("@keyboard the first Tab reaches the skip link, which moves focus to the content", async ({ page, api, app }) => {
    await api.stats(stats);
    await page.goto("/");
    await page.keyboard.press("Tab");
    expect(await app.focusedText()).toBe("Skip to content");
    await page.keyboard.press("Enter");
    expect(await app.focusedId()).toBe("main");
});

test("@keyboard a lookup can be typed and submitted without a mouse", async ({ page, api, app }) => {
    await api.stats(stats);
    await api.stream(fullStream(messageReport()));
    await page.goto("/");
    await app.searchInput().focus();
    await page.keyboard.type("example.com");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/search?q=example.com");
});

test("@keyboard the findings filter is operated with arrow keys", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await app.findingsFilter("All").focus();
    await page.keyboard.press("ArrowRight");
    await expect(app.findingsFilter("Flags")).toBeChecked();
    await expect(app.findingsFilter("Flags")).toBeFocused();
});

test("@keyboard the report dialog traps focus, closes on Escape and returns focus", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await app.reportButton().focus();
    await page.keyboard.press("Enter");
    await expect(app.reportDialog()).toBeVisible();
    await expect(app.categoryOption("scam")).toBeFocused();

    for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        expect(await app.focusIsInsideDialog()).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(app.reportDialog()).toBeHidden();
    await expect(app.reportButton()).toBeFocused();
});
