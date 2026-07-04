import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// Get all inventory items with alerts
router.get('/', async (req, res) => {
  try {
    const inventory = await db.getInventory();
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
});

// Update stock manually (Restock)
router.put('/stock', async (req, res) => {
  try {
    const { name, qtyChange } = req.body;

    if (!name || qtyChange === undefined) {
      return res.status(400).json({ message: 'Medicine name and qtyChange are required' });
    }

    const updatedItem = await db.updateInventoryStock(name, Number(qtyChange));
    
    if (!updatedItem) {
      return res.status(404).json({ message: 'Medicine not found in inventory' });
    }

    // Broadcast inventory update to all connected clients
    if (req.io) {
      req.io.emit('inventory_updated', [updatedItem]);
      console.log(`📡 Broadcasted manual inventory_updated for: ${name}`);
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating inventory', error: error.message });
  }
});

export default router;
