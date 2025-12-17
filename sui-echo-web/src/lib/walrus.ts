// lib/walrus.ts

export const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
export const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

export type WalrusBlob = {
  blobId: string;
  endEpoch: number;
  suiRefType: "CertifiedEffects";
};

/**
 * Uploads a file (Blob/Buffer) to Walrus
 */
export async function uploadToWalrus(file: Blob | File): Promise<string> {
  const response = await fetch(`${WALRUS_PUBLISHER}/v1/store`, {
    method: "PUT",
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to Walrus: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Depending on the exact Walrus API response format (it varies slightly in testnet updates)
  // Usually returns { newlyCreated: { blobObject: { blobId: "..." } } } or similar
  // For this implementation we'll assume a standard response structure or handle the known one.
  
  // Checking typical response:
  if (data.newlyCreated?.blobObject?.blobId) {
    return data.newlyCreated.blobObject.blobId;
  } else if (data.alreadyCertified?.blobId) {
    return data.alreadyCertified.blobId;
  }
  
  throw new Error("Invalid response from Walrus Publisher");
}

/**
 * Reads a blob from Walrus
 */
export function getWalrusUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/${blobId}`;
}
