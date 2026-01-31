
const ms = require('/tmp/MoltSpeak/sdk/js/moltspeak.js');

const tests = [];

// Test 1: Parse NL in JS
const msg1 = ms.parseNaturalLanguage("Search for weather in Tokyo", {agent: "js-agent", org: "test"});
tests.push({
    name: "JS parse NL",
    op: msg1.op,
    domain: msg1.p?.domain,
    json: JSON.stringify(msg1)
});

// Test 2: Convert to NL in JS
const queryMsg = ms.createQuery(
    {domain: "weather", intent: "current", params: {city: "Tokyo"}},
    {agent: "alice", org: "acme"},
    {agent: "bob", org: "acme"}
);
const nl = ms.toNaturalLanguage(queryMsg);
tests.push({
    name: "JS to NL",
    description: nl
});

// Test 3: Parse task in JS
const taskMsg = ms.parseNaturalLanguage("please translate this text", {agent: "js-agent", org: "test"});
tests.push({
    name: "JS parse task",
    op: taskMsg.op,
    json: JSON.stringify(taskMsg)
});

// Test 4: Error to NL
const errorMsg = ms.createError(
    "msg-123",
    {code: "E_PARSE", category: "protocol", message: "Invalid format"},
    {agent: "server", org: "acme"},
    {agent: "client", org: "acme"}
);
const errorNl = ms.toNaturalLanguage(errorMsg);
tests.push({
    name: "JS error to NL",
    description: errorNl
});

console.log(JSON.stringify(tests, null, 2));
