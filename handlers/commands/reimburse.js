const { getUserConfig } = require('../../utils/config');

function register(app) {
  app.command('/reimburse', async ({ ack, body, client }) => {
    await ack();

    try {
      const userConfig = getUserConfig(body.user_id);

      if (!userConfig) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
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
                text: '*How to configure:*\n1. Run `/configure` in any channel\n2. Enter your Harvest API Token and Account ID\n3. Click Save\n\n*To get your Harvest credentials:*\n1. Go to <https://id.getharvest.com/developers|Harvest Developers>\n2. Create a new Personal Access Token\n3. Copy your Token and Account ID'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Rest assured that your credentials are secured.*'
              }
            }
          ]
        });
        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'reimburse_modal',
          private_metadata: JSON.stringify({ channelId: body.channel_id }),
          title: { type: 'plain_text', text: 'Reimbursement Request' },
          submit: { type: 'plain_text', text: 'Next' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'date_block',
              element: {
                type: 'datepicker',
                action_id: 'date_input',
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
                placeholder: { type: 'plain_text', text: 'Enter amount (e.g., 42.50)' }
              },
              label: { type: 'plain_text', text: 'Total Amount' }
            },
            {
              type: 'input',
              block_id: 'category_block',
              element: {
                type: 'static_select',
                action_id: 'category_input',
                placeholder: { type: 'plain_text', text: 'Select category' },
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
                placeholder: { type: 'plain_text', text: 'Add any notes or description (optional)' }
              },
              label: { type: 'plain_text', text: 'Notes' }
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error in /reimburse command:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `Error: ${error.message}. Please try again.`
      });
    }
  });
}

module.exports = { register };
