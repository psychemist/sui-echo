/// Sui-Echo Smart Contract
/// 
/// This module provides the core functionality for the Sui-Echo platform:
/// - Handout minting and verification
/// - Course rep broadcasts
/// - Alumni Ajo reward pools
/// - TEE-based verification authorization
/// - Course rep registration and verification

module sui_echo::echo {
    use std::string::{Self, String};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::dynamic_field;

    // ========== Error Codes ==========
    const ENotAuthorized: u64 = 0;
    const ENotVerified: u64 = 1;
    const EAlreadyVerified: u64 = 2;
    const EInsufficientBalance: u64 = 3;
    const EInvalidInput: u64 = 4;
    const EPoolNotFound: u64 = 5;
    const EAlreadyRegistered: u64 = 6;
    const ENotCourseRep: u64 = 8;

    // ========== Constants ==========
    const DEFAULT_REWARD_AMOUNT: u64 = 100_000_000; // 0.1 SUI
    const MIN_BLOB_ID_LENGTH: u64 = 10;

    // ========== Events ==========
    
    public struct HandoutMinted has copy, drop {
        id: object::ID,
        uploader: address,
        blob_id: String,
        timestamp: u64,
    }

    public struct HandoutVerified has copy, drop {
        id: object::ID,
        verified_by: address,
        verifier_type: String,
    }

    public struct RewardClaimed has copy, drop {
        handout_id: object::ID,
        recipient: address,
        amount: u64,
        course_code: String,
    }

    public struct BroadcastCreated has copy, drop {
        id: object::ID,
        course_code: String,
        broadcaster: address,
    }

    public struct CourseSponsored has copy, drop {
        course_code: String,
        sponsor: address,
        amount: u64,
    }

    public struct CourseRepApplicationSubmitted has copy, drop {
        application_id: object::ID,
        applicant: address,
        course_code: String,
        timestamp: u64,
    }

    public struct CourseRepApproved has copy, drop {
        rep_id: object::ID,
        applicant: address,
        course_code: String,
        approved_by: address,
    }

    public struct CourseRepRejected has copy, drop {
        application_id: object::ID,
        applicant: address,
        rejected_by: address,
        reason: String,
    }

    // ========== Capability Objects ==========

    public struct AdminCap has key, store {
        id: UID,
    }

    public struct TeeVerifierCap has key, store {
        id: UID,
        name: String,
    }

    public struct CourseRepCap has key, store {
        id: UID,
        course_code: String,
        rep_address: address,
        verified_by: address,
        verified_at: u64,
    }

    // ========== Core Objects ==========

    public struct Handout has key, store {
        id: UID,
        blob_id: String,
        description: String,
        uploader: address,
        verified: bool,
        verified_by: address,
        created_at: u64,
    }

    public struct CourseRepBroadcast has key, store {
        id: UID,
        course_code: String,
        audio_blob_id: String,
        message: String,
        broadcaster: address,
        created_at: u64,
    }

    public struct CourseRepApplication has key, store {
        id: UID,
        applicant: address,
        course_code: String,
        full_name: String,
        student_id: String,
        department: String,
        reason: String,
        created_at: u64,
    }

    public struct AlumniAjo has key {
        id: UID,
        pools: Table<String, Balance<SUI>>,
        reward_amount: u64,
        total_verified: u64,
        total_rewards_paid: u64,
    }

    public struct CourseRepRegistry has key {
        id: UID,
        pending_applications: Table<address, bool>,
        verified_reps: Table<address, String>,
    }

    // ========== Initialization ==========

    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap {
            id: object::new(ctx),
        }, tx_context::sender(ctx));

        transfer::share_object(AlumniAjo {
            id: object::new(ctx),
            pools: table::new(ctx),
            reward_amount: DEFAULT_REWARD_AMOUNT,
            total_verified: 0,
            total_rewards_paid: 0,
        });

        transfer::share_object(CourseRepRegistry {
            id: object::new(ctx),
            pending_applications: table::new(ctx),
            verified_reps: table::new(ctx),
        });
    }

    // ========== Admin Functions ==========

    public fun create_tee_verifier(
        _admin: &AdminCap,
        name: vector<u8>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        transfer::transfer(TeeVerifierCap {
            id: object::new(ctx),
            name: string::utf8(name),
        }, recipient);
    }

    public fun set_reward_amount(
        _admin: &AdminCap,
        ajo: &mut AlumniAjo,
        new_amount: u64,
        _ctx: &mut TxContext
    ) {
        ajo.reward_amount = new_amount;
    }

    // ========== Course Rep Registration ==========

    public fun apply_for_course_rep(
        registry: &mut CourseRepRegistry,
        course_code: vector<u8>,
        full_name: vector<u8>,
        student_id: vector<u8>,
        department: vector<u8>,
        reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&registry.verified_reps, sender), EAlreadyRegistered);
        assert!(!table::contains(&registry.pending_applications, sender), EAlreadyRegistered);

        let application_uid = object::new(ctx);
        let id = object::uid_to_inner(&application_uid);
        let code_str = string::utf8(course_code);
        let timestamp = tx_context::epoch_timestamp_ms(ctx);

        let application = CourseRepApplication {
            id: application_uid,
            applicant: sender,
            course_code: code_str,
            full_name: string::utf8(full_name),
            student_id: string::utf8(student_id),
            department: string::utf8(department),
            reason: string::utf8(reason),
            created_at: timestamp,
        };

        // Store in pending_applications table
        table::add(&mut registry.pending_applications, sender, true);
        
        // Store application as dynamic field on registry (keyed by applicant address)
        dynamic_field::add(&mut registry.id, sender, application);

        event::emit(CourseRepApplicationSubmitted {
            application_id: id,
            applicant: sender,
            course_code: code_str,
            timestamp,
        });
    }

    /// Admin approves a course rep application by applicant address
    public fun approve_course_rep(
        _admin: &AdminCap,
        registry: &mut CourseRepRegistry,
        applicant: address,
        ctx: &mut TxContext
    ) {
        // Get and remove application from dynamic field
        assert!(dynamic_field::exists_(&registry.id, applicant), ENotAuthorized);
        let application: CourseRepApplication = dynamic_field::remove(&mut registry.id, applicant);
        
        let CourseRepApplication { id, applicant: app_addr, course_code, full_name: _, student_id: _, department: _, reason: _, created_at: _ } = application;

        if (table::contains(&registry.pending_applications, app_addr)) {
            table::remove(&mut registry.pending_applications, app_addr);
        };

        if (!table::contains(&registry.verified_reps, app_addr)) {
            table::add(&mut registry.verified_reps, app_addr, course_code);
        };

        let rep_cap_uid = object::new(ctx);
        let rep_id = object::uid_to_inner(&rep_cap_uid);
        let approver = tx_context::sender(ctx);

        let rep_cap = CourseRepCap {
            id: rep_cap_uid,
            course_code,
            rep_address: app_addr,
            verified_by: approver,
            verified_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(CourseRepApproved {
            rep_id,
            applicant: app_addr,
            course_code,
            approved_by: approver,
        });

        transfer::transfer(rep_cap, app_addr);
        object::delete(id);
    }

    /// Admin rejects a course rep application by applicant address
    public fun reject_course_rep(
        _admin: &AdminCap,
        registry: &mut CourseRepRegistry,
        applicant: address,
        rejection_reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(dynamic_field::exists_(&registry.id, applicant), ENotAuthorized);
        let application: CourseRepApplication = dynamic_field::remove(&mut registry.id, applicant);
        
        let CourseRepApplication { id, applicant: app_addr, course_code: _, full_name: _, student_id: _, department: _, reason: _, created_at: _ } = application;

        if (table::contains(&registry.pending_applications, app_addr)) {
            table::remove(&mut registry.pending_applications, app_addr);
        };

        event::emit(CourseRepRejected {
            application_id: object::uid_to_inner(&id),
            applicant: app_addr,
            rejected_by: tx_context::sender(ctx),
            reason: string::utf8(rejection_reason),
        });

        object::delete(id);
    }

    public fun is_course_rep(registry: &CourseRepRegistry, addr: address): bool {
        table::contains(&registry.verified_reps, addr)
    }

    // ========== Handout Functions ==========

    public fun mint_handout(
        blob_id: vector<u8>,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&blob_id) >= MIN_BLOB_ID_LENGTH, EInvalidInput);
        
        let handout_uid = object::new(ctx);
        let id = object::uid_to_inner(&handout_uid);
        let blob_id_str = string::utf8(blob_id);
        let sender = tx_context::sender(ctx);
        let timestamp = tx_context::epoch_timestamp_ms(ctx);

        let handout = Handout {
            id: handout_uid,
            blob_id: blob_id_str,
            description: string::utf8(description),
            uploader: sender,
            verified: false,
            verified_by: @0x0,
            created_at: timestamp,
        };

        event::emit(HandoutMinted { id, uploader: sender, blob_id: blob_id_str, timestamp });
        transfer::transfer(handout, sender);
    }

    public fun verify_handout_tee(
        _verifier: &TeeVerifierCap,
        handout: &mut Handout,
        ajo: &mut AlumniAjo,
        ctx: &mut TxContext
    ) {
        assert!(!handout.verified, EAlreadyVerified);
        handout.verified = true;
        handout.verified_by = tx_context::sender(ctx);
        ajo.total_verified = ajo.total_verified + 1;

        event::emit(HandoutVerified {
            id: object::uid_to_inner(&handout.id),
            verified_by: tx_context::sender(ctx),
            verifier_type: string::utf8(b"TEE"),
        });
    }

    public fun verify_handout_admin(
        _admin: &AdminCap,
        handout: &mut Handout,
        ajo: &mut AlumniAjo,
        ctx: &mut TxContext
    ) {
        assert!(!handout.verified, EAlreadyVerified);
        handout.verified = true;
        handout.verified_by = tx_context::sender(ctx);
        ajo.total_verified = ajo.total_verified + 1;

        event::emit(HandoutVerified {
            id: object::uid_to_inner(&handout.id),
            verified_by: tx_context::sender(ctx),
            verifier_type: string::utf8(b"ADMIN"),
        });
    }

    public fun verify_handout_rep(
        rep: &CourseRepCap,
        handout: &mut Handout,
        ajo: &mut AlumniAjo,
        _ctx: &mut TxContext
    ) {
        assert!(!handout.verified, EAlreadyVerified);
        handout.verified = true;
        handout.verified_by = rep.rep_address;
        ajo.total_verified = ajo.total_verified + 1;

        event::emit(HandoutVerified {
            id: object::uid_to_inner(&handout.id),
            verified_by: rep.rep_address,
            verifier_type: string::utf8(b"COURSE_REP"),
        });
    }

    public fun verify_handout(handout: &mut Handout, ctx: &mut TxContext) {
        assert!(handout.uploader == tx_context::sender(ctx), ENotAuthorized);
        assert!(!handout.verified, EAlreadyVerified);
        handout.verified = true;
        handout.verified_by = tx_context::sender(ctx);

        event::emit(HandoutVerified {
            id: object::uid_to_inner(&handout.id),
            verified_by: tx_context::sender(ctx),
            verifier_type: string::utf8(b"SELF"),
        });
    }

    // ========== Reward Functions ==========

    public fun claim_reward(
        ajo: &mut AlumniAjo,
        handout: &Handout,
        course_code: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(handout.verified, ENotVerified);
        let code_str = string::utf8(course_code);
        assert!(table::contains(&ajo.pools, code_str), EPoolNotFound);
        
        let pool = table::borrow_mut(&mut ajo.pools, code_str);
        let reward_amount = ajo.reward_amount;
        assert!(balance::value(pool) >= reward_amount, EInsufficientBalance);
        
        let reward_balance = balance::split(pool, reward_amount);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        ajo.total_rewards_paid = ajo.total_rewards_paid + reward_amount;

        event::emit(RewardClaimed {
            handout_id: object::uid_to_inner(&handout.id),
            recipient: handout.uploader,
            amount: reward_amount,
            course_code: code_str,
        });

        transfer::public_transfer(reward_coin, handout.uploader);
    }

    // ========== Broadcast Functions ==========

    public fun broadcast_verified(
        rep: &CourseRepCap,
        audio_blob_id: vector<u8>,
        message: vector<u8>,
        ctx: &mut TxContext
    ) {
        let broadcast_uid = object::new(ctx);
        let id = object::uid_to_inner(&broadcast_uid);

        let broadcast_obj = CourseRepBroadcast {
            id: broadcast_uid,
            course_code: rep.course_code,
            audio_blob_id: string::utf8(audio_blob_id),
            message: string::utf8(message),
            broadcaster: rep.rep_address,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(BroadcastCreated { id, course_code: rep.course_code, broadcaster: rep.rep_address });
        transfer::transfer(broadcast_obj, rep.rep_address);
    }

    public fun broadcast(
        course_code: vector<u8>,
        audio_blob_id: vector<u8>,
        message: vector<u8>,
        ctx: &mut TxContext
    ) {
        let broadcast_uid = object::new(ctx);
        let id = object::uid_to_inner(&broadcast_uid);
        let code_str = string::utf8(course_code);
        let sender = tx_context::sender(ctx);

        let broadcast_obj = CourseRepBroadcast {
            id: broadcast_uid,
            course_code: code_str,
            audio_blob_id: string::utf8(audio_blob_id),
            message: string::utf8(message),
            broadcaster: sender,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(BroadcastCreated { id, course_code: code_str, broadcaster: sender });
        transfer::transfer(broadcast_obj, sender);
    }

    // ========== Sponsorship Functions ==========

    public fun sponsor_course(
        ajo: &mut AlumniAjo,
        course_code: vector<u8>,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let code_str = string::utf8(course_code);
        let amount = coin::value(&payment);
        let bal = coin::into_balance(payment);

        if (table::contains(&ajo.pools, code_str)) {
            balance::join(table::borrow_mut(&mut ajo.pools, code_str), bal);
        } else {
            table::add(&mut ajo.pools, code_str, bal);
        };

        event::emit(CourseSponsored { course_code: code_str, sponsor: tx_context::sender(ctx), amount });
    }

    // ========== View Functions ==========

    public fun get_pool_balance(ajo: &AlumniAjo, course_code: String): u64 {
        if (table::contains(&ajo.pools, course_code)) {
            balance::value(table::borrow(&ajo.pools, course_code))
        } else { 0 }
    }

    public fun get_total_verified(ajo: &AlumniAjo): u64 { ajo.total_verified }

    public fun get_total_rewards_paid(ajo: &AlumniAjo): u64 { ajo.total_rewards_paid }

    public fun get_reward_amount(ajo: &AlumniAjo): u64 { ajo.reward_amount }

    public fun is_verified(handout: &Handout): bool { handout.verified }
}
