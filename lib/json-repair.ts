export function repairJson(jsonStr: string): string {
    if (!jsonStr) return "{}";
    const trimmed = jsonStr.trim();
    if (trimmed.endsWith("}")) return trimmed; // Assumption: complete

    // Simple heuristic stack to close braces/brackets
    // improved version could handle strings, but for now we assume structure
    let stack: string[] = [];
    let isString = false;
    let isEscaped = false;

    for (const char of trimmed) {
        if (isString) {
            if (char === '"' && !isEscaped) {
                isString = false;
            } else if (char === '\\') {
                isEscaped = !isEscaped;
            } else {
                isEscaped = false;
            }
        } else {
            if (char === '"') {
                isString = true;
            } else if (char === '{') {
                stack.push('}');
            } else if (char === '[') {
                stack.push(']');
            } else if (char === '}') {
                if (stack[stack.length - 1] === '}') stack.pop();
            } else if (char === ']') {
                if (stack[stack.length - 1] === ']') stack.pop();
            }
        }
    }

    let completion = "";
    if (isString) completion += '"'; // Close open string
    while (stack.length > 0) {
        completion += stack.pop();
    }

    return trimmed + completion;
}

export function safeParsePartialJson(jsonStr: string): any {
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        try {
            const repaired = repairJson(jsonStr);
            return JSON.parse(repaired);
        } catch (e2) {
            return null; // giving up
        }
    }
}
