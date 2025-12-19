# Suiecho: Empowering Vision-Impaired Students through Sui

**Suiecho** is a decentralized educational accessibility platform built on the Sui blockchain. It bridges the gap for visually impaired students by converting physical and digital study materials into verified, accessible audio formats.

By leveraging Sui’s unique object-centric architecture, Suiecho ensures that educational content is not only accessible but also verifiable, rewarding, and easy to use for everyone—from students to lecturers.

# Architecture Overview
**Suiecho** integrates cutting-edge web3 primitives to create a seamless "web2-like" experience for a mission-driven use case.


graph TD
    User((User)) -->|OAuth| zkLogin[zkLogin / Enoki]
    zkLogin -->|Identity| FE[Next.js Frontend]
    FE -->|Blob Storage| Walrus[(Walrus Storage)]
    FE -->|OCR & TTS| TEE[TEE Content Verification]
    TEE -->|Verified Data| SC[Sui Move Smart Contracts]
    SC -->|Mint/Store| Objects[Sui Objects: Handouts & Audio]
    SC -->|Gasless| Sponsor[Sponsored Transactions]
    
# Sui Technology Stack
We chose Sui because it allows us to treat educational materials as programmable objects, providing a level of ownership and verification impossible on traditional platforms.

# zkLogin & Enoki
What it is: Passwordless authentication using Google accounts via zero-knowledge proofs.

Use Case: Students log in with their university Google account. No seed phrases or wallet extensions required.

Benefit: Removes the "crypto barrier," making the app accessible to non-technical students.

# Walrus Protocol
What it is: A decentralized storage network for large binary objects (blobs).

Use Case: Storing high-quality audio files (TTS output) and original document scans.

Benefit: Low-cost, permanent storage that ensures educational materials are never lost.

# Trusted Execution Environment (TEE)
What it is: A secure area of a main processor that guarantees code integrity.

Use Case: Verifies that the OCR (Text-to-Speech) process wasn't tampered with.

Benefit: Ensures the audio the student hears is a 1:1 match of the lecturer's original handout.

# Sponsored Transactions
What it is: A mechanism where a third party (Suiecho) pays the gas fees for the user.

Use Case: Students "mint" their audio handouts for free.

Benefit: Provides a completely gasless experience, making the blockchain invisible to the end user.

 # Key Features
Smart Document OCR: Scan physical handouts and convert them to text with high accuracy.

Verified Audio (TTS): Convert text to natural-sounding audio, stored on Walrus and verified via TEE.

Course Rep Broadcasts: Course representatives can broadcast verified audio notes to an entire department.

On-Chain Rewards: Students earn reputation and tokens for uploading and verifying accessible content.

Handout Ownership: Each study material is a Sui Object, allowing for clear provenance and version control.

# Project Structure
Plaintext

Suiecho/
├── sui-echo-move/          # Move Smart Contracts
│   └── sources/            # Core logic for Handouts, Rewards, and Verification
├── sui-echo-web/           # Next.js Frontend
│   ├── src/components/     # Sui dApp Kit integration & UI
│   ├── src/hooks/          # Enoki & zkLogin hooks
│   └── src/utils/          # Walrus & TEE integration logic
└── README.md
# Setup & Installation
Prerequisites
Sui CLI

Node.js (v18+)

Enoki API Key

1. Smart Contract Deployment
Bash

cd sui-echo-move
sui client publish --gas-budget 100000000
2. Frontend Setup
Bash

cd sui-echo-web
npm install
cp .env.example .env.local # Add your Enoki and Walrus keys
npm run dev
# Security & Privacy
Suiecho prioritizes student privacy. By using zkLogin, we verify that a user is a valid student without ever storing their private keys on our servers. Furthermore, sensitive document data is handled within TEEs, ensuring that even node operators cannot manipulate the content being converted for visually impaired users.

# Roadmap
Q1 2026: Integration with local University LMS (Canvas/Moodle).

Q2 2026: Multi-language TTS support for diverse student populations.

Q3 2026: DAO governance for curriculum verification.
