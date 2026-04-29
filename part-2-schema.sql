CREATE TABLE companies (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouses (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_warehouses_company ON warehouses(company_id);

CREATE TABLE suppliers (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  lead_time_days INT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_suppliers_company ON suppliers(company_id);

CREATE TABLE products (
  id                BIGSERIAL PRIMARY KEY,
  company_id        BIGINT         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku               VARCHAR(100)   NOT NULL,
  name              VARCHAR(255)   NOT NULL,
  description       TEXT,
  price             NUMERIC(12,2)  NOT NULL DEFAULT 0,
  product_type      VARCHAR(50)    NOT NULL DEFAULT 'standard',
  low_stock_threshold INT          NOT NULL DEFAULT 10,
  is_active         BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, sku)
);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_sku     ON products(company_id, sku);

CREATE TABLE product_suppliers (
  product_id    BIGINT  NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  supplier_id   BIGINT  NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_cost     NUMERIC(12,2),
  is_preferred  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (product_id, supplier_id)
);

CREATE TABLE inventory (
  id            BIGSERIAL PRIMARY KEY,
  product_id    BIGINT  NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  warehouse_id  BIGINT  NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity      INT     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, warehouse_id)
);
CREATE INDEX idx_inventory_product    ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);

CREATE TABLE inventory_logs (
  id            BIGSERIAL PRIMARY KEY,
  inventory_id  BIGINT   NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  product_id    BIGINT   NOT NULL,
  warehouse_id  BIGINT   NOT NULL,
  delta         INT      NOT NULL,
  reason        VARCHAR(100),
  reference_id  BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inv_logs_product   ON inventory_logs(product_id, created_at);
CREATE INDEX idx_inv_logs_warehouse ON inventory_logs(warehouse_id, created_at);

CREATE TABLE bundle_items (
  bundle_product_id     BIGINT  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id  BIGINT  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity              INT     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (bundle_product_id, component_product_id),
  CHECK (bundle_product_id != component_product_id)
);
