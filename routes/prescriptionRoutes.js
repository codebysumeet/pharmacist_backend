import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// Get all prescriptions
router.get('/', async (req, res) => {
  try {
    const prescriptions = await db.getPrescriptions();
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching prescriptions', error: error.message });
  }
});

// Create new prescription (Simulated doctor prescription)
router.post('/', async (req, res) => {
  try {
    const { patientName, doctorName, medicines, patientId, doctorId, prescriptionId, patientAge } = req.body;

    if (!patientName || !doctorName || !medicines || !Array.isArray(medicines)) {
      return res.status(400).json({ message: 'Missing required prescription fields' });
    }

    const newRx = {
      patientId: patientId || `P-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName,
      doctorId: doctorId || `D-${Math.floor(1000 + Math.random() * 9000)}`,
      doctorName,
      prescriptionId: prescriptionId || `RX-${Math.floor(10000 + Math.random() * 90000)}`,
      medicines: medicines.map(m => ({
        name: m.name,
        qty: Number(m.qty) || 1,
        dosage: m.dosage || '1 daily'
      })),
      status: 'Prescribed',
      createdAt: new Date().toISOString()
    };

    if (patientAge !== undefined && patientAge !== null && patientAge !== '') {
      newRx.patientAge = Number(patientAge);
    }

    const savedRx = await db.createPrescription(newRx);
    
    // Broadcast via socket.io to all clients
    if (req.io) {
      req.io.emit('new_prescription', savedRx);
      console.log('📡 Broadcasted new_prescription via websocket');
    }

    res.status(201).json(savedRx);
  } catch (error) {
    res.status(500).json({ message: 'Error creating prescription', error: error.message });
  }
});

// Update prescription status
router.put('/:id/status', async (req, res) => {
  try {
    const rxId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Retrieve old prescription to check if we are transiting to "Preparing"
    const prescriptions = await db.getPrescriptions();
    const oldRx = prescriptions.find(r => r.prescriptionId === rxId);
    
    if (!oldRx) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Update status
    const updatedRx = await db.updatePrescriptionStatus(rxId, status);

    // If moving from Prescribed/other to Preparing, deduct stock and update inventory in real-time
    if (status === 'Preparing' && oldRx.status === 'Prescribed') {
      const inventory = await db.getInventory();
      const updatedItems = [];

      for (const med of oldRx.medicines) {
        const invItem = inventory.find(i => i.name.toLowerCase() === med.name.toLowerCase());
        if (invItem) {
          const updatedInv = await db.updateInventoryStock(invItem.name, -med.qty);
          if (updatedInv) {
            updatedItems.push(updatedInv);
          }
        }
      }

      if (updatedItems.length > 0 && req.io) {
        req.io.emit('inventory_updated', updatedItems);
        console.log('📡 Broadcasted inventory_updated via websocket');
      }
    }

    // Broadcast status change
    if (req.io) {
      req.io.emit('prescription_updated', updatedRx);
      console.log(`📡 Broadcasted prescription_updated: ${rxId} is now ${status}`);
    }

    res.json(updatedRx);
  } catch (error) {
    res.status(500).json({ message: 'Error updating prescription status', error: error.message });
  }
});

export default router;
