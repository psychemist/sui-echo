/**
 * Handout Status API Route
 * GET /api/status/[id]
 * 
 * Fetches verification status for a handout from the Sui blockchain
 */

import { NextRequest, NextResponse } from 'next/server';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Configuration
const SUI_NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS (CORS preflight)
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: handoutId } = await params;

        if (!handoutId || typeof handoutId !== 'string') {
            return NextResponse.json(
                { error: 'Invalid handoutId' },
                { status: 400, headers: corsHeaders }
            );
        }

        const object = await client.getObject({
            id: handoutId,
            options: { showContent: true },
        });

        if (!object.data) {
            return NextResponse.json(
                { error: 'Handout not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        const content = object.data.content;
        if (content?.dataType !== 'moveObject') {
            return NextResponse.json(
                { error: 'Invalid object type' },
                { status: 400, headers: corsHeaders }
            );
        }

        const fields = content.fields as Record<string, any>;

        return NextResponse.json(
            {
                handoutId,
                verified: fields?.verified || false,
                blobId: fields?.blob_id || null,
                uploader: fields?.uploader || null,
            },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[Status] Error fetching handout status', { error: error.message });
        return NextResponse.json(
            { error: 'Failed to fetch handout status' },
            { status: 500, headers: corsHeaders }
        );
    }
}
