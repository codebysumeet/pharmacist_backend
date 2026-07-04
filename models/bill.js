const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
    },

    medicines: [
      {
        medicineId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
        },

        name: String,

        quantity: Number,

        price: Number,

        total: Number,
      },
    ],

    subtotal: Number,

    gst: Number,

    grandTotal: Number,

    pdfUrl: String,

    paymentStatus: {
      type: String,
      default: "Pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Bill", billSchema);
