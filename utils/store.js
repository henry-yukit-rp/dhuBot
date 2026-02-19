// In-memory stores for pending data

// Store pending reimbursement data
const pendingReimbursements = new Map();

// Store pending file uploads (waiting for file)
const pendingFileUploads = new Map();

// Store pending quick reimburse confirmations (parsed receipt data + temp file)
const pendingQuickReimburse = new Map();

module.exports = {
  pendingReimbursements,
  pendingFileUploads,
  pendingQuickReimburse
};
