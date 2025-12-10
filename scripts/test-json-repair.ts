
import { safeParsePartialJson, repairJson } from "../lib/json-repair";

const testCases = [
    '{',
    '{\"type\": \"excalidraw\"',
    '{\"type\": \"excalidraw\", \"elements\": [',
    '{\"type\": \"excalidraw\", \"elements\": [{\"type\": \"rectangle\"',
    '{\"type\": \"excalidraw\", \"elements\": [{\"type\": \"rectangle\", \"x\": 10',
    '```json\n{\"type\": \"excalidraw\"',
];

console.log("Testing repairJson and safeParsePartialJson:");

testCases.forEach((input) => {
    console.log(`\nInput: ${input}`);
    const repaired = repairJson(input);
    console.log(`Repaired: ${repaired}`);
    const parsed = safeParsePartialJson(input);
    console.log(`Parsed:`, parsed);
});

