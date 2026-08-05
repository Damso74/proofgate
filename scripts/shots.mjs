import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const URL = process.argv[2] ?? "http://127.0.0.1:4173/";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(URL, { waitUntil: "networkidle" });
await desktop.waitForTimeout(1800);
await desktop.screenshot({ path: `${OUT}/a-authorized-1440.png` });

// La capture B n'est retenue qu'APRÈS vérification : la version intermédiaire
// est un doublon moins convaincant.
await desktop.getByRole("tab", { name: /Blocked/ }).click();
await desktop.waitForTimeout(1800);

await desktop.getByRole("button", { name: "Verify proof" }).click();
await desktop.getByTestId("verify-status").waitFor({ timeout: 15_000 });
await desktop.waitForTimeout(300);
await desktop.screenshot({ path: `${OUT}/b-blocked-verified-1440.png` });

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto(URL, { waitUntil: "networkidle" });
await mobile.waitForTimeout(1800);
await mobile.screenshot({ path: `${OUT}/a-authorized-375.png`, fullPage: true });

console.warn(`screenshots -> ${OUT}`);
await browser.close();
