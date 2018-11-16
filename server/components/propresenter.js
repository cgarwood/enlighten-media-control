/*
    Initial ProPresenter component
    Connect to ProPresenter Remote and Stage Display websockets
    Fire events based on data received from ProPresenter
    Register functions/methods for ProPresenter control
*/

const logger = require('../logger.js');

async function setupComponent() {
    logger.info('ProPresenter component initialized');
}
module.exports = { setupComponent };
