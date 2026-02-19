const { saveUserConfig } = require('../../utils/config');

function register(app) {
  app.view('configure_modal', async ({ ack, body, view }) => {
    try {
      const userId = body.user.id;
      const values = view.state.values;
      const apiToken = values.api_token_block.api_token_input.value;
      const accountId = values.account_id_block.account_id_input.value;

      // Save config
      saveUserConfig(userId, apiToken, accountId);

      await ack({
        response_action: 'update',
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Configuration Saved' },
          close: { type: 'plain_text', text: 'Close' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Your Harvest configuration has been saved.*\n\nYou can run `/configure` again to update your settings.'
              }
            }
          ]
        }
      });

      console.log(`Configuration saved for user ${userId}`);
    } catch (error) {
      console.error('Error in configure_modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          api_token_block: 'An error occurred. Please try again.'
        }
      });
    }
  });
}

module.exports = { register };
