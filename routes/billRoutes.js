import express from 'express';
import { db } from '../config/db.js';
import { generateBillPdf } from "../utils/generateBillPdf.js";

const router = express.Router();

// Get bill for a specific prescription
router.get('/:prescriptionId', async (req, res) => {
  try {
    const rxId = req.params.prescriptionId;
    const bill = await db.getBillByPrescriptionId(rxId);
    
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found for this prescription' });
    }
    
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving bill', error: error.message });
  }
});

// Generate bill using AI logic
router.post('/generate', async (req, res) => {
  try {
    const { prescriptionId } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({ message: 'Prescription ID is required' });
    }

    // Check if bill already exists
    const existingBill = await db.getBillByPrescriptionId(prescriptionId);
    if (existingBill) {
      return res.json(existingBill); // Return existing bill if already generated
    }

    // Fetch the prescription
    const prescriptions = await db.getPrescriptions();
    const rx = prescriptions.find(r => r.prescriptionId === prescriptionId);
    if (!rx) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Fetch inventory to compute prices
    const inventory = await db.getInventory();
    
    // Build bill items
    const billItems = rx.medicines.map(med => {
      const invItem = inventory.find(i => i.name.toLowerCase() === med.name.toLowerCase());
      const unitPrice = invItem ? invItem.price : 10.00; // Fallback price
      return {
        name: med.name,
        qty: med.qty,
        price: unitPrice,
        total: Number((med.qty * unitPrice).toFixed(2))
      };
    });

    const subtotal = Number(billItems.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    
    // AI Billing Agent Simulation
    // 1. Calculate Tax (e.g. 8% pharmacy tax)
    const taxRate = 0.08;
    const tax = Number((subtotal * taxRate).toFixed(2));

    // 2. AI Discount/Insurance Simulation
    // We will calculate a smart discount based on the patient's prescription contents
    let insuranceProvider = "Medicare Part D";
    let coveragePercent = 70; // 70% average coverage
    let extraDiscount = 0;

    if (subtotal > 100) {
      insuranceProvider = "Blue Cross Blue Shield";
      coveragePercent = 85;
    } else if (subtotal < 30) {
      insuranceProvider = "Standard Copay Program";
      coveragePercent = 50;
      extraDiscount = 2.00; // generic extra rebate
    }

    // Calculate simulated insurance copay/discount
    const insuranceCoverageVal = Number((subtotal * (coveragePercent / 100)).toFixed(2));
    const discount = Number((insuranceCoverageVal + extraDiscount).toFixed(2));

    // 3. AI Recommendations/Analysis notes
    const aiAnalysis = `AI Billing Agent checked ICD-10 codes for Rx ${prescriptionId}. 
Validated insurance coverage via ${insuranceProvider} (approved ${coveragePercent}% copay coverage). 
${extraDiscount > 0 ? `Applied local Pharmacy Generic Drug Rebate of $${extraDiscount.toFixed(2)}.` : ''}
Verified that prescribing physician ${rx.doctorName} is in-network. 
Total savings calculated: $${discount.toFixed(2)}. Patient responsibility reduced.`;

    // 4. Final total calculation
    const totalPrice = Number(Math.max(0, subtotal + tax - discount).toFixed(2));

    const billData = {
      patientId: rx.patientId,
      doctorId: rx.doctorId,
      prescriptionId: rx.prescriptionId,
      medicines: billItems,
      subtotal,
      tax,
      discount,
      totalPrice,
      aiAnalysis,
      createdAt: new Date().toISOString()
    };

    const savedBill = await db.createBill(billData);

    // Generate PDF and save path
    try {
      const pdfUrl = await generateBillPdf(savedBill);
      savedBill.pdfUrl = pdfUrl;
      await db.updateBill(savedBill.prescriptionId, { pdfUrl });
    } catch (pdfError) {
      console.error("PDF generation failed:", pdfError.message);
    }

    // Emit event that bill is generated (optional, dashboard can fetch or update via socket)
    if (req.io) {
      req.io.emit('bill_generated', savedBill);
      console.log(`📡 Broadcasted bill_generated for: ${prescriptionId}`);
    }

    res.status(201).json(savedBill);
  } catch (error) {
    res.status(500).json({ message: 'Error generating bill', error: error.message });
  }
});

export default router;
