# dhubot

Expense reimbursement skill with AI receipt parsing and Harvest integration.

## When to Use This Skill

Trigger this skill when the user wants to:
- Submit an expense reimbursement
- Parse a receipt image
- Check their reimbursement balance or status
- Configure Harvest API credentials
- View spending limits per cutoff period

**Example triggers:**
- "Submit a reimbursement"
- "Parse this receipt"
- "What's my reimbursement balance?"
- "Configure my Harvest account"
- "How much can I still claim this cutoff?"

## Instructions

### 1. Configure Harvest Credentials

When the user needs to set up or update their Harvest credentials:

1. Ask for their **Harvest API Token** and **Account ID**
2. Use the `utils/config.js` module to save credentials:
   ```javascript
   const { saveConfig } = require('./utils/config');
   saveConfig(userId, { apiToken, accountId });
   ```
3. Credentials are automatically encrypted with AES-256-GCM

### 2. Submit a Reimbursement

When the user wants to submit an expense:

1. **Check credentials exist** using `getConfig(userId)` from `utils/config.js`
2. **Gather expense details:**
   - Date (default: today)
   - Amount
   - Category: `transportation` or `wellness`
   - Notes (optional)
   - Receipt file (optional)

3. **If receipt image provided**, parse it first (see section 3)

4. **Convert currency to USD** using `utils/currency.js`:
   ```javascript
   const { convertToUSD } = require('./utils/currency');
   const usdAmount = await convertToUSD(amount, 'PHP');
   ```

5. **Submit to Harvest** using `utils/harvest.js`:
   ```javascript
   const { addExpense } = require('./utils/harvest');
   await addExpense(apiToken, accountId, {
     date,           // YYYY-MM-DD format
     amount,         // USD
     category,       // 'transportation' or 'wellness'
     notes,
     receiptPath     // optional file path
   });
   ```

### 3. Parse a Receipt

When the user provides a receipt image:

1. Use `utils/receipt-parser.js` to extract data:
   ```javascript
   const { parseReceipt } = require('./utils/receipt-parser');
   const result = await parseReceipt(imagePath);
   // Returns: { date, amount, currency, description }
   ```

2. Supported formats: JPG, PNG, HEIC, PDF

3. The parser uses Claude AI to:
   - Extract the transaction date
   - Calculate total amount (sums line items if no total)
   - Detect currency
   - Generate a brief description

4. Present extracted data to user for confirmation before submitting

### 4. Check Reimbursement Status

When the user asks about their balance or spending:

1. **Determine current cutoff period:**
   - 1st-15th of month (first cutoff)
   - 16th-end of month (second cutoff)

2. **Fetch expenses** using `utils/harvest.js`:
   ```javascript
   const { getExpenses } = require('./utils/harvest');
   const expenses = await getExpenses(apiToken, accountId, startDate, endDate);
   ```

3. **Calculate usage by category:**

   | Category | Limit per Cutoff |
   |----------|------------------|
   | Transportation | 50 USD |
   | Health & Wellness | 16.67 USD |

4. **Report to user:**
   - Current cutoff period dates
   - Amount used per category
   - Remaining balance per category
   - Percentage used

### 5. Category Reference

| Category | Harvest Category ID | Limit (USD) | Limit (PHP) |
|----------|---------------------|-------------|-------------|
| Transportation | 4264709 | 50.00 | ~2,500 |
| Wellness/Health | 4264710 | 16.67 | ~833.33 |

### 6. Harvest Project Configuration

These are the fixed Harvest IDs for expense submission:
- **Project ID:** 45414040 (PH Unbillable Expenses)
- **Client ID:** 16078381

## File Reference

| File | Purpose |
|------|---------|
| `utils/config.js` | Save/load encrypted user credentials |
| `utils/crypto.js` | AES-256-GCM encryption utilities |
| `utils/currency.js` | Exchange rate fetching and conversion |
| `utils/harvest.js` | Harvest API integration |
| `utils/receipt-parser.js` | Claude AI receipt parsing |

## Example Workflow

**User:** "I want to submit a transportation reimbursement for this receipt" (attaches image)

**Claude should:**
1. Check if Harvest credentials are configured
2. Parse the receipt image to extract date, amount, currency
3. Convert amount to USD if needed
4. Show extracted data and ask for confirmation
5. Submit to Harvest with the receipt attached
6. Report success with expense details

## Error Handling

| Situation | Action |
|-----------|--------|
| No credentials configured | Guide user to provide Harvest API token and Account ID |
| Receipt parse fails | Ask user to manually provide date and amount |
| Invalid file format | Request JPG, PNG, HEIC, or PDF |
| Harvest API error | Display error message and suggest checking credentials |
| Over spending limit | Warn user but allow submission if they confirm |
