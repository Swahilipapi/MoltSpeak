
const ms = require('/tmp/MoltSpeak/sdk/js/moltspeak.js');
const msg = ms.parseNaturalLanguage("do research on quantum computing", {agent: "js-agent", org: "test"});
console.log(JSON.stringify(msg));
