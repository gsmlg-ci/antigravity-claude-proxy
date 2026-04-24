/**
 * Model Aliases Module
 *
 * Provides custom model alias support via the MODEL_ALIASES environment variable.
 * Aliases are resolved transparently before requests reach the upstream proxy logic,
 * so every Anthropic-compatible endpoint (/v1/messages, /v1/chat/completions, etc.)
 * benefits automatically.
 *
 * Format:  MODEL_ALIASES='{"short-name":"real-model-id", ...}'
 *
 * The module is intentionally stateless and side-effect-free at import time so it
 * can be safely imported from both server.js and index.js.
 */

import { logger } from './utils/logger.js';

// ---------------------------------------------------------------------------
// Parse aliases from environment
// ---------------------------------------------------------------------------

let aliases = {};

/**
 * (Re-)load aliases from the MODEL_ALIASES environment variable.
 * Called once at startup and can be called again at runtime if needed.
 */
export function loadAliases() {
    const raw = process.env.MODEL_ALIASES;
    if (!raw) {
        aliases = {};
        return;
    }

    try {
        const parsed = JSON.parse(raw);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new TypeError('MODEL_ALIASES must be a JSON object (key-value pairs)');
        }

        // Validate: every key and value must be a non-empty string
        for (const [alias, target] of Object.entries(parsed)) {
            if (typeof alias !== 'string' || typeof target !== 'string') {
                throw new TypeError(`Invalid alias entry: "${alias}" -> "${target}" (both must be strings)`);
            }
            if (!alias.trim() || !target.trim()) {
                throw new TypeError(`Empty alias or target in MODEL_ALIASES: "${alias}" -> "${target}"`);
            }
        }

        aliases = { ...parsed };
        const count = Object.keys(aliases).length;
        if (count > 0) {
            logger.info(`[ModelAliases] Loaded ${count} alias(es):`);
            for (const [alias, target] of Object.entries(aliases)) {
                logger.info(`  ${alias}  →  ${target}`);
            }
        }
    } catch (err) {
        logger.error(`[ModelAliases] Failed to parse MODEL_ALIASES: ${err.message}`);
        logger.error('[ModelAliases] Aliases will NOT be active. Fix the JSON and restart.');
        aliases = {};
    }
}

// Initial load
loadAliases();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an alias to its target model name.
 * Returns the original name unchanged if it is not an alias.
 *
 * @param {string} modelName - The model name from the incoming request
 * @returns {string} The resolved (real) model name
 */
export function resolveAlias(modelName) {
    if (!modelName || typeof modelName !== 'string') return modelName;
    const target = aliases[modelName];
    if (target) {
        logger.info(`[ModelAliases] Resolving alias "${modelName}" → "${target}"`);
        return target;
    }
    return modelName;
}

/**
 * Get the full alias map (read-only copy).
 * @returns {Record<string, string>}
 */
export function getAliases() {
    return { ...aliases };
}

/**
 * Check whether any aliases are configured.
 * @returns {boolean}
 */
export function hasAliases() {
    return Object.keys(aliases).length > 0;
}

/**
 * Augment an OpenAI-compatible /v1/models response with alias entries.
 * Each alias is added as an additional model object whose `id` is the alias
 * name and which carries extra metadata so clients can distinguish aliases
 * from real models.
 *
 * @param {object} modelsResponse - The original response from listModels()
 * @returns {object} The augmented response
 */
export function augmentModelsResponse(modelsResponse) {
    if (!hasAliases()) return modelsResponse;

    // Ensure we don't mutate the original object
    const augmented = JSON.parse(JSON.stringify(modelsResponse));

    // modelsResponse.data is the array of model objects (OpenAI format)
    if (!Array.isArray(augmented.data)) return augmented;

    // Build a Set of existing model IDs for quick lookup
    const existingIds = new Set(augmented.data.map((m) => m.id));

    for (const [alias, target] of Object.entries(aliases)) {
        // Don't add if there's already a model with the alias name
        if (existingIds.has(alias)) continue;

        augmented.data.push({
            id: alias,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'alias',
            // Extra metadata
            alias_target: target,
        });
    }

    return augmented;
}

/**
 * Express middleware that resolves model aliases in request bodies.
 * Works for any JSON POST/PUT/PATCH that includes a top-level `model` field.
 * Must be mounted AFTER express.json() but BEFORE route handlers.
 */
export function modelAliasMiddleware(req, _res, next) {
    if (!hasAliases()) return next();

    // Only act on requests that carry a parsed JSON body with a model field
    if (req.body && typeof req.body.model === 'string') {
        const resolved = resolveAlias(req.body.model);
        if (resolved !== req.body.model) {
            // Stash the original for logging / debugging
            req._originalModel = req.body.model;
            req.body.model = resolved;
        }
    }

    next();
}
