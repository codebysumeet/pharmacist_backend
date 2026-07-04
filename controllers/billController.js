const Bill = require("../models/Bill");

const generatePdf = require("../utils/generateBillPdf");

exports.createBill = async (req, res) => {
  try {
    const bill = await Bill.create(req.body);

    const pdfUrl = await generatePdf(bill);

    bill.pdfUrl = pdfUrl;

    await bill.save();

    res.status(201).json({
      success: true,

      bill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};
