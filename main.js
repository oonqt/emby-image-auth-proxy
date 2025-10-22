import dotenv from 'dotenv';
import ms from 'ms';
import fs from 'fs';
import express from 'express';
import https from 'https';
import axios from 'axios';
import reqIp from 'request-ip';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Logger from './logger.js';
import pkg from './package.json' with { type: 'json' };

if (process.env.NODE_ENV === 'development') {
    dotenv.config();
}

const {
    EMBY_BASE_URL,
    EMBY_API_KEY,
    SESSION_CACHE_TTL,
    SSL_PFX_CERT_PATH,
    SSL_PFX_CERT_PASSPHRASE,
    PORT,
    DEBUG
} = process.env;

const PROTECTED_ROUTE_EXP = /^\/emby\/Items\/[^/]+\/Images\/Primary/i // Match /Items/<itemId>/Images/Primary

const sessionCache = new Map(); // KEY: IP, VALUE: EXP AT

const logger = new Logger(pkg.name, DEBUG === 'true');
const app = express();
const embyApi = axios.create({
    baseURL: `${EMBY_BASE_URL}/emby`,
    headers: {
        "X-Emby-Token": EMBY_API_KEY
    }
});
const embyProxy = createProxyMiddleware({
    target: EMBY_BASE_URL,
    changeOrigin: true,
    ws: true,
    on: {
        error: (err, _, res) => {
            logger.error('Proxy error', err);
            res.sendStatus(502);
        }
    }
});

app.get('/ping', (req, res) => res.sendStatus(200));

app.use(async (req, res, next) => {
    if (req.method !== 'GET' || !PROTECTED_ROUTE_EXP.test(req.path)) {
        logger.debug(`Request made to ${req.path} doesnt match ${PROTECTED_ROUTE_EXP}`);
        return next(); // Only target get requests to images endpoint
    }

    const remoteIp = reqIp.getClientIp(req);
    logger.debug(`Request made with remote IP: ${remoteIp}`);

    const cachedSessionExp = sessionCache.get(remoteIp);
    if (cachedSessionExp && (Date.now() < cachedSessionExp)) {
        logger.debug(`${remoteIp} found in session cache and not expired (exp at ${cachedSessionExp})`)
        return next(); // Has cached session and within expiry period, pass request through
    }

    const sessions = (await embyApi('/Sessions')).data;
    logger.debug(`Found sessions (IP:UserID): ${sessions.map(session => `${session.RemoteEndPoint}:${session.UserId}`).join(', ')}`)

    const authorizedSession = sessions.find(session => session.RemoteEndPoint === remoteIp);
    if (!authorizedSession) {
        logger.debug(`Attempted to access images but no authorized session found for ${remoteIp}`);
        return res.sendStatus(401);
    }

    // Set cache expiration to current time + cache ttl value passed. It is imperative we cache this to avoid hitting /emby/Sessions for every single image request made. 
    sessionCache.set(remoteIp, Date.now() + ms(SESSION_CACHE_TTL)); 
    logger.debug(`Added ${remoteIp} to session cache. Forwarding request`);

    return next();
});

app.use(embyProxy); // Redirect all other requests to Emby HTTP server

https.createServer({
    pfx: fs.readFileSync(SSL_PFX_CERT_PATH),
    passphrase: SSL_PFX_CERT_PASSPHRASE
}, app).listen(PORT, '0.0.0.0', () => {
    logger.info(`Emby image proxy v${pkg.version} listening on ${PORT}`);
});