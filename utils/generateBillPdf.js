import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateBillPdf = (bill) => {
  return new Promise((resolve, reject) => {
    const billsDir = path.join(process.cwd(), "uploads", "bills");

    if (!fs.existsSync(billsDir)) {
      fs.mkdirSync(billsDir, { recursive: true });
    }

    const fileName = `${bill.prescriptionId}.pdf`;
    const filePath = path.join(billsDir, fileName);

    const doc = new PDFDocument();

    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(22).text("PHARMACY BILL", {
      align: "center",
    });

    doc.moveDown();

    doc.text(`Patient ID : ${bill.patientId}`);
    doc.text(`Doctor ID : ${bill.doctorId}`);
    doc.text(`Prescription : ${bill.prescriptionId}`);

    doc.moveDown();

    bill.medicines.forEach((m) => {
      doc.text(
        `${m.name}
Qty : ${m.qty}
Price : ₹${m.price}
Total : ₹${m.total}`,
      );
    });

    doc.moveDown();

    doc.text(`Subtotal : ₹${bill.subtotal}`);
    doc.text(`Tax : ₹${bill.tax}`);
    doc.text(`Discount : ₹${bill.discount}`);
    doc.text(`Total : ₹${bill.totalPrice}`);

    doc.end();

    stream.on("finish", () => {
      resolve(`/uploads/bills/${fileName}`);
    });

    stream.on("error", reject);
  });
};
