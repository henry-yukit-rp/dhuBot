const fs = require('fs');
const { pendingReimbursements, pendingQuickReimburse } = require('../../utils/store');
const { getUserConfig } = require('../../utils/config');
const { addExpense } = require('../../utils/harvest');
const dayjs = require('dayjs');

function register(app) {
  // Handle first modal submission - show file choice
  app.view('reimburse_modal', async ({ ack, body, view }) => {
    try {
      const values = view.state.values;
      const date = values.date_block.date_input.selected_date;
      const amount = values.amount_block.amount_input.value;
      const category = values.category_block.category_input.selected_option.value;
      const notes = values.notes_block?.notes_input?.value || '';
      const { channelId } = JSON.parse(view.private_metadata);

      // Store the data
      const requestId = `${body.user.id}_${Date.now()}`;
      pendingReimbursements.set(requestId, {
        date,
        amount,
        category,
        notes,
        userId: body.user.id,
        channelId
      });

      // Show file choice modal
      await ack({
        response_action: 'update',
        view: {
          type: 'modal',
          callback_id: 'file_choice_modal',
          private_metadata: requestId,
          title: { type: 'plain_text', text: 'Attach Receipt?' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Your Details:*\n• Date: ${date}\n• Amount: Php ${amount}\n• Category: ${category === 'transportation' ? 'Transportation' : 'Health and Wellness'}${notes ? `\n• Notes: ${notes}` : ''}`
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Do you have a file to attach?*'
              }
            },
            {
              type: 'actions',
              block_id: 'file_choice_actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'With File' },
                  style: 'primary',
                  action_id: 'reimburse_with_file'
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Without File' },
                  action_id: 'reimburse_without_file'
                }
              ]
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error in reimburse_modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          date_block: 'An error occurred. Please try again.'
        }
      });
    }
  });

  // Handle quick reimburse confirmation modal submission
  app.view('quick_reimburse_confirm_modal', async ({ ack, body, view, client }) => {
    const requestId = view.private_metadata;
    const data = pendingQuickReimburse.get(requestId);

    if (!data) {
      await ack({
        response_action: 'errors',
        errors: {
          date_block: 'Session expired. Please try again.'
        }
      });
      return;
    }

    try {
      const values = view.state.values;
      const date = values.date_block.date_input.selected_date;
      const amount = parseFloat(values.amount_block.amount_input.value);
      const category = values.category_block.category_input.selected_option.value;
      const notes = values.notes_block?.notes_input?.value || '';

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        await ack({
          response_action: 'errors',
          errors: {
            amount_block: 'Please enter a valid amount.'
          }
        });
        return;
      }

      await ack();

      // Get user's Harvest config
      const userConfig = getUserConfig(data.userId);

      if (!userConfig) {
        await client.chat.update({
          channel: data.channelId,
          ts: data.messageTs,
          text: 'Error: Harvest credentials not found.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reimbursement Failed*\n\n<@${data.userId}>, your Harvest credentials were not found.\n\nPlease run \`/configure\` to set up your credentials and try again.`
              }
            }
          ]
        });
        if (data.tempFilePath && fs.existsSync(data.tempFilePath)) {
          fs.unlinkSync(data.tempFilePath);
        }
        pendingQuickReimburse.delete(requestId);
        return;
      }

      // Update message to show processing
      await client.chat.update({
        channel: data.channelId,
        ts: data.messageTs,
        text: 'Submitting to Harvest...',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Submitting to Harvest...*\n\nProcessing <@${data.userId}>'s expense...`
            }
          }
        ]
      });

      // Call Harvest API
      const result = await addExpense({
        userToken: userConfig.apiToken,
        accountId: userConfig.accountId,
        expenseCategory: category,
        expenseDate: date,
        totalCost: amount,
        notes: notes,
        filePath: data.tempFilePath
      });

      // Clean up temp file
      if (data.tempFilePath && fs.existsSync(data.tempFilePath)) {
        fs.unlinkSync(data.tempFilePath);
      }

      const categoryDisplay = category === 'transportation' ? 'Transportation' : 'Health and Wellness';
      const { receiptData } = data;

      // Update message with result
      if (result.success) {
        await client.chat.update({
          channel: data.channelId,
          ts: data.messageTs,
          text: 'Reimbursement processed successfully!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reimbursement Processed Successfully*\n\n<@${data.userId}>'s ${categoryDisplay} expense has been submitted to Harvest.\n\n• Date: ${dayjs(date).format("MMM DD, YYYY")}\n• Amount: $${amount}${receiptData.wasConverted ? ` _(converted from ${receiptData.originalCurrency} ${receiptData.originalAmount} @ 1 USD = ${receiptData.conversionRate} ${receiptData.originalCurrency})_` : ''}\n• Category: ${categoryDisplay}${notes ? `\n• Notes: ${notes}` : ''}`
              }
            }
          ]
        });
      } else {
        await client.chat.update({
          channel: data.channelId,
          ts: data.messageTs,
          text: `Reimbursement failed: ${result.message}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reimbursement Failed*\n\n<@${data.userId}>, your reimbursement could not be processed.\n\n*Error:* ${result.message}`
              }
            }
          ]
        });
      }

      pendingQuickReimburse.delete(requestId);

    } catch (error) {
      console.error('Error in quick_reimburse_confirm_modal:', error);

      // Clean up temp file
      if (data.tempFilePath && fs.existsSync(data.tempFilePath)) {
        fs.unlinkSync(data.tempFilePath);
      }

      await client.chat.update({
        channel: data.channelId,
        ts: data.messageTs,
        text: `Error: ${error.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error Processing Expense*\n\n<@${data.userId}>, there was an error processing your expense.\n\n*Error:* ${error.message}`
            }
          }
        ]
      });

      pendingQuickReimburse.delete(requestId);
    }
  });
}

module.exports = { register };
