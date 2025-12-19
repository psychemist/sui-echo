/**
 * Enoki Sponsored Transaction API Route
 * Uses private API key to sponsor and execute transactions for gasless UX
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnokiClient } from '@mysten/enoki';

// This must be a private/secret API key (not public)
const ENOKI_PRIVATE_KEY = process.env.NEXT_PUBLIC_ENOKI_PRIVATE_API_KEY;

export async function POST(request: NextRequest) {
    try {
        // Validate private key is configured
        if (!ENOKI_PRIVATE_KEY) {
            console.error('[Sponsor API] ENOKI_PRIVATE_API_KEY not configured');
            return NextResponse.json(
                { error: 'Sponsorship not configured' },
                { status: 500 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { transactionBytes, sender, signature } = body;

        // Initialize Enoki client with private key
        const enokiClient = new EnokiClient({
            apiKey: ENOKI_PRIVATE_KEY,
        });

        // If signature is provided, this is an execute request
        if (signature) {
            const executeResponse = await enokiClient.executeSponsoredTransaction({
                digest: body.digest,
                signature: signature,
            });

            return NextResponse.json({
                success: true,
                digest: executeResponse.digest,
            });
        }

        // Otherwise, this is a sponsor request
        if (!transactionBytes || !sender) {
            return NextResponse.json(
                { error: 'Missing transactionBytes or sender' },
                { status: 400 }
            );
        }

        // Sponsor the transaction (Enoki pays gas)
        console.log('[Sponsor API] Sponsoring transaction for:', sender);
        const sponsoredResponse = await enokiClient.createSponsoredTransaction({
            network: 'testnet',
            transactionKindBytes: transactionBytes,
            sender: sender,
            allowedMoveCallTargets: undefined, // Use dashboard config
            allowedAddresses: undefined, // Use dashboard config
        });

        console.log('[Sponsor API] Transaction sponsored successfully');

        return NextResponse.json({
            success: true,
            bytes: sponsoredResponse.bytes,
            digest: sponsoredResponse.digest,
        });
    } catch (error) {
        console.error('[Sponsor API] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Sponsorship failed: ${message}` },
            { status: 500 }
        );
    }
}
