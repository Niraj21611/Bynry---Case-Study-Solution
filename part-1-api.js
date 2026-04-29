const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/products
// Creates a product and its initial inventory record atomically.
router.post('/api/products', async (req, res) => {
  const { name, sku, price, warehouse_id, initial_quantity = 0 } = req.body;

  // Input validation
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('name is required and must be a non-empty string.');
  }

  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    errors.push('sku is required and must be a non-empty string.');
  }

  if (
    price === undefined ||
    price === null ||
    isNaN(Number(price)) ||
    Number(price) < 0
  ) {
    errors.push('price is required and must be a non-negative number.');
  }

  if (!warehouse_id) {
    errors.push('warehouse_id is required.');
  }

  if (typeof initial_quantity !== 'number' || initial_quantity < 0) {
    errors.push('initial_quantity must be a non-negative number.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Validate warehouse exists
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouse_id },
      });

      if (!warehouse) {
        throw { status: 404, message: `Warehouse ${warehouse_id} not found.` };
      }

      // SKU uniqueness check
      const existing = await tx.product.findUnique({
        where: { sku: sku.trim().toUpperCase() },
      });

      if (existing) {
        throw {
          status: 409,
          message: `A product with SKU '${sku}' already exists.`,
        };
      }

      // Create product
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          price: parseFloat(Number(price).toFixed(2)),
        },
      });

      // Create inventory record
      await tx.inventory.create({
        data: {
          productId: product.id,
          warehouseId: warehouse_id,
          quantity: initial_quantity,
        },
      });

      return product;
    });

    return res.status(201).json({
      message: 'Product created successfully.',
      product_id: result.id,
    });
  } catch (err) {
    console.error('create_product error:', err);

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }

    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

module.exports = router;
