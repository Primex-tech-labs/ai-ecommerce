import { expect, test, type Page } from "@playwright/test";

const NEBULA = "Nebula AI Robot Vacuum";
const NEBULA_URL = "/product/nebula-ai-robot-vacuum";

function productCard(page: Page, name: string) {
  return page.locator("article").filter({ hasText: name });
}

test("browses the catalog and opens a product", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI-assisted storefront" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(3);
  await expect(productCard(page, NEBULA)).toBeVisible();

  await page.goto(NEBULA_URL);
  await expect(page.getByRole("heading", { name: NEBULA })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeVisible();
});

test("adds, updates, removes and reaches checkout", async ({ page }) => {
  await page.goto(NEBULA_URL);

  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart \(1\)/ })).toBeVisible();

  await page.getByRole("button", { name: "Pro + Auto-Empty Dock" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart \(2\)/ })).toBeVisible();

  await page.getByRole("link", { name: /Cart \(2\)/ }).click();
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();

  const lines = page.getByRole("listitem");
  await expect(lines).toHaveCount(2);

  const quantity = page.locator('input[type="number"]').first();
  await quantity.fill("3");
  await expect(quantity).toHaveValue("3");

  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(lines).toHaveCount(1);

  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pay with Stellar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place demo order (no payment)" }),
  ).toBeVisible();
});

test("places a demo order and clears the cart", async ({ page }) => {
  await page.goto("/");
  await productCard(page, "Lumen Smart Display")
    .getByRole("button", { name: "Add to cart" })
    .click();
  await page.getByRole("link", { name: /Cart \(1\)/ }).click();
  await page.getByRole("link", { name: "Checkout" }).click();

  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Place demo order (no payment)" }).click();

  await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cart \(0\)/ })).toBeVisible();
});

test("answers through the stub AI provider", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Shopping assistant")).toBeVisible();

  await page.getByRole("button", { name: "gift under $200" }).click();

  await expect(page.getByText(/here are some options/i)).toBeVisible({
    timeout: 30_000,
  });
});
