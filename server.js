import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import path from "path";
// Import routes
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import billRoutes from './routes/billRoutes.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for simplicity in development
    methods: ['GET', 'POST', 'PUT']
  }
});

const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
// Parse incoming requests as JSON
app.use(express.json());

// Socket.io middleware to attach io to request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Register API Routes
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bills', billRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Base route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Start the DB and then the HTTP Server
const startServer = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
