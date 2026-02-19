const { getUserConfig } = require('../../utils/config');
const { getCurrentReimbursements, getMidpointDate } = require('../../utils/harvest');
const dayjs = require('dayjs');

// Allowance limits per cutoff (in USD - since Harvest stores in USD)
const TRANSPORTATION_LIMIT = 50; // ~2500 PHP
const WELLNESS_LIMIT = 16.67;    // ~833.33 PHP

function isFirstCutoff(date = dayjs()) {
  const midpoint = getMidpointDate(date);
  return date.date() <= midpoint;
}

function register(app) {
  app.command('/reimbursement-status', async ({ ack, body, client }) => {
    await ack();

    try {
      const userId = body.user_id;
      const channelId = body.channel_id;

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
                text: '*Harvest credentials not found*\n\nPlease run `/configure` to set up your Harvest API credentials first.'
              }
            }
          ]
        });
        return;
      }

      // Show loading message
      const loadingMessage = await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'Fetching your reimbursement status...'
      });

      // Get current reimbursements
      const usage = await getCurrentReimbursements(userConfig.apiToken, userConfig.accountId);

      const transportationRemaining = Math.max(0, TRANSPORTATION_LIMIT - usage.transportation);
      const wellnessRemaining = Math.max(0, WELLNESS_LIMIT - usage.wellness);

      const transportationPercent = Math.min(100, (usage.transportation / TRANSPORTATION_LIMIT) * 100);
      const wellnessPercent = Math.min(100, (usage.wellness / WELLNESS_LIMIT) * 100);

      // Determine cutoff period
      const firstCutoff = isFirstCutoff();
      const cutoffLabel = firstCutoff ? '1st Cutoff (1st - 15th)' : '2nd Cutoff (16th - End)';
      const midpoint = getMidpointDate();

      // Create progress bars
      const createProgressBar = (percent) => {
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
      };

      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'Your reimbursement status',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Reimbursement Status'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*${cutoffLabel}* • ${dayjs().format('MMMM YYYY')}`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Transportation*\n${createProgressBar(transportationPercent)} ${transportationPercent.toFixed(0)}%\n\nUsed: *$${usage.transportation.toFixed(2)}* / $${TRANSPORTATION_LIMIT.toFixed(2)}\nRemaining: *$${transportationRemaining.toFixed(2)}*`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Health & Wellness*\n${createProgressBar(wellnessPercent)} ${wellnessPercent.toFixed(0)}%\n\nUsed: *$${usage.wellness.toFixed(2)}* / $${WELLNESS_LIMIT.toFixed(2)}\nRemaining: *$${wellnessRemaining.toFixed(2)}*`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '_Use `/reimburse-transpo` or `/reimburse-wellness` to submit expenses_'
              }
            ]
          }
        ]
      });

    } catch (error) {
      console.error('Error in /reimbursement-status:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `Error fetching reimbursement status: ${error.message}`
      });
    }
  });
}

module.exports = { register };
