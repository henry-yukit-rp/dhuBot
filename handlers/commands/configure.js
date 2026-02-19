const { getUserConfig } = require('../../utils/config');

function register(app) {
  app.command('/configure', async ({ ack, body, client }) => {
    await ack();

    try {
      const userConfig = getUserConfig(body.user_id) || {};

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'configure_modal',
          title: { type: 'plain_text', text: 'Harvest Configuration' },
          submit: { type: 'plain_text', text: 'Save' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'api_token_block',
              element: {
                type: 'plain_text_input',
                action_id: 'api_token_input',
                placeholder: { type: 'plain_text', text: 'Enter your Harvest API Token' },
                initial_value: userConfig.apiToken || ''
              },
              label: { type: 'plain_text', text: 'Harvest API Token' }
            },
            {
              type: 'input',
              block_id: 'account_id_block',
              element: {
                type: 'plain_text_input',
                action_id: 'account_id_input',
                placeholder: { type: 'plain_text', text: 'Enter your Harvest Account ID' },
                initial_value: userConfig.accountId || ''
              },
              label: { type: 'plain_text', text: 'Harvest Account ID' }
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error in /configure command:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `Error: ${error.message}. Please try again.`
      });
    }
  });
}

module.exports = { register };
