const VALID_AI_CREDIT_OVERAGES = new Set(['never', 'always', 'default']);

function normalizeAiCreditOverages(rawValue) {
    const normalized = (rawValue || 'default').toString().trim().toLowerCase();
    return VALID_AI_CREDIT_OVERAGES.has(normalized) ? normalized : 'default';
}

export const aiCreditOverages = Object.freeze({
    mode: normalizeAiCreditOverages(process.env.AI_CREDIT_OVERAGES),
    forwarded: false,
    forwardingMode: 'visibility-only',
    note: 'No documented Antigravity per-request overages control is exposed by the currently observed internal APIs. The proxy surfaces the configured preference for visibility, but the account-level Antigravity setting remains authoritative.'
});

export function getAiCreditOveragesStatus() {
    return { ...aiCreditOverages };
}
