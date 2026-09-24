import { REPORT_CATEGORIES } from "../../shared/types";
import { MESSAGE, messageReport } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;

test.beforeEach(async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await app.reportButton().click();
    await expect(app.reportDialog()).toBeVisible();
});

test("@F13 report dialog offers every category, defaults to scam and caps the description", async ({ app }) => {
    await expect(app.categoryOptions()).toHaveCount(REPORT_CATEGORIES.length);
    for (const c of REPORT_CATEGORIES) await expect(app.categoryOption(c)).toBeVisible();
    expect(await app.selectedCategory()).toBe("scam");
    await expect(app.reportDescription()).toHaveAttribute("maxlength", "1000");
});

test("@F13 a new report is submitted and the lookup re-runs without the cache", async ({ api, app }) => {
    await api.report(201, { id: 1, duplicate: false, reportCount: 1, message: "Report received. Thank you for protecting others." });
    await app.selectCategory("phishing");
    expect(await app.selectedCategory()).toBe("phishing");
    await app.reportDescription().fill("SMS lure");
    await app.submitReportButton().click();

    await expect.poll(() => api.reportBodies.length).toBe(1);
    expect(api.reportBodies).toEqual([{ query: MESSAGE, type: "text", category: "phishing", description: "SMS lure" }]);
    await expect.poll(() => api.streamUrls.length).toBe(2);
    expect(api.streamUrls[1].searchParams.get("fresh")).toBe("1");
});

// Regression test for audit #31: the re-run after a successful report used to remount the
// dialog, so the confirmation was never shown.
test("@F13 @bug-31 the confirmation stays visible after a successful report", async ({ api, app }) => {
    await api.report(201, { id: 1, duplicate: false, reportCount: 1, message: "Report received. Thank you for protecting others." });
    await app.submitReportButton().click();
    await expect.poll(() => api.streamUrls.length).toBe(2);
    await expect(app.reportDialog()).toContainText("Report received. Thank you for protecting others.", { timeout: 2000 });
});

test("@F13 a duplicate report is acknowledged without re-running", async ({ api, app }) => {
    await api.report(200, { id: 1, duplicate: true, reportCount: 3, message: "You've already reported this — thanks!" });
    await app.submitReportButton().click();
    await expect(app.reportDialog()).toContainText("You've already reported this — thanks!");
    expect(api.reportBodies).toHaveLength(1);
    expect(api.streamUrls).toHaveLength(1);
});

test("@F13 Escape closes the dialog", async ({ page, app }) => {
    await page.keyboard.press("Escape");
    await expect(app.reportDialog()).toBeHidden();
});
