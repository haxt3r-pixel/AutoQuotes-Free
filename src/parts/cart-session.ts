import { chromium, type Browser, type Page } from 'playwright';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { clickAddToCartForPart } from './rockauto-cart-click.js';

export interface CartItem {
  part_number: string;
  part_name: string;
  price_text: string;
  quantity: number;
}

interface EnqueuedPart {
  part_number: string;
  listing_url: string;
  part_name: string;
  option_value?: string;
}

export class CartSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cartItems: CartItem[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    console.log('[CartSession] Starting persistent cart browser...');
    
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
    
    this.page = await context.newPage();
    
    // Block images/fonts for speed
    await this.page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'font' || type === 'media') {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    this.initialized = true;
    console.log('[CartSession] Persistent cart browser ready');
  }

  /** Add a part to the cart and wait for completion */
  async addPart(partNumber: string, listingUrl: string, partName: string, optionValue?: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    
    try {
      if (!this.page) return false;

      console.log(`[CartSession] Adding to cart: ${partName}`);
      
      await this.page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(1500);

      const added = await clickAddToCartForPart(this.page, partNumber, optionValue);

      if (added) {
        await this.page.waitForTimeout(1000);
        this.cartItems.push({
          part_number: partNumber,
          part_name: partName,
          price_text: '',
          quantity: 1,
        });
        console.log(`[CartSession] ✓ Added ${partNumber} to cart (${this.cartItems.length} total)`);
      }
      
      return added;
    } catch (err) {
      console.error(`[CartSession] Failed to add ${partNumber}:`, (err as Error).message);
      return false;
    }
  }

  /** Get current cart contents from the cart page */
  async getCartContents(): Promise<CartItem[]> {
    if (!this.page || this.cartItems.length === 0) return [];
    
    try {
      await this.page.goto('https://www.rockauto.com/en/cart/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      const items: CartItem[] = await this.page.evaluate(`(function() {
        var results = [];
        var rows = document.querySelectorAll('tr, .cart-item, .cart-row, [class*="cart"]');
        var currentItem = null;
        
        rows.forEach(function(row) {
          var text = (row.innerText || '').trim();
          if (text.length < 5) return;
          
          // Look for part number patterns
          var pnMatch = text.match(/\\\\b([A-Z0-9]{4,20}(?:-[A-Z0-9]+)?)\\\\b/);
          if (pnMatch && !/SUBTOTAL|TOTAL|SHIPPING/i.test(text)) {
            var priceMatch = text.match(/\\\\$(\\\\d+\\\\.\\\\d{2})/);
            currentItem = {
              part_number: pnMatch[1],
              part_name: text.substring(0, 80).replace('\\\\n', ' '),
              price_text: priceMatch ? '$' + priceMatch[1] : '',
              quantity: (text.match(/Qty[.:]?\\s*(\\d+)/i) || ['', '1'])[1]
            };
            results.push(currentItem);
          }
        });
        return results;
      })()`) as CartItem[];

      if (items.length > 0) {
        this.cartItems = items;
      }
      
      return this.cartItems;
    } catch (err) {
      console.error('[CartSession] Error reading cart:', (err as Error).message);
      return this.cartItems;
    }
  }

  /** Get the cart item count */
  getItemCount(): number {
    return this.cartItems.length;
  }

  /** Drop the isolated browser context and its cart cookies. */
  async clearCart(): Promise<void> {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
      console.log('[CartSession] Shutdown complete');
    }
    this.cartItems = [];
  }
}

export const cartSession = new CartSession();
