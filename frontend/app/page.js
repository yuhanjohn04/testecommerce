"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "./globals.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";
const CART_KEY = "cartId";
const CATALOG_PAGE_SIZE = 6;

const SORTS = [
  { id: "featured", label: "Featured / Default" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "name", label: "Name: A to Z" },
];

function sortProducts(products, sort) {
  const next = [...products];
  if (sort === "price-asc") next.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price-desc") next.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === "name") next.sort((a, b) => a.title.localeCompare(b.title));
  return next;
}

function apiHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (typeof window !== "undefined") {
    const cartId = localStorage.getItem(CART_KEY);
    if (cartId) headers["X-Cart-Id"] = cartId;
  }
  return headers;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) },
  });
  const cartId = res.headers.get("X-Cart-Id");
  if (cartId) localStorage.setItem(CART_KEY, cartId);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data.detail ||
      data.cart ||
      data.quantity ||
      Object.values(data)[0] ||
      "Request failed";
    throw new Error(Array.isArray(detail) ? detail[0] : detail);
  }
  return data;
}

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [sort, setSort] = useState("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState({ items: [], total: "0.00" });
  const [form, setForm] = useState({ customer_name: "", email: "", address: "" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    const data = await api("/cart/");
    setCart(data);
  }, []);

  const refreshProducts = useCallback(async () => {
    setProducts(await api("/products/"));
  }, []);

  useEffect(() => {
    refreshProducts().catch((err) => setStatus(err.message));
    refreshCart().catch((err) => setStatus(err.message));
  }, [refreshCart, refreshProducts]);

  useEffect(() => {
    if (!cartOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setCartOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cartOpen]);

  async function addToCart(productId) {
    setStatus("");
    try {
      await api("/cart/", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });
      await refreshCart();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function updateQty(item, quantity) {
    setStatus("");
    try {
      if (quantity < 1) {
        await api(`/cart/${item.id}/`, { method: "DELETE" });
      } else {
        await api(`/cart/${item.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        });
      }
      await refreshCart();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function checkout(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const order = await api("/orders/checkout/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ customer_name: "", email: "", address: "" });
      await Promise.all([refreshCart(), refreshProducts()]);
      setStatus(`Order #${order.id} placed. Total ₹${order.total}.`);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  const sortedProducts = sortProducts(products, sort);
  const catalogPageCount = Math.max(1, Math.ceil(sortedProducts.length / CATALOG_PAGE_SIZE));
  const currentCatalogPage = Math.min(catalogPage, catalogPageCount);
  const visibleProducts = sortedProducts.slice(
    (currentCatalogPage - 1) * CATALOG_PAGE_SIZE,
    currentCatalogPage * CATALOG_PAGE_SIZE
  );
  const cartCount = (cart.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return (
    <main>
      <header className="topbar">
        <h1>Store</h1>
        <div className="topbar-actions">
          <button type="button" onClick={() => setCartOpen(true)}>
            🛒 Cart ({cartCount})
          </button>
          <Link href="/admin">Admin</Link>
        </div>
      </header>
      {status && !cartOpen ? <p className="status">{status}</p> : null}
      <section>
        <div className="catalog-toolbar">
          <h2>Products</h2>
          <label className="sort-label">
            Sort by:
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setCatalogPage(1);
              }}
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="products">
            {visibleProducts.map((product) => (
              <article className="card" key={product.id}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.title} />
                ) : null}
                <h3>{product.title}</h3>
                <p className="price">
                  ₹{product.price} · {product.stock} in stock
                </p>
                <button
                  type="button"
                  disabled={product.stock < 1}
                  onClick={() => addToCart(product.id)}
                >
                  Add to Cart
                </button>
              </article>
            ))}
          </div>
          {products.length > 0 ? (
            <div className="pager catalog-pager">
              <button
                type="button"
                className="ghost"
                disabled={currentCatalogPage <= 1}
                onClick={() => setCatalogPage(currentCatalogPage - 1)}
              >
                Previous
              </button>
              <span className="muted">
                Page {currentCatalogPage} of {catalogPageCount}
              </span>
              <button
                type="button"
                className="ghost"
                disabled={currentCatalogPage >= catalogPageCount}
                onClick={() => setCatalogPage(currentCatalogPage + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
      </section>

      {cartOpen ? (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <h2 id="cart-title">Cart</h2>
              <button type="button" className="ghost" onClick={() => setCartOpen(false)}>
                Close
              </button>
            </div>
            {cart.items?.length ? (
              cart.items.map((item) => (
                <div className="cart-row" key={item.id}>
                  <div>
                    <strong>{item.product.title}</strong>
                    <div>₹{item.subtotal}</div>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => updateQty(item, item.quantity - 1)}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>Your cart is empty.</p>
            )}
            <p>
              <strong>Total: ₹{cart.total || "0.00"}</strong>
            </p>
            <form onSubmit={checkout}>
              <h2>Checkout</h2>
              <input
                required
                placeholder="Full name"
                value={form.customer_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customer_name: event.target.value }))
                }
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
              <textarea
                required
                rows={3}
                placeholder="Shipping address"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({ ...current, address: event.target.value }))
                }
              />
              <button type="submit" disabled={loading || !cart.items?.length}>
                {loading ? "Placing order…" : "Place order"}
              </button>
            </form>
            {status ? <p className="status">{status}</p> : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
