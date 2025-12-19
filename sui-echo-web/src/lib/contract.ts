/**
 * Contract Configuration
 * Object IDs from deployed Sui-Echo contract
 * 
 * Update these after deploying to a different network
 */

// Package ID - from `sui client publish` output
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';

// Shared Objects - created during contract init
export const ALUMNI_AJO_ID = process.env.NEXT_PUBLIC_ALUMNI_AJO_ID || '';
export const COURSE_REP_REGISTRY_ID = process.env.NEXT_PUBLIC_COURSE_REP_REGISTRY_ID || '';
export const TEE_CONFIG_ID = process.env.NEXT_PUBLIC_TEE_CONFIG_ID || '';

// Admin Cap - owned by deployer (you)
export const ADMIN_CAP_ID = process.env.NEXT_PUBLIC_ADMIN_CAP_ID || '';

// Module name
export const MODULE_NAME = 'echo';

// Move function targets
export const TARGETS = {
    mint_handout: `${PACKAGE_ID}::${MODULE_NAME}::mint_handout`,
    verify_handout: `${PACKAGE_ID}::${MODULE_NAME}::verify_handout`,
    verify_handout_tee: `${PACKAGE_ID}::${MODULE_NAME}::verify_handout_tee`,
    verify_handout_admin: `${PACKAGE_ID}::${MODULE_NAME}::verify_handout_admin`,
    verify_with_attestation: `${PACKAGE_ID}::${MODULE_NAME}::verify_with_attestation`,
    set_tee_pubkey: `${PACKAGE_ID}::${MODULE_NAME}::set_tee_pubkey`,
    claim_reward: `${PACKAGE_ID}::${MODULE_NAME}::claim_reward`,
    broadcast: `${PACKAGE_ID}::${MODULE_NAME}::broadcast`,
    broadcast_verified: `${PACKAGE_ID}::${MODULE_NAME}::broadcast_verified`,
    apply_for_course_rep: `${PACKAGE_ID}::${MODULE_NAME}::apply_for_course_rep`,
    approve_course_rep: `${PACKAGE_ID}::${MODULE_NAME}::approve_course_rep`,
    reject_course_rep: `${PACKAGE_ID}::${MODULE_NAME}::reject_course_rep`,
    sponsor_course: `${PACKAGE_ID}::${MODULE_NAME}::sponsor_course`,
    create_tee_verifier: `${PACKAGE_ID}::${MODULE_NAME}::create_tee_verifier`,
};

// Type identifiers for querying objects
export const TYPES = {
    Handout: `${PACKAGE_ID}::${MODULE_NAME}::Handout`,
    CourseRepBroadcast: `${PACKAGE_ID}::${MODULE_NAME}::CourseRepBroadcast`,
    CourseRepApplication: `${PACKAGE_ID}::${MODULE_NAME}::CourseRepApplication`,
    CourseRepCap: `${PACKAGE_ID}::${MODULE_NAME}::CourseRepCap`,
    AdminCap: `${PACKAGE_ID}::${MODULE_NAME}::AdminCap`,
    TeeVerifierCap: `${PACKAGE_ID}::${MODULE_NAME}::TeeVerifierCap`,
    TeeConfig: `${PACKAGE_ID}::${MODULE_NAME}::TeeConfig`,
};

// Helper to check if contract is configured
export function isContractConfigured(): boolean {
    return !!PACKAGE_ID && PACKAGE_ID.startsWith('0x') && PACKAGE_ID.length > 10;
}
