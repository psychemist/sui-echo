module sui_echo::echo {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;

    // Errors
    const ENotCourseRep: u64 = 0;
    const ENotVerified: u64 = 1;
    const EAlreadyVerified: u64 = 2;
    const EInsufficientBalance: u64 = 3;

    // Events
    struct HandoutMinted has copy, drop {
        id: object::ID,
        uploader: address,
        blob_id: String,
    }

    struct HandoutVerified has copy, drop {
        id: object::ID,
        verified_by: address,
    }

    // Structs
    struct Handout has key, store {
        id: UID,
        blob_id: String,
        description: String,
        uploader: address,
        verified: bool 
    }

    struct CourseRepBroadcast has key, store {
        id: UID,
        course_code: String,
        audio_blob_id: String,
        message: String,
        verified_by: address, // The course rep
    }

    struct AlumniAjo has key {
        id: UID,
        pools: Table<String, Balance<SUI>>, // Course Code -> SUI Balance
    }

    fun init(ctx: &mut TxContext) {
        // Create the global Ajo pool
        transfer::share_object(AlumniAjo {
            id: object::new(ctx),
            pools: table::new(ctx),
        });
    }

    // --- Marketplace / Scan Logic ---
    public entry fun mint_handout(blob_id: vector<u8>, description: vector<u8>, ctx: &mut TxContext) {
        let handout_uid = object::new(ctx);
        let id = object::uid_to_inner(&handout_uid);
        let blob_id_str = string::utf8(blob_id);
        
        let handout = Handout {
            id: handout_uid,
            blob_id: blob_id_str,
            description: string::utf8(description),
            uploader: tx_context::sender(ctx),
            verified: false,
        };
        
        event::emit(HandoutMinted {
            id,
            uploader: tx_context::sender(ctx),
            blob_id: blob_id_str,
        });

        transfer::transfer(handout, tx_context::sender(ctx));
    }

    // Verification by TEE or Authorized Admin
    public entry fun verify_handout(handout: &mut Handout, ctx: &mut TxContext) {
        // In a real TEE flow, we would check the attestation here.
        // For MVP, we allow the caller to verify if they have the proper credentials (mocked for demo).
        assert!(!handout.verified, EAlreadyVerified);
        handout.verified = true;

        event::emit(HandoutVerified {
            id: object::uid_to_inner(&handout.id),
            verified_by: tx_context::sender(ctx),
        });
    }

    // Claim rewards from a course pool
    public entry fun claim_reward(
        ajo: &mut AlumniAjo,
        handout: &Handout,
        course_code: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(handout.verified, ENotVerified);
        let code_str = string::utf8(course_code);
        
        assert!(table::contains(&ajo.pools, code_str), EInsufficientBalance);
        let pool = table::borrow_mut(&mut ajo.pools, code_str);
        
        // Reward amount (example: 0.1 SUI)
        let reward_amount = 100000000; // 0.1 SUI in MIST
        assert!(balance::value(pool) >= reward_amount, EInsufficientBalance);
        
        let reward_balance = balance::split(pool, reward_amount);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        
        transfer::public_transfer(reward_coin, handout.uploader);
    }

    // --- Features: Course Rep Broadcast ---
    public entry fun broadcast(
        course_code: vector<u8>, 
        audio_blob_id: vector<u8>, 
        message: vector<u8>, 
        ctx: &mut TxContext
    ) {
        let broadcast = CourseRepBroadcast {
            id: object::new(ctx),
            course_code: string::utf8(course_code),
            audio_blob_id: string::utf8(audio_blob_id),
            message: string::utf8(message),
            verified_by: tx_context::sender(ctx),
        };
        transfer::transfer(broadcast, tx_context::sender(ctx));
    }

    // --- Features: Alumni Ajo ---
    public entry fun sponsor_course(
        ajo: &mut AlumniAjo, 
        course_code: vector<u8>, 
        payment: Coin<SUI>, 
        _ctx: &mut TxContext
    ) {
        let code_str = string::utf8(course_code);
        let balance = coin::into_balance(payment);

        if (table::contains(&ajo.pools, code_str)) {
            let pool = table::borrow_mut(&mut ajo.pools, code_str);
            balance::join(pool, balance);
        } else {
            table::add(&mut ajo.pools, code_str, balance);
        };
    }
}
