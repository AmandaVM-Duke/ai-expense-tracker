export default function handler(req, res) {
  res.status(200).json({
    sheetUrl: process.env.SHEET_URL || ''
  });
}
