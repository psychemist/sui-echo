"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider, useSuiClientContext } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import "@mysten/dapp-kit/dist/index.css";
import { registerEnokiWallets, isEnokiNetwork } from "@mysten/enoki";
import { GOOGLE_CLIENT_ID, ENOKI_API_KEY } from "@/config";

const { networkConfig } = createNetworkConfig({
    testnet: { url: getFullnodeUrl("testnet") },
    localnet: { url: getFullnodeUrl("localnet") },
    mainnet: { url: getFullnodeUrl("mainnet") },
});

// Component to register Enoki wallets with the wallet standard
function RegisterEnokiWallets() {
    const { client, network } = useSuiClientContext();

    useEffect(() => {
        // Only register if we have the required config
        if (!ENOKI_API_KEY || !GOOGLE_CLIENT_ID) {
            console.log("[Enoki] Skipping registration - missing API key or client ID");
            return;
        }

        // Only register on supported networks
        if (!isEnokiNetwork(network)) {
            console.log("[Enoki] Skipping registration - unsupported network:", network);
            return;
        }

        console.log("[Enoki] Registering wallets for network:", network);

        const { unregister } = registerEnokiWallets({
            apiKey: ENOKI_API_KEY,
            providers: {
                google: {
                    clientId: GOOGLE_CLIENT_ID,
                },
            },
            client,
            network,
        });

        return unregister;
    }, [client, network]);

    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
                <RegisterEnokiWallets />
                <WalletProvider autoConnect>
                    {children}
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}
