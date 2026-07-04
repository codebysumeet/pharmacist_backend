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

// Add a new inventory item
router.post('/', async (req, res) => {
  try {
    const { name, stock, threshold, price, aiDemand, aiRecommendation } = req.body;

    if (!name || stock === undefined || threshold === undefined || price === undefined || !aiDemand || !aiRecommendation) {
      return res.status(400).json({ message: 'All fields (name, stock, threshold, price, aiDemand, aiRecommendation) are required' });
    }

    const newItem = {
      name,
      stock: Number(stock),
      threshold: Number(threshold),
      price: Number(price),
      aiDemand,
      aiRecommendation
    };

    const savedItem = await db.addInventoryItem(newItem);

    // Broadcast inventory update to all connected clients
    if (req.io) {
      req.io.emit('inventory_updated', [savedItem]);
      console.log(`📡 Broadcasted new inventory item via inventory_updated for: ${name}`);
    }

    res.status(201).json(savedItem);
  } catch (error) {
    if (error.message.includes('already exists') || error.code === 11000) {
      return res.status(400).json({ message: 'Medicine already exists in inventory' });
    }
    res.status(500).json({ message: 'Error adding inventory item', error: error.message });
  }
});

// Generate AI insights for a medicine name
router.post('/ai-insights', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Medicine name is required' });
  }

  const nameLower = name.toLowerCase();
  let aiDemand = "Medium";
  let aiRecommendation = "Standard consumer demand. General stocking profile appropriate.";

  if (nameLower.includes('amoxic') || nameLower.includes('cillin') || nameLower.includes('mycin') || nameLower.includes('floxacin') || nameLower.includes('cef') || nameLower.includes('antibiotic')) {
    aiDemand = "High";
    aiRecommendation = "Seasonal bacterial infection surge predicted. Keep stock above 80 units for high turnover.";
  } else if (nameLower.includes('pril') || nameLower.includes('sartan') || nameLower.includes('olol') || nameLower.includes('pine') || nameLower.includes('cardio') || nameLower.includes('statin')) {
    aiDemand = "Medium";
    aiRecommendation = "Chronic cardiovascular maintenance drug. Stable patient consumption. Monthly cycle reordering recommended.";
  } else if (nameLower.includes('formin') || nameLower.includes('insulin') || nameLower.includes('glip') || nameLower.includes('sugar') || nameLower.includes('diabet')) {
    aiDemand = "High";
    aiRecommendation = "Critical insulin/glucose regulator. High stock priority. Maintain stock levels at 2x threshold.";
  } else if (nameLower.includes('profen') || nameLower.includes('cetamol') || nameLower.includes('aspirin') || nameLower.includes('naproxen') || nameLower.includes('pain')) {
    aiDemand = "High";
    aiRecommendation = "General analgesic with high consumer traffic. Predictable weekly volumes. Reorder when stock drops below threshold.";
  } else if (nameLower.includes('allergy') || nameLower.includes('histamine') || nameLower.includes('cetirizine') || nameLower.includes('dine') || nameLower.includes('asthma') || nameLower.includes('inhaler') || nameLower.includes('albuterol')) {
    aiDemand = "High";
    aiRecommendation = "Seasonal respiratory/allergy alert. High demand pattern detected. Restock to 150% threshold.";
  } else if (nameLower.includes('vit') || nameLower.includes('multiv') || nameLower.includes('supplement') || nameLower.includes('zinc')) {
    aiDemand = "Low";
    aiRecommendation = "Over-the-counter dietary supplement. Low clinical urgency. Reorder on demand.";
  }

  res.json({ aiDemand, aiRecommendation });
});

export default router;
