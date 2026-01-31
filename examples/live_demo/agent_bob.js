#!/usr/bin/env node
/**
 * Agent Bob (JavaScript/Node.js) - Receives QUERY, sends RESPOND
 * 
 * This agent demonstrates:
 * 1. Reading messages from a file-based queue
 * 2. Validating and parsing MoltSpeak messages
 * 3. Creating a RESPOND message
 * 4. Writing the response to an inbox
 */

const fs = require('fs');
const path = require('path');

// Import MoltSpeak SDK
const moltspeak = require('../../sdk/js/moltspeak.js');

const {
    decode,
    encode,
    createResponse,
    validateMessage,
    toNaturalLanguage,
    verify,
    sign
} = moltspeak;

function main() {
    console.log('='.repeat(60));
    console.log('📦 AGENT BOB (JavaScript) - Starting up...');
    console.log('='.repeat(60));

    // Create Bob's identity
    const bob = {
        agent: 'bob-weather-service',
        org: 'weather-inc'
    };
    console.log(`\n✅ Created identity: ${bob.agent}@${bob.org}`);

    // Read the incoming message from outbox
    const outboxPath = path.join(__dirname, 'messages', 'outbox.json');
    
    if (!fs.existsSync(outboxPath)) {
        console.log('❌ No message found in outbox.json');
        process.exit(1);
    }

    const rawMessage = fs.readFileSync(outboxPath, 'utf8');
    console.log('\n📥 Reading message from: messages/outbox.json');

    // Decode and validate the message
    let queryMsg;
    try {
        queryMsg = decode(rawMessage, { validate: true });
        console.log('✅ Message decoded successfully');
    } catch (err) {
        console.log(`❌ Failed to decode message: ${err.message}`);
        process.exit(1);
    }

    // Validate the message
    const validation = validateMessage(queryMsg, { strict: true, checkPII: true });
    if (validation.valid) {
        console.log('✅ Message validation: PASSED');
    } else {
        console.log(`❌ Message validation FAILED: ${validation.errors.join(', ')}`);
        process.exit(1);
    }

    // Display received message info
    console.log(`\n📨 Received QUERY from: ${queryMsg.from.agent}@${queryMsg.from.org}`);
    console.log(`   Message ID: ${queryMsg.id}`);
    console.log(`   Operation: ${queryMsg.op}`);
    console.log(`   Domain: ${queryMsg.p.domain}`);
    console.log(`   Intent: ${queryMsg.p.intent}`);
    console.log(`   Location: ${queryMsg.p.params.location}`);

    // Convert to natural language
    const natural = toNaturalLanguage(queryMsg);
    console.log(`\n📝 Natural language: ${natural}`);

    // Process the weather query and create response
    const weatherData = {
        location: queryMsg.p.params.location,
        temperature: 18,
        units: queryMsg.p.params.units || 'celsius',
        conditions: 'Partly cloudy',
        humidity: 65,
        wind: {
            speed: 12,
            direction: 'SW'
        },
        forecast: 'Light rain expected in the evening'
    };

    // Create RESPOND message
    const responseMsg = createResponse(
        queryMsg.id,        // Reply to original message
        weatherData,        // Response data
        bob,                // From Bob
        queryMsg.from       // To Alice
    );

    console.log('\n📤 Creating RESPOND message:');
    console.log(`   Reply to ID: ${responseMsg.re}`);
    console.log(`   Operation: ${responseMsg.op}`);
    console.log(`   Status: ${responseMsg.p.status}`);

    // Validate response
    const respValidation = validateMessage(responseMsg, { strict: true, checkPII: true });
    if (respValidation.valid) {
        console.log('   ✅ Response validation: PASSED');
    } else {
        console.log(`   ❌ Response validation FAILED: ${respValidation.errors.join(', ')}`);
        process.exit(1);
    }

    // Sign the message (using placeholder signing)
    const signedResponse = sign(responseMsg, 'mock-private-key');
    console.log(`   🔏 Message signed: ${signedResponse.sig.substring(0, 30)}...`);

    // Write to inbox
    const inboxPath = path.join(__dirname, 'messages', 'inbox.json');
    fs.writeFileSync(inboxPath, encode(signedResponse, { pretty: true }));
    console.log('\n📤 Response written to: messages/inbox.json');

    // Show full response
    console.log('\n' + '='.repeat(60));
    console.log('Full response content:');
    console.log('='.repeat(60));
    console.log(encode(signedResponse, { pretty: true }));
    console.log('='.repeat(60));

    const respNatural = toNaturalLanguage(responseMsg);
    console.log(`\n📝 Natural language: ${respNatural}`);

    console.log('\n🏁 Bob finished responding. Message ready for Alice to receive.');
}

main();
