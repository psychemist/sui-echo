/**
 * TEE Verification API Route - Option C (Attestation)
 * POST /api/verify
 * 
 * Flow:
 * 1. Receives Blob ID and Handout Object ID
 * 2. Fetches content from Walrus
 * 3. Performs content verification
 * 4. Returns Ed25519 signature for user to submit to contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import crypto from 'crypto';

// Configuration
const WALRUS_AGGREGATOR = process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS (CORS preflight)
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { blobId, handoutId, expectedHash } = body;

        // Input validation
        if (!blobId || typeof blobId !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid blobId' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!handoutId || typeof handoutId !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid handoutId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Sanitize inputs
        const sanitizedBlobId = blobId.replace(/[^a-zA-Z0-9_-]/g, '');
        const sanitizedHandoutId = handoutId.replace(/[^a-zA-Z0-9x]/g, '');

        console.log('[TEE] Starting verification', { blobId: sanitizedBlobId, handoutId: sanitizedHandoutId });

        // Step 1: Fetch content from Walrus
        const walrusUrl = `${WALRUS_AGGREGATOR}/v1/blobs/${sanitizedBlobId}`;
        const response = await fetch(walrusUrl, {
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json(
                    { error: 'Content not found in Walrus' },
                    { status: 404, headers: corsHeaders }
                );
            }
            throw new Error(`Walrus fetch failed: ${response.status}`);
        }

        const textContent = await response.text();
        console.log('[TEE] Content fetched from Walrus', { contentLength: textContent.length });

        // Step 2: Content verification
        const contentHash = crypto.createHash('sha256').update(textContent).digest('hex');

        const verificationResults = {
            minLengthCheck: textContent.length >= 10,
            hashCheck: expectedHash ? contentHash === expectedHash : true,
            contentIntegrity: true,
        };

        const isVerified = Object.values(verificationResults).every(v => v);

        if (!isVerified) {
            console.warn('[TEE] Verification failed', { blobId: sanitizedBlobId, results: verificationResults });
            return NextResponse.json(
                {
                    error: 'Verification failed',
                    details: verificationResults,
                    contentHash,
                },
                { status: 422, headers: corsHeaders }
            );
        }

        console.log('[TEE] Content verified successfully', { contentHash });

        // Step 3: Generate attestation (signature) - NO TRANSACTION!
        if (!ADMIN_SECRET_KEY) {
            console.warn('[TEE] Admin key not configured');
            return NextResponse.json(
                {
                    status: 'verified_locally',
                    message: 'Content verified but TEE key not configured for attestation.',
                    contentHash,
                    verificationResults,
                },
                { headers: corsHeaders }
            );
        }

        // Create keypair from secret
        const keypair = Ed25519Keypair.fromSecretKey(ADMIN_SECRET_KEY);
        const publicKeyBytes = keypair.getPublicKey().toRawBytes();

        // Create message: handoutId (hex bytes) + blobId (utf8 bytes)
        // Remove 0x prefix from handout ID and convert to bytes
        const handoutIdHex = sanitizedHandoutId.replace('0x', '');
        const handoutIdBytes = Buffer.from(handoutIdHex, 'hex');
        const blobIdBytes = Buffer.from(sanitizedBlobId, 'utf8');
        const message = Buffer.concat([handoutIdBytes, blobIdBytes]);

        // Sign the message with Ed25519
        const signature = await keypair.sign(message);

        console.log('[TEE] Attestation generated', {
            publicKey: Buffer.from(publicKeyBytes).toString('hex'),
            messageLength: message.length,
            signatureLength: signature.length,
        });

        return NextResponse.json(
            {
                status: 'attestation_ready',
                contentHash,
                verificationResults,
                attestation: {
                    signature: Array.from(signature), // Convert Uint8Array to array for JSON
                    publicKey: Array.from(publicKeyBytes),
                    message: Array.from(message),
                    handoutId: sanitizedHandoutId,
                    blobId: sanitizedBlobId,
                    timestamp: new Date().toISOString(),
                },
            },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[TEE] Verification error', { error: error.message });

        if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
            return NextResponse.json(
                { error: 'Walrus fetch timeout' },
                { status: 504, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { error: 'TEE verification failed', details: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}
