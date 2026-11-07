import type { Page } from 'playwright';

/**
 * RockAuto renders every part listing as a `tbody.listing-inner` on current
 * catalog pages (older markup used `tr.listing-inner` / `tr.rowselected`).
 *
 * Any selector broader than the listing row — e.g. `div[class*="listing"]` —
 * also matches the page-level `listings-container`, which holds EVERY part and
 * EVERY Add-to-Cart button. A substring part-number match against that
 * container matches first and always clicks the first button on the page, so
 * the cart only ever ends up with the first part. Match the exact listing row
 * and the exact part number (as a standalone token) instead.
 */
const LISTING_ROW_SELECTOR =
  'tbody.listing-inner, tr.listing-inner, tr.rowselected, div.listing-inner';

const CART_SELECTOR =
  'input[value^="Add to Cart"], input[alt^="Add to Cart"], input[name^="addpart"]';

/**
 * Click the Add-to-Cart button that belongs to `partNumber` on a RockAuto
 * listing page. Returns true only when that part's own button was clicked;
 * never clicks an unrelated Add-to-Cart button.
 */
export async function clickAddToCartForPart(
  page: Page,
  partNumber: string,
  optionValue?: string,
): Promise<boolean> {
  if (optionValue) {
    const selected = await page.evaluate(
      (args: { pn: string; optionValue: string; rowSelector: string }) => {
        const doc = (globalThis as any).document;
        const pnRe = new RegExp(
          '(^|[^A-Z0-9])' + args.pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Z0-9])',
        );
        const rows: any = doc.querySelectorAll(args.rowSelector);
        for (const row of rows) {
          if (!pnRe.test(row.innerText || '')) continue;
          const select = row.querySelector('select.listing-optionchoice-multiple');
          if (!select || !Array.from(select.options).some((option: any) => option.value === args.optionValue)) {
            return false;
          }
          select.value = args.optionValue;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      },
      { pn: partNumber, optionValue, rowSelector: LISTING_ROW_SELECTOR },
    );
    if (!selected) return false;
    await page.waitForTimeout(500);
  }

  return page.evaluate(
    (args: { pn: string; rowSelector: string; cartSelector: string }) => {
      const doc = (globalThis as any).document;
      // Only match the part number as a standalone token ("D537" must not
      // match "PD537", "14D537CHF2", etc.).
      const pnRe = new RegExp(
        '(^|[^A-Z0-9])' + args.pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Z0-9])',
      );
      const rows: any = doc.querySelectorAll(args.rowSelector);
      for (const row of rows) {
        const text = row.innerText || '';
        if (!pnRe.test(text)) continue;
        const inputs = row.querySelectorAll(args.cartSelector);
        if (inputs.length > 0) {
          inputs[0].click();
          return true;
        }
        // Part number present in this listing row but no button found — bail
        // out rather than guess at an unrelated button.
        return false;
      }
      return false;
    },
    { pn: partNumber, rowSelector: LISTING_ROW_SELECTOR, cartSelector: CART_SELECTOR },
  ) as unknown as boolean;
}
