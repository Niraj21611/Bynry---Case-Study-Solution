# StockFlow – Backend Engineering Intern Case Study

This repository contains my solution to the **StockFlow B2B Inventory Management System** backend engineering intern case study. The case study covers three areas: code review & debugging, database design, and API implementation.

All API code is written in **Node.js with Express.js**.

---

## Table of Contents

- [Overview](#overview)
- [Part 1 – Code Review & Debugging](#part-1--code-review--debugging)
- [Part 2 – Database Design](#part-2--database-design)
- [Part 3 – API Implementation](#part-3--api-implementation)
- [Assumptions](#assumptions)
- [Tech Stack](#tech-stack)
- [Solution Document](#solution-document)

---

## Overview

StockFlow is a B2B inventory management platform that allows small businesses to track products across multiple warehouses and manage supplier relationships. This case study solution addresses:

1. Identifying and fixing bugs in an existing product creation endpoint
2. Designing a normalized relational database schema from incomplete requirements
3. Implementing a low-stock alert API endpoint with business logic

---

## Part 1 – Code Review & Debugging

The original Python/Flask endpoint for creating a product had **7 issues** identified:

| # | Issue | Impact |
|---|-------|--------|
| 1 | No input validation | Missing fields crash the endpoint with unhandled errors |
| 2 | No SKU uniqueness check | Duplicate SKUs silently created or opaque DB error thrown |
| 3 | Two separate `commit()` calls | Non-atomic – product can be saved without inventory record |
| 4 | `warehouse_id` stored on Product model | Breaks multi-warehouse support per requirements |
| 5 | No HTTP status codes | All responses return 200, clients can't detect failure |
| 6 | `initial_quantity` not defaulted | KeyError if field omitted by client |
| 7 | Float used for price | Floating-point rounding errors in financial calculations |

The corrected implementation uses a **single atomic transaction**, full input validation, explicit status codes (201 / 400 / 404 / 409 / 500), and stores price as `DECIMAL`.

---

## Part 2 – Database Design

A normalized SQL schema with 7 tables:

```
companies
warehouses         → belongs to company
suppliers          → belongs to company
products           → belongs to company; has SKU unique per company
product_suppliers  → M2M join: products ↔ suppliers (with is_preferred flag)
inventory          → M2M join: products ↔ warehouses (with quantity)
inventory_logs     → audit trail for every quantity change (delta-based)
bundle_items       → self-referential: products that contain other products
```

### Key Design Decisions

- `UNIQUE (company_id, sku)` – SKU uniqueness scoped per company
- `NUMERIC(12,2)` for price – avoids IEEE 754 floating-point errors
- `low_stock_threshold` stored per product – supports per-product-type thresholds
- `is_active` boolean – soft deletes to preserve historical data
- `delta` column in `inventory_logs` – enables sales velocity calculation
- `CHECK (quantity >= 0)` – DB-level guard against negative stock

### Gaps Identified (Questions for Product Team)

- Is SKU uniqueness global across all companies or per-company?
- How is "recent sales activity" defined? (Last 7 / 14 / 30 days?)
- Can bundles contain other bundles (nested bundles)?
- Is there a concept of purchase orders / restocking orders?
- Do companies need multi-currency support?
- Are there product variants (e.g. size S/M/L)?

---

## Part 3 – API Implementation

### Endpoint

```
GET /api/companies/:company_id/alerts/low-stock
```

### Business Logic Implemented

- A product is **low-stock** when its quantity in a warehouse falls below `low_stock_threshold`
- Only products with **at least one sale in the last 30 days** are included (configurable via `RECENT_SALES_DAYS` constant)
- **Days until stockout** = `current_quantity / avg_daily_sales` over the last 30 days; returns `null` if no sales rate exists
- If a product has multiple suppliers, the **preferred supplier** (`is_preferred = true`) is returned; falls back to first by order
- Results sorted by urgency (lowest `days_until_stockout` first)

### Sample Response

```json
{
  "alerts": [
    {
      "product_id": 123,
      "product_name": "Widget A",
      "sku": "WID-001",
      "warehouse_id": 456,
      "warehouse_name": "Main Warehouse",
      "current_stock": 5,
      "threshold": 20,
      "days_until_stockout": 12,
      "supplier": {
        "id": 789,
        "name": "Supplier Corp",
        "contact_email": "orders@supplier.com"
      }
    }
  ],
  "total_alerts": 1
}
```

### Edge Cases Handled

- Company not found → `404`
- Product above threshold → excluded from results
- No recent sales → product excluded entirely
- Zero sales rate → `days_until_stockout` returns `null` (no divide-by-zero)
- No supplier linked → `supplier` field returns `null`
- Multiple warehouses → each (product, warehouse) pair evaluated independently
- Unexpected DB error → `500` with server-side logging

---

## Assumptions

A full assumptions table is documented in the solution document. Key ones:

1. "Recent sales activity" = at least one sale in the last **30 days**
2. `initial_quantity` defaults to `0` if not provided
3. SKU uniqueness is **per-company** (not globally across all companies)
4. `low_stock_threshold` is stored and customisable per product
5. Bundles cannot be nested (no recursive bundles)
6. Authentication is handled by middleware (not shown in endpoint code)
7. Price is in a single currency; no multi-currency support assumed

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: PostgreSQL
- **Schema notation**: SQL DDL

---

## Solution Document

A fully formatted solution document (Word format) with all three parts, code, schema DDL, design decisions, and the assumptions table is available here:

[View Solution as Google Doc](https://docs.google.com/document/d/1sYIQMSMfHTPqHjMH88MZD22Yf1caOrU2nqgInM7fXWY/edit?usp=sharing)
