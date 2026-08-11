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
const PRIMARY_TX =
  "https://sepolia.etherscan.io/tx/0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062";
const REPLAY_TX =
  "https://sepolia.etherscan.io/tx/0x0801289edfdcfd919b64b1f7e267d935674d09fa09de7a9670b8aa169bcb605e";

test.describe("ProofGate", () => {
  test("raconte les deux scénarios et vérifie la preuve dans le navigateur", async ({ page }) => {
    const collected = collect(page);
    await page.goto("/", { waitUntil: "networkidle" });

    // 1. Le produit principal est visible sans confondre son run avec le replay.
    await expect(
      page.getByRole("heading", { name: "An onchain agent that can prove what it did." }),
    ).toBeVisible();
    const primaryRun = page.getByTestId("primary-run");
    await expect(primaryRun).toContainText("0.1");
    const primaryMetrics = primaryRun.locator(".run-metrics > div");
    await expect(primaryMetrics.nth(0)).toContainText(/1\s*KeeperHub execute/);
    await expect(primaryMetrics.nth(1)).toContainText(/0\s*Retries/);
    await expect(primaryMetrics.nth(2)).toContainText(/RPC\s*Independent verification/);
    await expect(page.getByRole("link", { name: /View 0.1 USDC onchain/ })).toHaveAttribute(
      "href",
      PRIMARY_TX,
    );
    await expect(page.getByRole("link", { name: /Explore agent code/ })).toHaveAttribute(
      "href",
      "https://github.com/Damso74/keeper-agent",
    );
    await expect(page.getByRole("link", { name: "Read evidence" })).toHaveAttribute(
      "href",
      "https://github.com/Damso74/keeper-agent/blob/main/EVIDENCE.md",
    );
    await expect(page.getByTestId("console-note")).toContainText("separate 1 USDC run");
    await expect(page.getByTestId("console-note")).toContainText("no live RPC call");

    // 2-3. Scénario A affiché initialement, verdict et transaction de replay visibles.
    await expect(tabAuthorized(page)).toHaveAttribute("aria-selected", "true");
    await expect(headline(page)).toHaveText("ONCHAIN SUCCESS VERIFIED");
    await expect(page.getByTestId("verdict-subline")).toHaveText(
      "Provider simulation discrepancy detected",
    );
    await expect(page.getByTestId("replay-tx-link")).toHaveAttribute("href", REPLAY_TX);

    // 4. Le replay A parcourt tous les nœuds attendus et attribue Transfer à USDC.
    for (const key of ["intent", "keeperhub", "policy", "safe", "token", "verdict"]) {
      await expect(page.getByTestId(`node-${key}`)).toHaveAttribute("data-reached", "1");
    }
    await expect(page.getByTestId("node-token")).toHaveAttribute("data-on", "1", { timeout: 10_000 });
    await expect(page.getByTestId("node-safe")).toContainText("Module execution succeeded");
    await expect(page.getByTestId("node-token")).toContainText("Transfer event emitted");

    // 5-6. Bascule vers B.
    await tabBlocked(page).click();
    await expect(tabBlocked(page)).toHaveAttribute("aria-selected", "true");
    await expect(tabAuthorized(page)).toHaveAttribute("aria-selected", "false");
    await expect(headline(page)).toHaveText("BLOCKED BY POLICY");
    await expect(page.getByTestId("verdict-subline")).toHaveText("Would be rejected before broadcast");
    await expect(page.getByTestId("replay-tx-link")).toHaveCount(0);

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
    await expect(headline(page)).toHaveText("ONCHAIN SUCCESS VERIFIED");
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

  test("la proposition de valeur principale est visible sans défilement", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const heroTitle = page.getByRole("heading", {
      name: "An onchain agent that can prove what it did.",
    });
    await expect(heroTitle).toBeVisible();
    const box = await heroTitle.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  // Le rejet d'une preuve altérée est couvert par 4 tests unitaires réels dans
  // tests/parity.test.ts (montant, block tag, revert, fixture post-digest).
  // Il n'est pas rejouable en E2E : les fixtures sont compilées dans le bundle.
});
