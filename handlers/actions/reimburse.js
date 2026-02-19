const fs = require('fs');
const { getUserConfig } = require('../../utils/config');
const { pendingReimbursements, pendingFileUploads, pendingQuickReimburse } = require('../../utils/store');
const { addExpense } = require('../../utils/harvest');
const dayjs = require('dayjs');

function register(app) {
  // Handle "With File" button
  app.action('reimburse_with_file', async ({ ack, body, client }) => {
    await ack();

    try {
      const requestId = body.view.private_metadata;
      const data = pendingReimbursements.get(requestId);

      if (!data) {
        return;
      }

      // Close the modal
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Upload File' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Please upload your receipt file in the channel.*\n\nI will process your reimbursement once I receive the file.'
              }
            }
          ]
        }
      });

      // Post waiting message in channel
      const waitingMessage = await client.chat.postMessage({
        channel: data.channelId,
        text: `Waiting for receipt file from <@${data.userId}>...`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Waiting for receipt file*\n\n<@${data.userId}>, please upload your receipt file to complete your reimbursement request.\n\n• Date: ${data.date}\n• Amount: Php ${data.amount}\n• Category: ${data.category === 'transportation' ? 'Transportation' : 'Health and Wellness'}${data.notes ? `\n• Notes: ${data.notes}` : ''}`
            }
          }
        ]
      });

      // Store pending file upload
      pendingFileUploads.set(data.userId, {
        ...data,
        requestId,
        waitingMessageTs: waitingMessage.ts
      });
    } catch (error) {
      console.error('Error in reimburse_with_file:', error);
    }
  });

  // Handle "Without File" button
  app.action('reimburse_without_file', async ({ ack, body, client }) => {
    await ack();

    try {
      const requestId = body.view.private_metadata;
      const data = pendingReimbursements.get(requestId);

      if (!data) {
        return;
      }

      // Get user's Harvest config
      const userConfig = getUserConfig(data.userId);

      if (!userConfig) {
        await client.views.update({
          view_id: body.view.id,
          view: {
            type: 'modal',
            title: { type: 'plain_text', text: 'Error' },
            close: { type: 'plain_text', text: 'Close' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*Error: Harvest credentials not found.*\n\nPlease run `/configure` to set up your credentials.'
                }
              }
            ]
          }
        });
        pendingReimbursements.delete(requestId);
        return;
      }

      // Show processing modal
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Processing...' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Processing your reimbursement request...*\n\nPlease wait while we submit to Harvest.'
              }
            }
          ]
        }
      });

      // Call Harvest API
      const result = await addExpense({
        userToken: userConfig.apiToken,
        accountId: userConfig.accountId,
        expenseCategory: data.category,
        expenseDate: data.date,
        totalCost: data.amount,
        notes: data.notes || 'Reimbursement submitted via Slack',
        filePath: null
      });

      // Post result message in channel
      if (result.success) {
        await client.chat.postMessage({
          channel: data.channelId,
          text: 'Reimbursement processed successfully!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reimbursement Processed Successfully*\n\n<@${data.userId}>'s reimbursement has been submitted to Harvest.\n\n• Date: ${data.date}\n• Amount: Php ${data.amount}\n• Category: ${data.category === 'transportation' ? 'Transportation' : 'Health and Wellness'}${data.notes ? `\n• Notes: ${data.notes}` : ''}\n• Receipt: None`
              }
            }
          ]
        });
      } else {
        await client.chat.postMessage({
          channel: data.channelId,
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

      pendingReimbursements.delete(requestId);
    } catch (error) {
      console.error('Error in reimburse_without_file:', error);
    }
  });

  // Handle "Review & Submit" button for quick reimburse
  app.action('quick_reimburse_review', async ({ ack, body, client }) => {
    await ack();

    try {
      const requestId = body.actions[0].value;
      const data = pendingQuickReimburse.get(requestId);

      if (!data) {
        return;
      }

      const { receiptData, category, notes } = data;

      // Open confirmation modal with editable fields
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'quick_reimburse_confirm_modal',
          private_metadata: requestId,
          title: { type: 'plain_text', text: 'Confirm Expense' },
          submit: { type: 'plain_text', text: 'Submit to Harvest' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Review and edit the expense details below:*'
              }
            },
            {
              type: 'input',
              block_id: 'date_block',
              element: {
                type: 'datepicker',
                action_id: 'date_input',
                initial_date: receiptData.date || dayjs().format('YYYY-MM-DD'),
                placeholder: { type: 'plain_text', text: 'Select a date' }
              },
              label: { type: 'plain_text', text: 'Date' }
            },
            {
              type: 'input',
              block_id: 'amount_block',
              element: {
                type: 'plain_text_input',
                action_id: 'amount_input',
                initial_value: String(receiptData.amount),
                placeholder: { type: 'plain_text', text: 'Enter amount (e.g., 42.50)' }
              },
              label: { type: 'plain_text', text: 'Amount (USD)' }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: receiptData.wasConverted
                    ? `_Converted from ${receiptData.originalCurrency} ${receiptData.originalAmount} @ rate ${receiptData.conversionRate}_`
                    : '_Original amount in USD_'
                }
              ]
            },
            {
              type: 'input',
              block_id: 'category_block',
              element: {
                type: 'static_select',
                action_id: 'category_input',
                initial_option: {
                  text: { type: 'plain_text', text: category === 'transportation' ? 'Transportation' : 'Health and Wellness' },
                  value: category
                },
                options: [
                  {
                    text: { type: 'plain_text', text: 'Transportation' },
                    value: 'transportation'
                  },
                  {
                    text: { type: 'plain_text', text: 'Health and Wellness' },
                    value: 'health_wellness'
                  }
                ]
              },
              label: { type: 'plain_text', text: 'Category' }
            },
            {
              type: 'input',
              block_id: 'notes_block',
              optional: true,
              element: {
                type: 'plain_text_input',
                action_id: 'notes_input',
                multiline: true,
                initial_value: notes,
                placeholder: { type: 'plain_text', text: 'Add any notes (optional)' }
              },
              label: { type: 'plain_text', text: 'Notes' }
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error in quick_reimburse_review:', error);
    }
  });

  // Handle "Cancel" button for quick reimburse
  app.action('quick_reimburse_cancel', async ({ ack, body, client }) => {
    await ack();

    try {
      const requestId = body.actions[0].value;
      const data = pendingQuickReimburse.get(requestId);

      if (data) {
        // Clean up temp file
        if (data.tempFilePath && fs.existsSync(data.tempFilePath)) {
          fs.unlinkSync(data.tempFilePath);
        }

        // Update the message
        await client.chat.update({
          channel: data.channelId,
          ts: data.messageTs,
          text: 'Reimbursement cancelled.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reimbursement Cancelled*\n\n<@${data.userId}>, your reimbursement request has been cancelled.`
              }
            }
          ]
        });

        pendingQuickReimburse.delete(requestId);
      }
    } catch (error) {
      console.error('Error in quick_reimburse_cancel:', error);
    }
  });
}

module.exports = { register };
