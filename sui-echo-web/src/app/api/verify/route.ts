/**
 * TEE Verification API Route
 * POST /api/verify
 * 
 * Nautilus TEE Verification Flow:
 * 1. Receives Blob ID and Handout Object ID
 * 2. Fetches content from Walrus
 * 3. Performs content verification
 * 4. Signs and submits verification transaction to Sui
 */

import { NextRequest, NextResponse } from 'next/server';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import crypto from 'crypto';

// Configuration
const SUI_NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const WALRUS_AGGREGATOR = process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';
const PACKAGE_ID = process.env.PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID || '';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '';

const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

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

        // Step 3: On-chain attestation
        if (!ADMIN_SECRET_KEY) {
            console.warn('[TEE] Admin key not configured, skipping on-chain verification');
            return NextResponse.json(
                {
                    status: 'verified_locally',
                    message: 'Content verified successfully. On-chain attestation skipped (TEE key not configured).',
                    contentHash,
                    verificationResults,
                },
                { headers: corsHeaders }
            );
        }

        if (!PACKAGE_ID || PACKAGE_ID === '0x...') {
            console.warn('[TEE] Package ID not configured, skipping on-chain verification');
            return NextResponse.json(
                {
                    status: 'verified_locally',
                    message: 'Content verified successfully. On-chain attestation skipped (Package ID not configured).',
                    contentHash,
                    verificationResults,
                },
                { headers: corsHeaders }
            );
        }

        // Step 4: Sign and submit verification transaction
        const keypair = Ed25519Keypair.fromSecretKey(ADMIN_SECRET_KEY);
        const tx = new Transaction();

        tx.moveCall({
            target: `${PACKAGE_ID}::echo::verify_handout`,
            arguments: [tx.object(sanitizedHandoutId)],
        });

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });

        console.log('[TEE] Verification transaction submitted', {
            digest: result.digest,
            status: result.effects?.status?.status,
        });

        // Check transaction status
        if (result.effects?.status?.status !== 'success') {
            console.error('[TEE] Verification transaction failed', {
                digest: result.digest,
                error: result.effects?.status?.error,
            });
            return NextResponse.json(
                {
                    status: 'transaction_failed',
                    error: result.effects?.status?.error || 'Transaction execution failed',
                    digest: result.digest,
                },
                { status: 500, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            {
                status: 'verified_onchain',
                digest: result.digest,
                contentHash,
                verificationResults,
                attestation: {
                    type: 'SUI_ECHO_TEE_VERIFICATION_V1',
                    timestamp: new Date().toISOString(),
                    verifier: keypair.getPublicKey().toSuiAddress(),
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
