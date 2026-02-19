const { getUserConfig } = require('../../utils/config');
const { pendingFileUploads } = require('../../utils/store');

function register(app) {
  // /reimburse-transpo command
  app.command('/reimburse-transpo', async ({ ack, body, client, command }) => {
    await ack();
    await handleQuickReimburse(client, body, command, 'transportation');
  });

  // /reimburse-wellness command
  app.command('/reimburse-wellness', async ({ ack, body, client, command }) => {
    await ack();
    await handleQuickReimburse(client, body, command, 'health_wellness');
  });
}

async function handleQuickReimburse(client, body, command, category) {
  try {
    const userId = body.user_id;
    const channelId = body.channel_id;
    const notes = command.text?.trim() || ''; // Optional notes from command

    // Check if user has configured Harvest credentials
    const userConfig = getUserConfig(userId);

    if (!userConfig) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'You need to configure your Harvest credentials first.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Harvest credentials not found*\n\nBefore you can submit reimbursements, you need to configure your Harvest API credentials.'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*How to configure:*\n1. Run `/configure` in any channel\n2. Enter your Harvest API Token and Account ID\n3. Click Save'
            }
          }
        ]
      });
      return;
    }

    const categoryDisplay = category === 'transportation' ? 'Transportation' : 'Health and Wellness';

    // Post message asking for receipt
    const waitingMessage = await client.chat.postMessage({
      channel: channelId,
      text: `Ready for receipt upload`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${categoryDisplay} Reimbursement*\n\n<@${userId}>, please upload your receipt image.\n\nI will automatically extract the date and amount from the receipt.${notes ? `\n\n*Notes:* ${notes}` : ''}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_Supported formats: JPG, PNG, HEIC, PDF_'
            }
          ]
        }
      ]
    });

    // Store pending upload with category info
    pendingFileUploads.set(userId, {
      type: 'quick_reimburse',
      category: category,
      notes: notes,
      userId: userId,
      channelId: channelId,
      waitingMessageTs: waitingMessage.ts
    });

  } catch (error) {
    console.error(`Error in reimburse-${category} command:`, error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `Error: ${error.message}. Please try again.`
    });
  }
}

module.exports = { register };
