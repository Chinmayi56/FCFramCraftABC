// Farm Craft service layer — business data is provided by the FastAPI backend.

import { COMPANY } from './data.js';

/* ---------------- API configuration ---------------- */

// Production:
// VITE_API_BASE_URL=https://fcframcraft.onrender.com
//
// Local development:
// VITE_API_BASE_URL=http://127.0.0.1:8000
//
// If VITE_API_BASE_URL is not set, use /api so Vite can proxy requests locally.
//
// Every request built below already goes through buildApiPath(), which adds
// the backend's /api prefix itself. Some deployments (see .env, which sets
// VITE_API_BASE_URL=/api) set VITE_API_BASE_URL to a value that *already*
// ends in /api, which used to produce double-prefixed requests like
// /api/api/products — those 404'd, which is why the Customer Site appeared
// to have no products even though Admin had created them. Stripping a
// trailing /api from the configured base (mirroring the Admin site's
// lib/apiClient.ts) keeps both `/api` and a full backend URL ending in
// `/api` safe to use here, regardless of trailing slashes.

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Remove trailing slashes, then strip a trailing /api if present so the
// single /api prefix added by buildApiPath() below is never duplicated.
const TRIMMED_API_BASE = RAW_API_BASE.replace(/\/+$/, '');
const API_BASE = TRIMMED_API_BASE.replace(/\/api$/, '');

// Backend API prefix.
const API_PREFIX = '/api';

const KEYS = {
  auth: 'fc_auth_session',
  token: 'fc_auth_token',
  // Wishlist and saved-addresses live only in the browser (the backend has
  // no endpoints for them), so they must be namespaced per signed-in
  // customer. Using a single shared key here used to leak Customer A's
  // wishlist/address to Customer B on the same device/browser after
  // Customer B logged in — see customerStorageKey() below.
  wishlist: 'fc_wishlist',
  addresses: 'fc_addresses',
};

// Returns a per-customer localStorage key so wishlist/address data never
// crosses between customers who share a browser. Falls back to a distinct
// "guest" bucket when nobody is logged in, so a logged-out browsing session
// doesn't accidentally read/write a previous customer's saved data either.
function customerStorageKey(base) {
  const session = read(KEYS.auth, null);
  const id = session?.id || session?.mobile || 'guest';
  return `${base}::${id}`;
}

/* ---------------- Local storage helpers ---------------- */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------------- API helper ---------------- */

function buildApiPath(path = '') {
  const cleanPath = String(path || '').trim();

  // Already contains /api.
  if (cleanPath === '/api') {
    return '/api';
  }

  if (cleanPath.startsWith('/api/')) {
    return cleanPath;
  }

  // Root path.
  if (!cleanPath || cleanPath === '/') {
    return API_PREFIX;
  }

  return `${API_PREFIX}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
}

async function api(path, options = {}) {
  const token = localStorage.getItem(KEYS.token);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const apiPath = buildApiPath(path);
  const url = `${API_BASE}${apiPath}`;

  let res;

  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      'Could not reach the Farm Craft server. Please check the backend connection and try again.'
    );
  }

  if (res.status === 204) {
    return null;
  }

  let body = null;

  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Clear stale authentication.
    if (res.status === 401) {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.auth);
    }

    const FALLBACK_BY_STATUS = {
      400: 'That request was not valid. Please check the details and try again.',
      401: 'Please log in to continue.',
      403: 'You do not have permission to do that.',
      404: 'We could not find what you were looking for.',
      409: 'That could not be completed due to a conflict with existing data.',
      422: 'Please check the details you entered and try again.',
    };

    const message =
      typeof body?.detail === 'string' && body.detail
        ? body.detail
        : FALLBACK_BY_STATUS[res.status] ||
          'Something went wrong on the Farm Craft server. Please try again.';

    const err = new Error(message);
    err.status = res.status;

    throw err;
  }

  return body;
}

/* ---------------- Authentication ---------------- */

function saveAuth(data) {
  if (!data) {
    throw new Error('Invalid authentication response from the server.');
  }

  if (!data.access_token) {
    throw new Error('Login succeeded but no access token was returned.');
  }

  if (!data.user) {
    throw new Error('Login succeeded but no customer details were returned.');
  }

  write(KEYS.auth, data.user);
  localStorage.setItem(KEYS.token, data.access_token);
}

export const authService = {
  /*
   * Customer login
   *
   * Backend:
   * POST /api/auth/customer/login
   *
   * Required:
   * {
   *   name: string,
   *   mobile: string
   * }
   */
  async loginCustomer(name, mobile) {
    try {
      const cleanName = String(name || '').trim();
      const cleanMobile = String(mobile || '').trim();

      if (!cleanName) {
        return {
          ok: false,
          error: 'Please enter your full name.',
        };
      }

      if (!cleanMobile) {
        return {
          ok: false,
          error: 'Please enter your mobile number.',
        };
      }

      const data = await api('/auth/customer/login', {
        method: 'POST',
        body: JSON.stringify({
          name: cleanName,
          mobile: cleanMobile,
        }),
      });

      saveAuth(data);

      return {
        ok: true,
        session: data.user,
      };
    } catch (e) {
      return {
        ok: false,
        error: e?.message || 'Customer login failed. Please try again.',
      };
    }
  },

  /*
   * Send OTP
   *
   * Backend:
   * POST /api/auth/customer/send-otp
   */
  async sendOtp(mobile) {
    try {
      const cleanMobile = String(mobile || '').trim();

      if (!cleanMobile) {
        return {
          ok: false,
          error: 'Please enter your mobile number.',
        };
      }

      await api('/auth/customer/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          mobile: cleanMobile,
        }),
      });

      return {
        ok: true,
      };
    } catch (e) {
      return {
        ok: false,
        error: e?.message || 'Could not send OTP. Please try again.',
      };
    }
  },

  /*
   * Verify OTP
   *
   * Backend:
   * POST /api/auth/customer/verify-otp
   */
  async verifyOtp(name, mobile, otp) {
    try {
      const cleanName = String(name || '').trim();
      const cleanMobile = String(mobile || '').trim();
      const cleanOtp = String(otp || '').trim();

      if (!cleanName) {
        return {
          ok: false,
          error: 'Please enter your full name.',
        };
      }

      if (!cleanMobile) {
        return {
          ok: false,
          error: 'Please enter your mobile number.',
        };
      }

      if (!cleanOtp) {
        return {
          ok: false,
          error: 'Please enter the OTP.',
        };
      }

      const data = await api('/auth/customer/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          name: cleanName,
          mobile: cleanMobile,
          otp: cleanOtp,
        }),
      });

      saveAuth(data);

      return {
        ok: true,
        session: data.user,
      };
    } catch (e) {
      return {
        ok: false,
        error: e?.message || 'OTP verification failed. Please try again.',
      };
    }
  },

  logout() {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.auth);
  },

  getSession() {
    return read(KEYS.auth, null);
  },

  isLoggedIn() {
    return (
      !!localStorage.getItem(KEYS.token) &&
      !!read(KEYS.auth, null)
    );
  },
};

/* ---------------- Product helpers ---------------- */

function normalizeProduct(p) {
  const imgs = (
    p.images && p.images.length
      ? p.images
      : [p.image]
  ).filter(Boolean);

  const specs = [];

  for (
    const [label, key] of [
      ['Motor', 'motor'],
      ['Capacity', 'capacity'],
      ['Length', 'length'],
      ['Height', 'height'],
      ['Pipe Material', 'pipe_material'],
      ['Screw Material', 'screw_material'],
      ['Usage', 'usage'],
    ]
  ) {
    if (p[key]) {
      specs.push({
        label,
        value: p[key],
      });
    }
  }

  if (!specs.length && p.sku) {
    specs.push({
      label: 'SKU',
      value: p.sku,
    });
  }

  const slug =
    p.slug ||
    String(p.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  // Preserve original list price.
  const listPrice =
    p.price == null ? null : Number(p.price);

  const discountPrice =
    p.discount_price == null
      ? undefined
      : Number(p.discount_price);

  const price =
    discountPrice != null
      ? discountPrice
      : listPrice;

  const hasDiscount =
    listPrice != null &&
    discountPrice != null &&
    discountPrice < listPrice;

  const stock = Number(p.stock ?? 0);

  const stockStatus =
    stock <= 0
      ? 'Out of Stock'
      : stock <= 5
        ? 'Low Stock'
        : 'In Stock';

  return {
    ...p,
    slug,
    price,
    listPrice,
    discountPrice,
    hasDiscount,
    images:
      imgs.length
        ? imgs
        : ['assets/products/collector-diagram.jpeg'],
    specifications: specs,
    features: p.features || [],
    applications: p.applications || [],
    stockStatus,
    rating: null,
    reviews: 0,
  };
}

/* ---------------- Product service ---------------- */

export const productService = {
  cache: [],
  loading: false,
  loaded: false,
  loadingPromise: null,
  error: null,

  async load({ force = false } = {}) {
    if (this.loaded && !force) {
      return this.cache;
    }

    if (this.loadingPromise && !force) {
      return this.loadingPromise;
    }

    this.loading = true;

    this.loadingPromise = (async () => {
      try {
        const first = await api(
          '/products?status=active&skip=0&limit=200'
        );

        let items = first?.items || [];
        const total = first?.total ?? items.length;

        while (items.length < total) {
          const page = await api(
            `/products?status=active&skip=${items.length}&limit=200`
          );

          if (!page?.items || !page.items.length) {
            break;
          }

          items = items.concat(page.items);
        }

        this.cache = items.map(normalizeProduct);
        this.error = null;
        this.loaded = true;
      } catch (e) {
        this.error =
          e?.message || 'Could not load products.';
      } finally {
        this.loading = false;
        this.loadingPromise = null;
      }

      return this.cache;
    })();

    return this.loadingPromise;
  },

  list() {
    return this.cache;
  },

  search(query, { category, availability } = {}) {
    const q = String(query || '')
      .trim()
      .toLowerCase();

    const categorySlug = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return this.cache.filter((p) => {
      if (category) {
        const requested = categorySlug(category);
        const actual = categorySlug(p.category);

        const aliases = {
          transferring: [
            'transferring',
            'grain-transferring',
            'grain-transfer',
            'grain-transferring-equipment',
          ],
          collecting: [
            'collecting',
            'grain-collecting',
            'grain-collection',
          ],
          bagging: [
            'bagging',
            'grain-bagging',
            'grain-bagging-packaging',
          ],
          handling: [
            'handling',
            'grain-handling',
            'grain-handling-equipment',
          ],
          machinery: [
            'machinery',
            'agricultural-machinery',
          ],
          accessories: [
            'accessories',
            'pipes-accessories',
            'pipes-and-accessories',
          ],
        };

        const allowed =
          aliases[requested] || [requested];

        if (
          !allowed.includes(actual) &&
          !allowed.some(
            (a) =>
              actual.includes(a) ||
              a.includes(actual)
          )
        ) {
          return false;
        }
      }

      if (
        availability === 'in-stock' &&
        p.stockStatus !== 'In Stock'
      ) {
        return false;
      }

      if (
        availability === 'low-stock' &&
        p.stockStatus !== 'Low Stock'
      ) {
        return false;
      }

      if (!q) {
        return true;
      }

      return [
        p.name,
        p.description,
        p.category,
        p.sku,
        ...(p.applications || []),
        ...(p.features || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  },

  bySlug(slug) {
    return (
      this.cache.find(
        (p) => p.slug === slug
      ) || null
    );
  },
};

/* ---------------- Customer service ---------------- */

export const customerService = {
  getProfile() {
    const session = authService.getSession();

    return session
      ? {
          ...session,
          addresses: read(
            customerStorageKey(KEYS.addresses),
            []
          ),
        }
      : null;
  },

  saveAddress(address) {
    const key = customerStorageKey(KEYS.addresses);
    const list = read(key, []);

    list.unshift({
      id: `addr_${Date.now()}`,
      ...address,
    });

    write(key, list);

    return list;
  },

  getAddresses() {
    return read(customerStorageKey(KEYS.addresses), []);
  },

  toggleWishlist(id) {
    const key = customerStorageKey(KEYS.wishlist);
    const list = read(key, []);

    const index = list.indexOf(id);

    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.unshift(id);
    }

    write(key, list);

    return list;
  },

  getWishlist() {
    return read(customerStorageKey(KEYS.wishlist), []);
  },
};

/* ---------------- Cart service ---------------- */

export const cartService = {
  async get() {
    return api('/cart');
  },

  async add(productId, quantity = 1) {
    return api('/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        quantity,
      }),
    });
  },

  async update(itemId, quantity) {
    return api(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        quantity,
      }),
    });
  },

  async remove(itemId) {
    return api(`/cart/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  async clear() {
    return api('/cart', {
      method: 'DELETE',
    });
  },
};

/* ---------------- Order service ---------------- */

export const orderService = {
  cache: [],

  async create(payload) {
    const order = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        address: payload?.address || null,
        mobile:
          payload?.customer?.mobile || null,
        configuration:
          payload?.configuration || null,
        order_method:
          payload?.orderMethod || 'delivery',
      }),
    });

    this.cache.unshift(order);

    return order;
  },

  async load() {
    this.cache = await api('/orders');
    return this.cache;
  },

  list() {
    return this.cache;
  },

  byId(id) {
    return (
      this.cache.find(
        (order) =>
          order.id === id ||
          order.order_number === id ||
          order.orderId === id
      ) || null
    );
  },
};

/* ---------------- Invoice service ---------------- */

// Fallback green-leaf SVG if the real logo cannot be fetched.
const LOGO_FALLBACK_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="64"
         height="64"
         viewBox="0 0 64 64">
      <rect
        width="64"
        height="64"
        rx="12"
        fill="#1E7A3D"
      />
      <path
        d="M32 14 C20 14 14 24 14 34 C14 44 22 50 32 50 C42 50 50 44 50 34 C50 24 44 14 32 14 Z"
        fill="none"
        stroke="#ffffff"
        stroke-width="2.4"
      />
      <path
        d="M32 20 V44 M32 44 L24 36 M32 38 L40 30"
        fill="none"
        stroke="#ffffff"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </svg>
  `);

let logoDataUrlPromise = null;

function getLogoDataUrl() {
  if (logoDataUrlPromise) {
    return logoDataUrlPromise;
  }

  logoDataUrlPromise = fetch(COMPANY.logoMark)
    .then((res) => {
      if (!res.ok) {
        throw new Error('logo fetch failed');
      }

      return res.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () =>
            resolve(reader.result);

          reader.onerror = reject;

          reader.readAsDataURL(blob);
        })
    )
    .catch(() => LOGO_FALLBACK_SVG);

  return logoDataUrlPromise;
}

function invoiceNumber(order) {
  return `INV-${order.order_number || order.id}`;
}

/* ---------------- Invoice service ---------------- */

export const invoiceService = {
  async buildInvoiceHtml(order) {
    const logoSrc = await getLogoDataUrl();

    const issueDate = new Date(
      order.created_at
    );

    return `
      <div
        style="
          font-family: 'Inter', Arial, sans-serif;
          color:#2A2E29;
          max-width:720px;
          margin:0 auto;
          background:#FCFBF8;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:24px;
            padding:36px 40px 24px;
            border-bottom:4px solid #1E7A3D;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:14px;
            "
          >

            <img
              src="${logoSrc}"
              alt="Farm Craft logo"
              width="56"
              height="56"
              style="
                width:56px;
                height:56px;
                border-radius:12px;
                object-fit:contain;
                display:block;
              "
            />

            <div>
              <div
                style="
                  font-size:22px;
                  font-weight:700;
                  letter-spacing:0.5px;
                  color:#134A26;
                "
              >
                FARM CRAFT
              </div>

              <div
                style="
                  font-size:11px;
                  color:#666;
                  margin-top:2px;
                "
              >
                Agricultural Machinery &amp; Grain Handling Equipment
              </div>

              <div
                style="
                  font-size:11px;
                  color:#666;
                  margin-top:2px;
                "
              >
                GSTIN: ${COMPANY.gstin}
              </div>
            </div>
          </div>

          <div style="text-align:right;">

            <div
              style="
                font-size:20px;
                font-weight:700;
                color:#1E7A3D;
                letter-spacing:1px;
              "
            >
              INVOICE
            </div>

            <div
              style="
                font-size:12px;
                color:#666;
                margin-top:6px;
              "
            >
              Invoice No:
              <strong style="color:#2A2E29;">
                ${invoiceNumber(order)}
              </strong>
            </div>

            <div
              style="
                font-size:12px;
                color:#666;
              "
            >
              Order ID:
              <strong style="color:#2A2E29;">
                ${order.order_number || order.id}
              </strong>
            </div>

            <div
              style="
                font-size:12px;
                color:#666;
              "
            >
              Date:
              <strong style="color:#2A2E29;">
                ${issueDate.toLocaleDateString(
                  'en-IN',
                  {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }
                )}
              </strong>
            </div>

          </div>
        </div>

        <div style="padding:24px 40px 0;">

          <div
            style="
              background:#134A26;
              color:#fff;
              border-radius:14px;
              padding:16px 20px;
              display:flex;
              justify-content:space-between;
              align-items:center;
              margin-bottom:24px;
            "
          >

            <div>
              <div
                style="
                  font-size:10px;
                  text-transform:uppercase;
                  letter-spacing:1px;
                  color:rgba(255,255,255,0.6);
                "
              >
                Purchase Code
              </div>

              <div
                style="
                  font-size:20px;
                  font-weight:700;
                  letter-spacing:2px;
                  margin-top:2px;
                "
              >
                ${order.purchase_code || '—'}
              </div>
            </div>

            <div style="text-align:right;">

              <div
                style="
                  font-size:10px;
                  text-transform:uppercase;
                  letter-spacing:1px;
                  color:rgba(255,255,255,0.6);
                "
              >
                Status
              </div>

              <div
                style="
                  font-size:13px;
                  font-weight:600;
                  margin-top:2px;
                "
              >
                ${order.status || '—'}
              </div>

            </div>
          </div>

          <div
            style="
              display:flex;
              gap:32px;
              margin-bottom:24px;
            "
          >

            <div style="flex:1;">

              <div
                style="
                  font-size:11px;
                  text-transform:uppercase;
                  letter-spacing:0.5px;
                  color:#888;
                  margin-bottom:6px;
                  font-weight:600;
                "
              >
                Billed To
              </div>

              <div
                style="
                  font-size:13px;
                  line-height:1.6;
                "
              >

                <div style="font-weight:600;">
                  ${order.customer_snapshot?.name || ''}
                </div>

                <div>
                  ${order.customer_snapshot?.email || ''}
                </div>

                <div>
                  ${order.customer_snapshot?.mobile || ''}
                </div>

              </div>
            </div>

            <div style="flex:1;">

              <div
                style="
                  font-size:11px;
                  text-transform:uppercase;
                  letter-spacing:0.5px;
                  color:#888;
                  margin-bottom:6px;
                  font-weight:600;
                "
              >
                Delivery Address
              </div>

              <div
                style="
                  font-size:13px;
                  line-height:1.6;
                "
              >

                <div>
                  ${
                    order.shipping_address?.line1 ||
                    order.shipping_address?.address ||
                    '—'
                  }
                </div>

                <div>
                  ${
                    [
                      order.shipping_address?.city,
                      order.shipping_address?.state,
                      order.shipping_address?.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ') || ''
                  }
                </div>

              </div>
            </div>

            <div style="flex:1;">

              <div
                style="
                  font-size:11px;
                  text-transform:uppercase;
                  letter-spacing:0.5px;
                  color:#888;
                  margin-bottom:6px;
                  font-weight:600;
                "
              >
                From
              </div>

              <div
                style="
                  font-size:13px;
                  line-height:1.6;
                "
              >

                <div style="font-weight:600;">
                  ${COMPANY.name}
                </div>

                <div>
                  ${COMPANY.email}
                </div>

                <div>
                  ${COMPANY.phone}
                </div>

              </div>
            </div>

          </div>

          <table
            style="
              width:100%;
              border-collapse:collapse;
              margin-bottom:28px;
            "
          >

            <thead>

              <tr
                style="
                  background:#E8F3EC;
                  text-align:left;
                "
              >

                <th
                  style="
                    padding:10px 12px;
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:0.5px;
                    color:#134A26;
                    border-radius:8px 0 0 8px;
                  "
                >
                  Product
                </th>

                <th
                  style="
                    padding:10px 12px;
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:0.5px;
                    color:#134A26;
                  "
                >
                  Configuration
                </th>

                <th
                  style="
                    padding:10px 12px;
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:0.5px;
                    color:#134A26;
                    text-align:center;
                    border-radius:0 8px 8px 0;
                  "
                >
                  Qty
                </th>

              </tr>

            </thead>

            <tbody>

              ${
                order.items
                  ?.map(
                    (item) => `
                      <tr>

                        <td
                          style="
                            padding:12px;
                            border-bottom:1px solid #E4E2D9;
                            font-size:13px;
                            font-weight:600;
                          "
                        >
                          ${item.product_name || ''}
                        </td>

                        <td
                          style="
                            padding:12px;
                            border-bottom:1px solid #E4E2D9;
                            font-size:12px;
                            color:#666;
                          "
                        >
                          ${item.configuration || '—'}
                        </td>

                        <td
                          style="
                            padding:12px;
                            border-bottom:1px solid #E4E2D9;
                            font-size:13px;
                            text-align:center;
                          "
                        >
                          ${item.quantity || 0}
                        </td>

                      </tr>
                    `
                  )
                  .join('') || ''
              }

            </tbody>
          </table>

          <div
            style="
              display:flex;
              gap:32px;
              margin-bottom:28px;
              font-size:12px;
              color:#666;
            "
          >

            <div>
              <span style="color:#888;">
                Payment Method:
              </span>

              <strong style="color:#2A2E29;">
                ${order.payment_method || '—'}
              </strong>
            </div>

            <div>
              <span style="color:#888;">
                Order Date:
              </span>

              <strong style="color:#2A2E29;">
                ${issueDate.toLocaleDateString('en-IN')}
              </strong>
            </div>

          </div>

        </div>

        <div
          style="
            border-top:1px solid #E4E2D9;
            padding:20px 40px 32px;
            font-size:11px;
            color:#999;
            text-align:center;
            line-height:1.7;
          "
        >
          Thank you for choosing Farm Craft.
          Our team will contact you regarding order confirmation and delivery.
          <br />

          This is a demo invoice generated for preview purposes —
          no real payment has been processed.

          <br />

          Farm Craft &middot;
          ${COMPANY.address} &middot;
          ${COMPANY.email} &middot;
          ${COMPANY.phone}
        </div>

      </div>
    `;
  },

  async downloadInvoice(order) {
    const body = await this.buildInvoiceHtml(order);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />

          <title>
            Invoice ${invoiceNumber(order)} — Farm Craft
          </title>

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <style>
            body {
              margin: 0;
              padding: 32px 16px;
              background: #F1EFE7;
              font-family: Inter, Arial, sans-serif;
            }

            @media print {
              body {
                background: #fff;
                padding: 0;
              }
            }

            table {
              width: 100%;
            }
          </style>
        </head>

        <body>
          ${body}
        </body>
      </html>
    `;

    const blob = new Blob(
      [html],
      {
        type: 'text/html',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      `FarmCraft-Invoice-${
        order.order_number || order.id
      }.html`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  },
};