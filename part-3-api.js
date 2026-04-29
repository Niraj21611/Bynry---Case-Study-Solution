const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const RECENT_SALES_DAYS = 30;

// GET /api/companies/:company_id/alerts/low-stock
// Returns all low-stock alerts for warehouses belonging to the given company.
// A product is 'low-stock' if its current inventory in any warehouse
// is below the product's low_stock_threshold.
// Only products with at least one sale in the last RECENT_SALES_DAYS days are included.
router.get('/api/companies/:company_id/alerts/low-stock', async (req, res) => {
  const { company_id } = req.params;

  try {
    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: Number(company_id) }
    });

    if (!company) {
      return res.status(404).json({
        error: `Company ${company_id} not found.`
      });
    }

    // Determine cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RECENT_SALES_DAYS);

    // Fetch inventory with related product + warehouse + suppliers
    const inventoryRows = await prisma.inventory.findMany({
      include: {
        product: {
          include: {
            suppliers: {
              include: {
                supplier: true
              }
            }
          }
        },
        warehouse: true
      }
    });

    // Filter only relevant company products
    const filteredRows = inventoryRows.filter(
      row =>
        row.product &&
        row.product.company_id === Number(company_id) &&
        row.product.is_active === true &&
        row.warehouse.company_id === Number(company_id)
    );

    // Get products with recent sales
    const recentSales = await prisma.inventoryLog.findMany({
      where: {
        reason: 'sale',
        delta: { lt: 0 },
        created_at: { gte: cutoffDate }
      },
      select: { product_id: true },
      distinct: ['product_id']
    });

    const productIdsWithRecentSales = new Set(
      recentSales.map(r => r.product_id)
    );

    const alerts = [];

    for (const row of filteredRows) {
      const product = row.product;
      const warehouse = row.warehouse;

      // Below threshold check
      if (row.quantity >= product.low_stock_threshold) continue;

      // Must have recent sales
      if (!productIdsWithRecentSales.has(product.id)) continue;

      // Calculate sales velocity
      const salesLogs = await prisma.inventoryLog.findMany({
        where: {
          product_id: product.id,
          warehouse_id: warehouse.id,
          reason: 'sale',
          delta: { lt: 0 },
          created_at: { gte: cutoffDate }
        }
      });

      const totalSold = salesLogs.reduce(
        (sum, log) => sum + Math.abs(log.delta),
        0
      );

      const avgDailySales = totalSold / RECENT_SALES_DAYS;

      const daysUntilStockout =
        avgDailySales > 0
          ? Math.round(row.quantity / avgDailySales)
          : null;

      // Resolve preferred supplier
      let supplier = null;

      if (product.suppliers?.length > 0) {
        const preferred = product.suppliers.find(ps => ps.is_preferred);
        const chosen = preferred || product.suppliers[0];

        supplier = {
          id: chosen.supplier.id,
          name: chosen.supplier.name,
          contact_email: chosen.supplier.contact_email
        };
      }

      alerts.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        current_stock: row.quantity,
        threshold: product.low_stock_threshold,
        days_until_stockout: daysUntilStockout,
        supplier
      });
    }

    // Sort alerts by urgency
    alerts.sort((a, b) => {
      if (a.days_until_stockout === null) return 1;
      if (b.days_until_stockout === null) return -1;
      return a.days_until_stockout - b.days_until_stockout;
    });

    return res.status(200).json({
      alerts,
      total_alerts: alerts.length
    });

  } catch (err) {
    console.error('low-stock-alerts error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred.'
    });
  }
});

module.exports = router;
