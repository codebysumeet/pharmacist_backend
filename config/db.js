import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

// Default initial inventory data
const defaultInventory = [
  { name: "Amoxicillin 500mg", stock: 150, threshold: 50, price: 12.50, aiDemand: "High", aiRecommendation: "High seasonal demand. Keep stock above 80 units." },
  { name: "Paracetamol 500mg", stock: 500, threshold: 100, price: 3.20, aiDemand: "Medium", aiRecommendation: "Stable demand. Regular stock cycle sufficient." },
  { name: "Metformin 850mg", stock: 35, threshold: 50, price: 18.00, aiDemand: "High", aiRecommendation: "Stock critical! Below threshold. Reorder 150 units immediately." },
  { name: "Atorvastatin 20mg", stock: 120, threshold: 40, price: 25.40, aiDemand: "Low", aiRecommendation: "Slow turnover. Next reorder in 15 days." },
  { name: "Ibuprofen 400mg", stock: 45, threshold: 60, price: 5.50, aiDemand: "High", aiRecommendation: "Stock low. Winter surge predicted. Restock 200 units." },
  { name: "Lisinopril 10mg", stock: 80, threshold: 30, price: 14.20, aiDemand: "Medium", aiRecommendation: "Stable demand. Reorder next week." },
  { name: "Albuterol Inhaler", stock: 12, threshold: 25, price: 35.00, aiDemand: "High", aiRecommendation: "Stock critical! High asthma alert in region. Reorder 50 units." },
  { name: "Omeprazole 20mg", stock: 200, threshold: 50, price: 8.90, aiDemand: "Medium", aiRecommendation: "Adequate stock. No immediate actions required." }
];

// Default initial prescriptions data
const defaultPrescriptions = [
  {
    patientId: "P-1094",
    patientName: "Alice Miller",
    doctorId: "D-4022",
    doctorName: "Dr. Robert Chen",
    prescriptionId: "RX-88491",
    medicines: [
      { name: "Amoxicillin 500mg", qty: 15, dosage: "1 tab three times daily for 5 days" },
      { name: "Paracetamol 500mg", qty: 10, dosage: "1 tab every 6 hours as needed for pain" }
    ],
    status: "Prescribed",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    patientId: "P-1095",
    patientName: "Marcus Vance",
    doctorId: "D-4025",
    doctorName: "Dr. Sarah Jenkins",
    prescriptionId: "RX-88492",
    medicines: [
      { name: "Metformin 850mg", qty: 60, dosage: "1 tab twice daily with meals" },
      { name: "Atorvastatin 20mg", qty: 30, dosage: "1 tab daily at bedtime" }
    ],
    status: "Preparing",
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString() // 1 hour ago
  },
  {
    patientId: "P-1096",
    patientName: "Elena Rostova",
    doctorId: "D-4022",
    doctorName: "Dr. Robert Chen",
    prescriptionId: "RX-88493",
    medicines: [
      { name: "Ibuprofen 400mg", qty: 20, dosage: "1 tab twice daily as needed" },
      { name: "Omeprazole 20mg", qty: 14, dosage: "1 tab daily before breakfast" }
    ],
    status: "Completed",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
  }
];

let dbType = 'json'; // default

// Mongoose Models definitions
let InventoryModel, PrescriptionModel, BillModel;

export async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacist';
  try {
    // Attempt Mongoose connection with short timeout (3s) to not freeze server
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log('✅ MongoDB connected successfully.');
    dbType = 'mongodb';
    
    // Register schemas
    const inventorySchema = new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      stock: { type: Number, required: true },
      threshold: { type: Number, required: true },
      price: { type: Number, required: true },
      aiDemand: { type: String, required: true },
      aiRecommendation: { type: String, required: true }
    });
    InventoryModel = mongoose.model('Inventory', inventorySchema);

    const prescriptionSchema = new mongoose.Schema({
      patientId: { type: String, required: true },
      patientName: { type: String, required: true },
      doctorId: { type: String, required: true },
      doctorName: { type: String, required: true },
      prescriptionId: { type: String, required: true, unique: true },
      medicines: [{
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        dosage: { type: String, required: true }
      }],
      status: { type: String, default: 'Prescribed' },
      createdAt: { type: String, default: () => new Date().toISOString() }
    });
    PrescriptionModel = mongoose.model('Prescription', prescriptionSchema);

    const billSchema = new mongoose.Schema({
      patientId: { type: String, required: true },
      doctorId: { type: String, required: true },
      prescriptionId: { type: String, required: true, unique: true },
      medicines: [{
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true }
      }],
      subtotal: { type: Number, required: true },
      tax: { type: Number, required: true },
      discount: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
      aiAnalysis: { type: String },
      createdAt: { type: String, default: () => new Date().toISOString() }
    });
    BillModel = mongoose.model('Bill', billSchema);

    // Seed data if empty
    const invCount = await InventoryModel.countDocuments();
    if (invCount === 0) {
      await InventoryModel.insertMany(defaultInventory);
      console.log('Seeded default inventory in MongoDB.');
    }
    const rxCount = await PrescriptionModel.countDocuments();
    if (rxCount === 0) {
      await PrescriptionModel.insertMany(defaultPrescriptions);
      console.log('Seeded default prescriptions in MongoDB.');
    }

  } catch (err) {
    console.warn('⚠️ MongoDB connection failed. Falling back to local JSON file database.');
    dbType = 'json';
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Ensure JSON files exist
    const invPath = path.join(DATA_DIR, 'inventory.json');
    if (!fs.existsSync(invPath)) {
      fs.writeFileSync(invPath, JSON.stringify(defaultInventory, null, 2));
    }
    
    const rxPath = path.join(DATA_DIR, 'prescriptions.json');
    if (!fs.existsSync(rxPath)) {
      fs.writeFileSync(rxPath, JSON.stringify(defaultPrescriptions, null, 2));
    }

    const billsPath = path.join(DATA_DIR, 'bills.json');
    if (!fs.existsSync(billsPath)) {
      fs.writeFileSync(billsPath, JSON.stringify([], null, 2));
    }
  }
}

// Helper to read JSON file
function readJSON(file) {
  const filePath = path.join(DATA_DIR, `${file}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Helper to write JSON file
function writeJSON(file, data) {
  const filePath = path.join(DATA_DIR, `${file}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Database APIs wrapping MongoDB vs JSON
export const db = {
  getDbType: () => dbType,

  // --- INVENTORY API ---
  async getInventory() {
    if (dbType === 'mongodb') {
      return await InventoryModel.find({});
    } else {
      return readJSON('inventory');
    }
  },

  async updateInventoryStock(name, qtyChange) {
    if (dbType === 'mongodb') {
      const item = await InventoryModel.findOne({ name });
      if (item) {
        item.stock = Math.max(0, item.stock + qtyChange);
        await item.save();
        return item;
      }
      return null;
    } else {
      const inventory = readJSON('inventory');
      const item = inventory.find(i => i.name === name);
      if (item) {
        item.stock = Math.max(0, item.stock + qtyChange);
        writeJSON('inventory', inventory);
        return item;
      }
      return null;
    }
  },

  // --- PRESCRIPTIONS API ---
  async getPrescriptions() {
    if (dbType === 'mongodb') {
      return await PrescriptionModel.find({}).sort({ createdAt: -1 });
    } else {
      const prescriptions = readJSON('prescriptions');
      return prescriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  async createPrescription(rxData) {
    if (dbType === 'mongodb') {
      const newRx = new PrescriptionModel(rxData);
      return await newRx.save();
    } else {
      const prescriptions = readJSON('prescriptions');
      const newRx = {
        ...rxData,
        createdAt: rxData.createdAt || new Date().toISOString(),
        status: rxData.status || 'Prescribed'
      };
      prescriptions.push(newRx);
      writeJSON('prescriptions', prescriptions);
      return newRx;
    }
  },

  async updatePrescriptionStatus(prescriptionId, status) {
    if (dbType === 'mongodb') {
      return await PrescriptionModel.findOneAndUpdate(
        { prescriptionId },
        { status },
        { new: true }
      );
    } else {
      const prescriptions = readJSON('prescriptions');
      const rxIndex = prescriptions.findIndex(r => r.prescriptionId === prescriptionId);
      if (rxIndex !== -1) {
        prescriptions[rxIndex].status = status;
        writeJSON('prescriptions', prescriptions);
        return prescriptions[rxIndex];
      }
      return null;
    }
  },

  // --- BILLS API ---
  async getBillByPrescriptionId(prescriptionId) {
    if (dbType === 'mongodb') {
      return await BillModel.findOne({ prescriptionId });
    } else {
      const bills = readJSON('bills');
      return bills.find(b => b.prescriptionId === prescriptionId) || null;
    }
  },

  async createBill(billData) {
    if (dbType === 'mongodb') {
      const newBill = new BillModel(billData);
      return await newBill.save();
    } else {
      const bills = readJSON('bills');
      const newBill = {
        ...billData,
        createdAt: billData.createdAt || new Date().toISOString()
      };
      // Check if bill already exists to avoid duplicates
      const existsIndex = bills.findIndex(b => b.prescriptionId === billData.prescriptionId);
      if (existsIndex !== -1) {
        bills[existsIndex] = newBill; // Overwrite
      } else {
        bills.push(newBill);
      }
      writeJSON('bills', bills);
      return newBill;
    }
  }
};
