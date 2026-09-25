import {
  header,
  footer,
  mobileTabBar,
  icons,
  initRevealObserver,
  attachHeaderBehaviour,
  skeletonCard,
  toast
} from './components.js';

import {
  loginPage,
  attachLoginPage,
  cartPage,
  attachCartPage,
  homePage,
  shopPage,
  attachShopPage,
  productDetailPage,
  attachProductDetailPage,
  wishlistPage,
  ordersPage,
  orderDetailPage,
  successOrderCard,
  attachOrderCardPage,
  profilePage,
  attachProfilePage,
  aboutPage,
  servicesPage,
  contactPage,
  attachContactPage,
} from './pages.js';

import {
  authService,
  orderService,
  customerService,
  productService,
  cartService
} from './services.js';

import { openGetCodeModal } from './getCodeModal.js';
import { mountHelpWidget } from './helpWidget.js';

const app = document.getElementById('app');

// The browser's own scroll restoration on back/forward races with the
// router's own top-of-page reset below (and can re-introduce the previous
// page's scroll position after we've already reset it). Taking manual
// control here makes our explicit reset in render() the single source of
// truth for scroll position on every route change, including history
// navigation.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// Resets the main document scroll position to the top instantly.
//
// styles.css sets `html { scroll-behavior: smooth; }` globally (used for
// in-page anchor scrolling). window.scrollTo({ top: 0, behavior: 'auto' })
// does NOT mean "instant" — per the CSSOM View spec, behavior: 'auto' means
// "defer to the element's scroll-behavior CSS property", which is 'smooth'
// here. That is what made every route change visibly animate upward from
// the previous page's scroll position instead of simply starting at the
// top ("pages open from the bottom toward the top"). Temporarily
// overriding scroll-behavior to 'auto' via inline style (which wins over
// the stylesheet rule) forces a true instant jump, then we restore
// whatever was there before so in-page smooth-scroll behavior elsewhere is
// unaffected.
function resetScrollToTop() {
  const root = document.documentElement;
  const body = document.body;

  // Temporarily disable smooth scrolling so route changes
  // never visibly animate from the old page position.
  const previousRootBehavior = root.style.scrollBehavior;
  const previousBodyBehavior = body.style.scrollBehavior;

  root.style.scrollBehavior = 'auto';
  body.style.scrollBehavior = 'auto';

  // Reset every possible document scroll container.
  window.scrollTo(0, 0);
  root.scrollTop = 0;
  body.scrollTop = 0;

  // Force the browser to remain at the top after the current
  // navigation/render cycle.
  requestAnimationFrame(() => {
    root.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';

    window.scrollTo(0, 0);
    root.scrollTop = 0;
    body.scrollTop = 0;

    // Restore the original CSS behavior after the reset.
    root.style.scrollBehavior = previousRootBehavior;
    body.style.scrollBehavior = previousBodyBehavior;
  });
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString] = raw.split('?');
  const params = Object.fromEntries(
    new URLSearchParams(queryString || '')
  );

  return {
    path: path.replace(/\/$/, '') || '/',
    params
  };
}

const NO_CHROME = new Set(['/login']);

function layout(contentHtml, { chrome = true } = {}) {
  if (!chrome) return contentHtml;

  return `${header()}<main class="min-h-[60vh]">${contentHtml}</main>${footer()}${mobileTabBar()}`;
}

async function render({ resetScroll = true } = {}) {
  const { path, params } = parseHash();

  // Always scroll to the top when navigating to a new page.
  // This runs BEFORE any asynchronous API loading so the new page
  // does not inherit the previous page's scroll position.
  if (resetScroll) {
    resetScrollToTop();
  }

  // Lazy-load products only on routes that actually need the catalog.
  // The home page can render immediately without waiting for the API.
  const needsProducts =
    path === '/shop' || path.startsWith('/product/');

  if (needsProducts) {
    await productService.load();

    if (productService.error) {
      console.error(
        'Product API unavailable:',
        productService.error
      );
    }
  }

  // Load orders only on order-related pages.
  if (
    path === '/orders' ||
    path.startsWith('/order/') ||
    path.startsWith('/success/')
  ) {
    try {
      await orderService.load();
    } catch (e) {
      console.error('Order API unavailable', e);
    }
  }

  let content = '';
  let after = null;

  const showChrome = !NO_CHROME.has(path);

  if (path === '/login') {
    content = loginPage();
    after = () => attachLoginPage(render);

  } else if (path === '/') {
    content = homePage();
    after = () => initRevealObserver();

  } else if (path === '/shop') {
    content = shopPage(params);
    after = () => attachShopPage(params);

  } else if (path.startsWith('/product/')) {
    const slug = path.replace('/product/', '');
    content = productDetailPage(slug);
    after = () => attachProductDetailPage();

  } else if (path === '/cart') {
    content = await cartPage();
    after = () => attachCartPage(render);

  } else if (path === '/wishlist') {
    content = wishlistPage();

  } else if (path === '/orders') {
    content = ordersPage();
    after = () => attachOrderCardPage();

  } else if (path.startsWith('/order/')) {
    const id = path.replace('/order/', '');
    content = orderDetailPage(id);
    after = () => attachOrderCardPage();

  } else if (path.startsWith('/success/')) {
    const id = path.replace('/success/', '');
    const order = orderService.byId(id);

    content = order
      ? successOrderCard(order)
      : `<div class="max-w-xl mx-auto px-4 py-24 text-center">
          Order not found.
        </div>`;

    after = () => attachOrderCardPage();

  } else if (path === '/profile') {
    content = profilePage();
    after = () => attachProfilePage();

  } else if (path === '/about') {
    content = aboutPage();

  } else if (path === '/services') {
    content = servicesPage();
    after = () => initRevealObserver();

  } else if (path === '/contact') {
    content = contactPage();
    after = () => attachContactPage();

  } else {
    content = `<div class="max-w-xl mx-auto px-4 py-32 text-center">
      <h1 class="font-display text-2xl font-semibold mb-2">
        Page not found
      </h1>
      <a href="#/" class="text-fc-green font-medium">
        Back to Home
      </a>
    </div>`;
  }

  app.innerHTML = layout(content, {
    chrome: showChrome
  });

  // Reset again once the new page's markup is actually in the DOM. The
  // reset above (before the async product/order loads) covers the common
  // case, but this second pass guards against the new content's real
  // height only existing from this point on.
  if (resetScroll) {
    resetScrollToTop();
  }

  icons();

  if (showChrome) {
    attachHeaderBehaviour(render);
  }

  if (after) {
    after();
  }

  bindGlobalDelegates();

  refreshCartBadge();
}

// Updates the header cart badge from the existing cart implementation
// (the backend, scoped to the signed-in customer's own token — never a
// locally-cached number). Called after every render so the badge is never
// left showing a previous page's, or a previous customer's, count, and
// also called directly after add/remove/quantity actions that don't
// trigger a full re-render, so the badge updates immediately rather than
// only on next navigation.
function refreshCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;

  if (!authService.isLoggedIn()) {
    // No signed-in customer: never show a stale/leftover count.
    badge.textContent = '0';
    badge.classList.add('hidden');
    return;
  }

  cartService
    .get()
    .then(cart => {
      const count = (cart?.items || []).reduce(
        (n, item) => n + Number(item.quantity || 0),
        0
      );

      badge.textContent = String(count);
      badge.classList.toggle('hidden', count === 0);
    })
    .catch(() => {});
}

// Delegated handlers for controls that appear inside dynamically-rendered
// HTML strings across many pages (product cards, detail page, etc).
function bindGlobalDelegates() {
  app.querySelectorAll('[data-cart-add]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Cart requires a signed-in customer on the backend.
      // Check locally first so the user lands on Login with a clear
      // reason instead of hitting a raw 401 from the API.
      const productId = btn.getAttribute('data-cart-add');

      if (!authService.isLoggedIn()) {
        toast('Please log in to add items to your cart', {
          type: 'error'
        });

        window.location.hash = '#/login';
        return;
      }

      try {
        await cartService.add(
          btn.getAttribute('data-cart-add'),
          1
        );

        toast('Added to cart');
        refreshCartBadge();

      } catch (err) {
        if (err.status === 401) {
          toast(
            'Your session has expired. Please log in again.',
            { type: 'error' }
          );

          window.location.hash = '#/login';

        } else {
          toast(
            err.message || 'Could not add to cart',
            { type: 'error' }
          );
        }
      }
    });
  });

  app.querySelectorAll('[data-getcode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      openGetCodeModal(
        btn.getAttribute('data-getcode')
      );
    });
  });

  app.querySelectorAll('[data-wishlist]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id = btn.getAttribute('data-wishlist');

      const nowIn =
        customerService.toggleWishlist(id).includes(id);

      toast(
        nowIn
          ? 'Added to wishlist'
          : 'Removed from wishlist'
      );

      // Re-render in place (no scroll jump) so every heart icon,
      // the header badge, the mobile tab bar count and the
      // wishlist page itself stay in sync immediately.
      render({
        resetScroll: false
      });
    });
  });
}

// ============================================================
// ROUTE NAVIGATION + SCROLL POSITION CONTROL
// ============================================================

// Handle browser back/forward and normal hash route changes.
//
// IMPORTANT:
// We do NOT allow the browser to restore the previous page's
// scroll position. Every application route starts at the top.
window.addEventListener('hashchange', async () => {
  resetScrollToTop();

  await render({
    resetScroll: true
  });

  // Final safety reset after the new route has been rendered.
  resetScrollToTop();
});


// ============================================================
// INTERNAL APPLICATION LINK HANDLER
// ============================================================
//
// All customer-site routes use hash URLs:
//
//   #/
//   #/shop
//   #/shop?category=transferring
//   #/product/product-slug
//   #/about
//   #/services
//   #/contact
//
// The browser normally treats a hash as an anchor and can attempt
// to scroll before our SPA router renders the new page.
//
// We prevent that native behavior and let our router handle the
// navigation instead.
//
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#/"]');

  if (!link) return;

  // Do not interfere with another click handler that already
  // handled this event.
  if (event.defaultPrevented) return;

  // Only handle normal left-click navigation.
  if (event.button !== 0) return;

  // Preserve normal browser behavior for:
  // Ctrl + click
  // Cmd + click
  // Shift + click
  // Alt + click
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const href = link.getAttribute('href');

  if (!href || !href.startsWith('#/')) return;

  const currentHash = window.location.hash;

  // If the user clicks the exact route they are already on,
  // do not trigger a new navigation.
  if (href === currentHash) {
    event.preventDefault();
    return;
  }

  // MOST IMPORTANT:
  // Stop the browser's native hash-anchor scrolling.
  event.preventDefault();

  // Immediately move the old page to the top.
  resetScrollToTop();

  // Change the route.
  //
  // This triggers the hashchange listener above, which renders
  // the new page and performs another scroll reset.
  window.location.hash = href;
});

window.addEventListener('DOMContentLoaded', () => {
  render();
});

render();

// Kick off the product catalog load once, in the background, right away.
// Some routes (Home, header search) need real product data but don't
// block on it in render() so the page can paint instantly; this makes
// sure that data is on its way immediately instead of only starting once
// the customer happens to visit /shop or a product page. productService
// dedupes concurrent/duplicate loads itself, so this never causes an
// extra request beyond the one any page would have made anyway.
productService.load().then(() => {
  // If the customer is still on the Home page (or mid-search) once the
  // catalog arrives, refresh in place — no scroll jump — so Featured
  // Products/search aren't stuck empty on a first-visit Home landing.
  if (parseHash().path === '/') {
    render({ resetScroll: false });
  }
});

mountHelpWidget();
// Mounted once, independent of the router — persists across page navigations.