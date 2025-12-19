/**
 * Walrus Storage Utilities
 * Uses Walrus HTTP publisher/aggregator APIs for uploading and retrieving content
 */

import { WALRUS_AGGREGATOR, WALRUS_PUBLISHER } from "@/config";

/**
 * Uploads a file (Blob/Buffer) to Walrus using the HTTP publisher API
 * @param file - The file or blob to upload
 * @returns The blob ID for retrieval
 */
export async function uploadToWalrus(file: Blob | File): Promise<string> {
  try {
    // Get filename if available
    const filename = file instanceof File ? file.name : "upload.bin";

    console.log("[Walrus] Uploading via HTTP publisher...", {
      size: file.size,
      filename,
    });

    // Upload using the HTTP publisher API
    // epochs=5 means store for 5 epochs
    const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Publisher returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // The response can be either "newlyCreated" or "alreadyCertified"
    let blobId: string;
    if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
    } else if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
    } else {
      console.error("[Walrus] Unexpected response:", result);
      throw new Error("Unexpected response from Walrus publisher");
    }

    console.log("[Walrus] Upload successful:", blobId);
    return blobId;
  } catch (error: any) {
    console.error("[Walrus] Upload failed:", error);
    throw new Error(`Walrus upload failed: ${error.message}`);
  }
}

/**
 * Constructs the URL to read a blob from Walrus aggregator
 * @param blobId - The blob ID to retrieve
 * @returns The full URL to fetch the blob
 */
export function getWalrusUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

/**
 * Fetches content from Walrus
 * @param blobId - The blob ID to fetch
 * @returns The blob content as text
 */
export async function fetchFromWalrus(blobId: string): Promise<string> {
  const url = getWalrusUrl(blobId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch from Walrus: ${response.status}`);
  }

  return await response.text();
}

/**
 * Fetches binary content from Walrus
 * @param blobId - The blob ID to fetch
 * @returns The blob content as Uint8Array
 */
export async function fetchBinaryFromWalrus(blobId: string): Promise<Uint8Array> {
  const url = getWalrusUrl(blobId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch from Walrus: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
