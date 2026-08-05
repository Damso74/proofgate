import { expect, test, type Page } from "@playwright/test";

/** Bruit console connu et sans rapport avec l'application. */
const KNOWN_NOISE: RegExp[] = [];

type Collected = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

/** Listeners enregistrés AVANT toute navigation. */
function collect(page: Page): Collected {
  const out: Collected = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    badResponses: [],
  };
  page.on("pageerror", (error) => out.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (KNOWN_NOISE.some((pattern) => pattern.test(text))) return;
    out.consoleErrors.push(text);
  });
  page.on("requestfailed", (request) =>
    out.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "?"}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) out.badResponses.push(`${response.status()} ${response.url()}`);
  });
  return out;
}

const tabAuthorized = (page: Page) => page.getByRole("tab", { name: /Authorized/ });
const tabBlocked = (page: Page) => page.getByRole("tab", { name: /Blocked/ });
const headline = (page: Page) => page.getByTestId("verdict-headline");

test.describe("ProofGate", () => {
  test("raconte les deux scénarios et vérifie la preuve dans le navigateur", async ({ page }) => {
    const collected = collect(page);
    await page.goto("/", { waitUntil: "networkidle" });

    // 1-2. Scénario A affiché initialement, verdict visible.
    await expect(tabAuthorized(page)).toHaveAttribute("aria-selected", "true");
    await expect(headline(page)).toHaveText("EXECUTED ON-CHAIN");
    await expect(page.getByTestId("verdict-subline")).toHaveText("Verified with warnings");

    // 3. Le replay A parcourt tous les nœuds attendus.
    for (const key of ["intent", "keeperhub", "policy", "safe", "token", "verdict"]) {
      await expect(page.getByTestId(`node-${key}`)).toHaveAttribute("data-reached", "1");
    }
    await expect(page.getByTestId("node-token")).toHaveAttribute("data-on", "1", { timeout: 10_000 });

    // 4-5. Bascule vers B.
    await tabBlocked(page).click();
    await expect(tabBlocked(page)).toHaveAttribute("aria-selected", "true");
    await expect(tabAuthorized(page)).toHaveAttribute("aria-selected", "false");
    await expect(headline(page)).toHaveText("BLOCKED BY POLICY");
    await expect(page.getByTestId("verdict-subline")).toHaveText("Would be rejected before broadcast");

    // 6-7. L'animation s'arrête sur Policy ; Safe et USDC restent non exécutés.
    await expect(page.getByTestId("node-policy")).toHaveAttribute("data-halt", "1", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("node-safe")).toHaveAttribute("data-reached", "0");
    await expect(page.getByTestId("node-token")).toHaveAttribute("data-reached", "0");
    await expect(page.getByTestId("node-safe")).toContainText("Not executed");
    await expect(page.getByTestId("path-note")).toContainText("No transaction was broadcast");

    // Le digest change réellement entre scénarios.
    const digestB = await page.getByTestId("digest-short").textContent();

    // 8-9. Vérification réelle dans le navigateur.
    await page.getByRole("button", { name: "Verify proof" }).click();
    await expect(page.getByTestId("verify-status")).toHaveText(
      "Verified locally in your browser",
      { timeout: 15_000 },
    );
    const fullDigest = await page.getByTestId("digest-full").textContent();
    expect(fullDigest?.trim()).toMatch(/^[a-f0-9]{64}$/);

    // 10. Retour vers A.
    await tabAuthorized(page).click();
    await expect(headline(page)).toHaveText("EXECUTED ON-CHAIN");
    const digestA = await page.getByTestId("digest-short").textContent();
    expect(digestA).not.toBe(digestB);

    // 11. Drawer de preuve.
    await page.getByRole("button", { name: "Raw evidence" }).click();
    await expect(page.getByTestId("drawer")).toBeVisible();
    await page.getByRole("tab", { name: "Checks" }).click();
    await expect(page.getByTestId("checks-list")).toBeVisible();
    await page.getByRole("tab", { name: "Raw data" }).click();
    await expect(page.locator("pre.raw")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("drawer")).toHaveCount(0);

    // 13-15. Aucune erreur, aucun asset en échec.
    expect(collected.pageErrors).toEqual([]);
    expect(collected.consoleErrors).toEqual([]);
    expect(collected.failedRequests).toEqual([]);
    expect(collected.badResponses).toEqual([]);
  });

  test("aucun débordement horizontal sur les deux scénarios", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    for (const tab of [tabAuthorized, tabBlocked]) {
      await tab(page).click();
      await page.waitForTimeout(400);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    }
  });

  test("le verdict est visible sans défilement", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const verdict = headline(page);
    await expect(verdict).toBeVisible();
    const box = await verdict.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  // Le rejet d'une preuve altérée est couvert par 4 tests unitaires réels dans
  // tests/parity.test.ts (montant, block tag, revert, fixture post-digest).
  // Il n'est pas rejouable en E2E : les fixtures sont compilées dans le bundle.
});
