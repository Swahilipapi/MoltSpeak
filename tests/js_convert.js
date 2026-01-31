
const ms = require('/tmp/MoltSpeak/sdk/js/moltspeak.js');
const msg = {"v": "0.1", "id": "5275b9b3-3faf-4629-81ec-eb59a5cc1ce6", "ts": 1769860018872, "op": "query", "cls": "int", "from": {"agent": "test-user", "org": "test-org"}, "to": {"agent": "unknown"}, "p": {"domain": "general", "intent": "information", "params": {"query": "stock prices"}}};
console.log(ms.toNaturalLanguage(msg));
