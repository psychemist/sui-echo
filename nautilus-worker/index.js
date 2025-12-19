const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Transaction } = require('@mysten/sui/transactions');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration for production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, startTime: now });
        return next();
    }

    const record = rateLimitMap.get(ip);
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, startTime: now });
        return next();
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
    }

    record.count++;
    next();
}

app.use(rateLimit);

// Configuration
const PORT = process.env.PORT || 3001;
const WALRUS_AGGREGATOR = process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const SUI_RPC_URL = getFullnodeUrl(SUI_NETWORK);
const PACKAGE_ID = process.env.PACKAGE_ID;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

// Validate required configuration
if (!PACKAGE_ID || PACKAGE_ID === '0x...') {
    console.warn('[TEE] WARNING: PACKAGE_ID not configured. On-chain verification will fail.');
}

const client = new SuiClient({ url: SUI_RPC_URL });

// Structured logging
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        level,
        service: 'nautilus-tee',
        message,
        ...data
    }));
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '1.0.0',
        network: SUI_NETWORK,
        packageId: PACKAGE_ID ? `${PACKAGE_ID.slice(0, 10)}...` : 'NOT_CONFIGURED',
        adminKeyConfigured: !!ADMIN_SECRET_KEY,
    });
});

/**
 * Nautilus TEE Verification Endpoint
 * 
 * Production Flow:
 * 1. Receives a Blob ID and Handout Object ID
 * 2. Fetches content from Walrus
 * 3. Performs content verification (hash integrity, minimum content check)
 * 4. Signs and submits a verification transaction to Sui
 * 5. Returns the transaction digest and verification status
 */
app.post('/verify', async (req, res) => {
    const { blobId, handoutId, expectedHash } = req.body;

    // Input validation
    if (!blobId || typeof blobId !== 'string') {
        return res.status(400).json({ error: "Missing or invalid blobId" });
    }
    if (!handoutId || typeof handoutId !== 'string') {
        return res.status(400).json({ error: "Missing or invalid handoutId" });
    }

    // Sanitize inputs (remove any potential injection characters)
    const sanitizedBlobId = blobId.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedHandoutId = handoutId.replace(/[^a-zA-Z0-9x]/g, '');

    log('info', 'Starting verification', { blobId: sanitizedBlobId, handoutId: sanitizedHandoutId });

    try {
        // Step 1: Fetch content from Walrus
        const walrusUrl = `${WALRUS_AGGREGATOR}/v1/${sanitizedBlobId}`;
        const response = await axios.get(walrusUrl, {
            timeout: 30000, // 30 second timeout
            maxContentLength: 10 * 1024 * 1024, // 10MB max
        });
        const textContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        log('info', 'Content fetched from Walrus', {
            blobId: sanitizedBlobId,
            contentLength: textContent.length
        });

        // Step 2: Content verification
        const contentHash = crypto.createHash('sha256').update(textContent).digest('hex');

        // Verification checks
        const verificationResults = {
            minLengthCheck: textContent.length >= 10,
            hashCheck: expectedHash ? contentHash === expectedHash : true,
            contentIntegrity: true, // Basic check - content was successfully retrieved
        };

        const isVerified = Object.values(verificationResults).every(v => v);

        if (!isVerified) {
            log('warn', 'Verification failed', {
                blobId: sanitizedBlobId,
                results: verificationResults
            });
            return res.status(422).json({
                error: "Verification failed",
                details: verificationResults,
                contentHash,
            });
        }

        log('info', 'Content verified successfully', {
            blobId: sanitizedBlobId,
            contentHash
        });

        // Step 3: On-chain attestation
        if (!ADMIN_SECRET_KEY) {
            log('warn', 'Admin key not configured, skipping on-chain verification');
            return res.json({
                status: "verified_locally",
                message: "Content verified successfully. On-chain attestation skipped (TEE key not configured).",
                contentHash,
                verificationResults,
            });
        }

        if (!PACKAGE_ID || PACKAGE_ID === '0x...') {
            log('warn', 'Package ID not configured, skipping on-chain verification');
            return res.json({
                status: "verified_locally",
                message: "Content verified successfully. On-chain attestation skipped (Package ID not configured).",
                contentHash,
                verificationResults,
            });
        }

        // Step 4: Sign and submit verification transaction
        const keypair = Ed25519Keypair.fromSecretKey(ADMIN_SECRET_KEY);
        const tx = new Transaction();

        tx.moveCall({
            target: `${PACKAGE_ID}::echo::verify_handout`,
            arguments: [
                tx.object(sanitizedHandoutId)
            ],
        });

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });

        log('info', 'Verification transaction submitted', {
            digest: result.digest,
            status: result.effects?.status?.status,
        });

        // Check transaction status
        if (result.effects?.status?.status !== 'success') {
            log('error', 'Verification transaction failed', {
                digest: result.digest,
                error: result.effects?.status?.error,
            });
            return res.status(500).json({
                status: "transaction_failed",
                error: result.effects?.status?.error || "Transaction execution failed",
                digest: result.digest,
            });
        }

        res.json({
            status: "verified_onchain",
            digest: result.digest,
            contentHash,
            verificationResults,
            attestation: {
                type: "SUI_ECHO_TEE_VERIFICATION_V1",
                timestamp: new Date().toISOString(),
                verifier: keypair.getPublicKey().toSuiAddress(),
            },
        });

    } catch (err) {
        log('error', 'Verification error', {
            error: err.message,
            stack: err.stack,
            blobId: sanitizedBlobId,
        });

        // Return appropriate error based on type
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
            return res.status(504).json({ error: "Walrus fetch timeout" });
        }
        if (err.response?.status === 404) {
            return res.status(404).json({ error: "Content not found in Walrus" });
        }

        res.status(500).json({ error: "TEE verification failed", details: err.message });
    }
});

/**
 * Get verification status for a handout
 */
app.get('/status/:handoutId', async (req, res) => {
    const { handoutId } = req.params;

    if (!handoutId || typeof handoutId !== 'string') {
        return res.status(400).json({ error: "Invalid handoutId" });
    }

    try {
        const object = await client.getObject({
            id: handoutId,
            options: { showContent: true },
        });

        if (!object.data) {
            return res.status(404).json({ error: "Handout not found" });
        }

        const content = object.data.content;
        if (content?.dataType !== 'moveObject') {
            return res.status(400).json({ error: "Invalid object type" });
        }

        const fields = content.fields;
        res.json({
            handoutId,
            verified: fields?.verified || false,
            blobId: fields?.blob_id || null,
            uploader: fields?.uploader || null,
        });

    } catch (err) {
        log('error', 'Status check error', { error: err.message, handoutId });
        res.status(500).json({ error: "Failed to fetch handout status" });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    log('error', 'Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
    log('info', 'Server started', { port: PORT, network: SUI_NETWORK });
    console.log(`
🚀 Nautilus TEE Service running on port ${PORT}
   Network: ${SUI_NETWORK}
   RPC: ${SUI_RPC_URL}
   Package: ${PACKAGE_ID || 'NOT_CONFIGURED'}
   Admin Key: ${ADMIN_SECRET_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED'}
`);
});
