/*
    Enlighten Media Control Server
*/

const WebSocket = require('ws');

const CONFIG = require('./config.js');
const logger = require('./logger.js');

const components = [];

logger.info('Starting Enlighten Media Control Server.');

/* Set up Websocket Server */
logger.info(`Setting up WebSocket server on port ${CONFIG.port}.`);
const wss = new WebSocket.Server({ port: CONFIG.port });

wss.on('connection', (ws, req) => {
    ws.on('message', message => {
        logger.debug(`Received message: ${message}`);
    });
    logger.info(`Incoming Connection from ${req.connection.remoteAddress}`);
    ws.send('Connection Established.');
});

/* Set up Components */
Object.keys(CONFIG.components).forEach(key => {
    if (!CONFIG.components[key].enabled) return;

    logger.info(`Setting up component ${key}`);

    // components should export a single 'component' object
    // that should implement at minimum an EventEmitter object
    // defined at component.events
    components[key] = require(`./components/${key}.js`); // eslint-disable-line global-require, import/no-dynamic-require

    // setup default listeners
    logger.info(Object.keys(components[key].component));
    components[key].component.events.on('message', data => {
        logger.debug(`${key} event: 'message'\nDATA: ${JSON.stringify(data)}`);
        wss.clients.forEach(client => {
            client.send(
                JSON.stringify({
                    type: 'message',
                    component: key,
                    data,
                })
            );
        });
    });
});
