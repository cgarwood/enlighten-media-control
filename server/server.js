/*
    Enlighten Media Control Server
*/

const WebSocket = require('ws');

const CONFIG = require('./config.js');
const logger = require('./logger.js');

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
