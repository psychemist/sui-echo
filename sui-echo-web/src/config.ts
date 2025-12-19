/**
 * Sui-Echo Configuration
 * Centralized environment variable validation and network configuration
 * 
 * NOTE: Next.js requires direct access to process.env.VARIABLE_NAME
 * Dynamic access like process.env[name] doesn't work because webpack
 * inlines environment variables at build time.
 */

// Network configuration
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

// Google OAuth - Direct access required for Next.js
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '';

// Smart Contract Package ID
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';

// TEE Worker URL
export const TEE_WORKER_URL = process.env.NEXT_PUBLIC_TEE_WORKER_URL || 'http://localhost:3001';

// ZK Prover Service URL
export const ZK_PROVER_URL = process.env.NEXT_PUBLIC_ZK_PROVER_URL || 'https://prover-dev.mystenlabs.com/v1';

// Enoki API Key (for production salt management)
export const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY || '';

// Sui RPC URLs
export const SUI_RPC_URLS = {
    testnet: 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
};

export const SUI_RPC_URL = SUI_RPC_URLS[SUI_NETWORK];

// Walrus Configuration
export const WALRUS_CONFIG = {
    testnet: {
        aggregator: 'https://aggregator.walrus-testnet.walrus.space',
        publisher: 'https://publisher.walrus-testnet.walrus.space',
    },
    mainnet: {
        aggregator: 'https://aggregator.walrus.walrus.space',
        publisher: 'https://publisher.walrus.walrus.space',
    },
};

export const WALRUS_AGGREGATOR = WALRUS_CONFIG[SUI_NETWORK === 'devnet' ? 'testnet' : SUI_NETWORK].aggregator;
export const WALRUS_PUBLISHER = WALRUS_CONFIG[SUI_NETWORK === 'devnet' ? 'testnet' : SUI_NETWORK].publisher;

// zkLogin Configuration
export const ZKLOGIN_CONFIG = {
    MAX_EPOCH_OFFSET: 2,
    KEY_CLAIM_NAME: 'sub',
};

// Redirect URI (computed at runtime in browser)
export const getRedirectUri = () => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/callback`;
    }
    return 'http://localhost:3000/callback';
};

// Validation helper - call this in components/pages after hydration
export function validateConfig(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!GOOGLE_CLIENT_ID) missing.push('NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID');

    return {
        valid: missing.length === 0,
        missing,
    };
}
