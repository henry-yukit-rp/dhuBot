const fs = require('fs');
const path = require('path');
const os = require('os');
const { getUserConfig } = require('../../utils/config');
const { pendingReimbursements, pendingFileUploads, pendingQuickReimburse } = require('../../utils/store');
const { addExpense } = require('../../utils/harvest');
const { parseReceipt } = require('../../utils/receipt-parser');
const dayjs = require('dayjs');

function register(app) {
  app.event('file_shared', async ({ event, client }) => {
    const userId = event.user_id;

    // Check if this user has a pending file upload
    const pending = pendingFileUploads.get(userId);

    if (!pending) {
      return;
    }

    // Check if the file is in the expected channel
    if (event.channel_id !== pending.channelId) {
      return;
    }

    // Route to appropriate handler based on type
    if (pending.type === 'quick_reimburse') {
      await handleQuickReimburse(event, client, userId, pending);
    } else {
      await handleRegularReimburse(event, client, userId, pending);
    }
  });
}

// Handle quick reimburse (with Claude receipt parsing)
async function handleQuickReimburse(event, client, userId, pending) {
  let tempFilePath = null;

  try {
    // Get file info
    const fileInfo = await client.files.info({ file: event.file_id });
    const file = fileInfo.file;

    // Check if it's an image
    if (!file.mimetype?.startsWith('image/') && file.mimetype !== 'application/pdf') {
      await client.chat.postMessage({
        channel: pending.channelId,
        text: 'Please upload an image file (JPG, PNG, HEIC) or PDF.',
      });
      return;
    }

    // Delete the waiting message
    await client.chat.delete({
      channel: pending.channelId,
      ts: pending.waitingMessageTs
    });

    // Post processing message
    const processingMessage = await client.chat.postMessage({
      channel: pending.channelId,
      text: 'Analyzing receipt...',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Analyzing Receipt*\n\nReading receipt details with AI...`
          }
        }
      ]
    });

    // Download the file
    const response = await fetch(file.url_private, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Parse receipt with Claude
    const parseResult = await parseReceipt(fileBuffer, file.mimetype);

    if (!parseResult.success) {
      await client.chat.update({
        channel: pending.channelId,
        ts: processingMessage.ts,
        text: `Could not parse receipt: ${parseResult.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Receipt Analysis Failed*\n\n<@${userId}>, I couldn't extract data from the receipt.\n\n*Error:* ${parseResult.message}\n\nPlease try with a clearer image or use \`/reimburse\` to enter details manually.`
            }
          }
        ]
      });
      pendingFileUploads.delete(userId);
      if (tempFilePath) fs.unlinkSync(tempFilePath);
      return;
    }

    const receiptData = parseResult.data;

    // Store the parsed data and temp file for confirmation
    const requestId = `quick_${userId}_${Date.now()}`;
    pendingQuickReimburse.set(requestId, {
      userId,
      channelId: pending.channelId,
      category: pending.category,
      notes: pending.notes || '',
      tempFilePath,
      receiptData,
      messageTs: processingMessage.ts
    });

    // Update message with parsed data and confirmation button
    const categoryDisplay = pending.category === 'transportation' ? 'Transportation' : 'Health and Wellness';
    await client.chat.update({
      channel: pending.channelId,
      ts: processingMessage.ts,
      text: 'Receipt analyzed - please review and confirm',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Receipt Analyzed*\n\nPlease review the extracted details:\n\n• Date: ${receiptData.date ? dayjs(receiptData.date).format("MMM DD, YYYY") : 'Not found'}\n• Amount: $${receiptData.amount}${receiptData.wasConverted ? ` _(converted from ${receiptData.originalCurrency} ${receiptData.originalAmount})_` : ''}\n• Category: ${categoryDisplay}${pending.notes ? `\n• Notes: ${pending.notes}` : ''}`
          }
        },
        {
          type: 'actions',
          block_id: 'quick_reimburse_actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Review & Submit' },
              style: 'primary',
              action_id: 'quick_reimburse_review',
              value: requestId
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Cancel' },
              action_id: 'quick_reimburse_cancel',
              value: requestId
            }
          ]
        }
      ]
    });

    // Clean up pending file upload (but keep the quick reimburse data)
    pendingFileUploads.delete(userId);

  } catch (error) {
    console.error('Error processing quick reimburse:', error);

    await client.chat.postMessage({
      channel: pending.channelId,
      text: `Error processing file: ${error.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Processing Receipt*\n\n<@${userId}>, there was an error processing your receipt.\n\n*Error:* ${error.message}\n\nPlease try again.`
          }
        }
      ]
    });

    pendingFileUploads.delete(userId);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// Handle regular reimburse (manual data entry)
async function handleRegularReimburse(event, client, userId, pending) {
  let tempFilePath = null;

  try {
    // Get file info
    const fileInfo = await client.files.info({ file: event.file_id });
    const file = fileInfo.file;

    // Delete the waiting message
    await client.chat.delete({
      channel: pending.channelId,
      ts: pending.waitingMessageTs
    });

    // Post processing message
    const processingMessage = await client.chat.postMessage({
      channel: pending.channelId,
      text: 'Processing reimbursement...',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Processing Reimbursement*\n\nSubmitting <@${userId}>'s expense to Harvest...`
          }
        }
      ]
    });

    // Download the file
    const response = await fetch(file.url_private, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // Get user's Harvest config
    const userConfig = getUserConfig(userId);

    if (!userConfig) {
      await client.chat.update({
        channel: pending.channelId,
        ts: processingMessage.ts,
        text: 'Error: Harvest credentials not found.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Reimbursement Failed*\n\n<@${userId}>, your Harvest credentials were not found.\n\nPlease run \`/configure\` to set up your credentials and try again.`
            }
          }
        ]
      });
      pendingFileUploads.delete(userId);
      pendingReimbursements.delete(pending.requestId);
      if (tempFilePath) fs.unlinkSync(tempFilePath);
      return;
    }

    // Call Harvest API
    const result = await addExpense({
      userToken: userConfig.apiToken,
      accountId: userConfig.accountId,
      expenseCategory: pending.category,
      expenseDate: pending.date,
      totalCost: pending.amount,
      notes: pending.notes || '',
      filePath: tempFilePath
    });

    // Clean up temp file
    if (tempFilePath) fs.unlinkSync(tempFilePath);

    // Update message with result
    if (result.success) {
      await client.chat.update({
        channel: pending.channelId,
        ts: processingMessage.ts,
        text: 'Reimbursement processed successfully!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Reimbursement Processed Successfully*\n\n<@${userId}>'s reimbursement has been submitted to Harvest.\n\n• Date: ${pending.date}\n• Amount: Php ${pending.amount}\n• Category: ${pending.category === 'transportation' ? 'Transportation' : 'Health and Wellness'}${pending.notes ? `\n• Notes: ${pending.notes}` : ''}\n`
            }
          }
        ]
      });
    } else {
      await client.chat.update({
        channel: pending.channelId,
        ts: processingMessage.ts,
        text: `Reimbursement failed: ${result.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Reimbursement Failed*\n\n<@${userId}>, your reimbursement could not be processed.\n\n*Error:* ${result.message}`
            }
          }
        ]
      });
    }

    // Clean up
    pendingFileUploads.delete(userId);
    pendingReimbursements.delete(pending.requestId);

  } catch (error) {
    console.error('Error processing file upload:', error);

    await client.chat.postMessage({
      channel: pending.channelId,
      text: `Error processing file: ${error.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Processing File*\n\n<@${userId}>, there was an error processing your file.\n\n*Error:* ${error.message}\n\nPlease try again.`
          }
        }
      ]
    });

    pendingFileUploads.delete(userId);
    pendingReimbursements.delete(pending.requestId);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

module.exports = { register };
