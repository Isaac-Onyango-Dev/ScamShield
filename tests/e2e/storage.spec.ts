import { MESSAGE, messageReport } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { expect, setStorageMode, test } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;

async function openReport(page: import("@playwright/test").Page, app: import("./support/app").App) {
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await app.reportButton().click();
    await expect(app.reportDialog()).toBeVisible();
}

test("@storage-notice ephemeral deployments say reports are temporary wherever reports appear", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await openReport(page, app);
    await expect(app.reportDialog()).toContainText("Reports are stored temporarily on this demo deployment and are cleared when the server restarts.");
    await page.keyboard.press("Escape");
    await expect(app.cardText(app.sourceCard("Community reports"), "Reports are stored temporarily on this demo deployment.")).toBeVisible();

    await app.gotoApiDocs();
    await expect(app.storageNotice()).toBeVisible();
});

test("@storage-notice persistent deployments show no storage notice", async ({ page, api, app }) => {
    await setStorageMode(page, "persistent");
    await api.stream(fullStream(messageReport()));
    await openReport(page, app);
    await expect(app.storageNotice()).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(app.storageNotice()).toHaveCount(0);
    await app.gotoApiDocs();
    await expect(app.storageNotice()).toHaveCount(0);
});

test("@storage-fallback an unrendered storage placeholder is treated as ephemeral", async ({ page, api, app }) => {
    await setStorageMode(page, "unrendered");
    await api.stream(fullStream(messageReport()));
    await openReport(page, app);
    await expect(app.storageNotice()).toBeVisible();
});
