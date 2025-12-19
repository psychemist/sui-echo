/**
 * Health Check API Route
 * GET /api/health
 */

import { NextResponse } from 'next/server';

const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const PACKAGE_ID = process.env.PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID || '';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '';

export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        version: '1.0.0',
        network: SUI_NETWORK,
        packageId: PACKAGE_ID ? `${PACKAGE_ID.slice(0, 10)}...` : 'NOT_CONFIGURED',
        adminKeyConfigured: !!ADMIN_SECRET_KEY,
    });
}
