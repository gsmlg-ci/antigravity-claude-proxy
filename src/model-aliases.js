import { logger } from './utils/logger.js';

function parseModelAliases(rawValue) {
    if (!rawValue) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            logger.warn('[ModelAliases] MODEL_ALIASES must be a JSON object. Ignoring value.');
            return {};
        }

        const aliases = {};
        for (const [alias, target] of Object.entries(parsed)) {
            if (typeof alias !== 'string' || typeof target !== 'string') {
                logger.warn('[ModelAliases] Skipping non-string alias mapping.');
                continue;
            }

            const normalizedAlias = alias.trim();
            const normalizedTarget = target.trim();

            if (!normalizedAlias || !normalizedTarget) {
                logger.warn('[ModelAliases] Skipping empty alias mapping.');
                continue;
            }

            aliases[normalizedAlias] = normalizedTarget;
        }

        return aliases;
    } catch (error) {
        logger.warn(`[ModelAliases] Failed to parse MODEL_ALIASES JSON: ${error.message}`);
        return {};
    }
}

export const modelAliases = Object.freeze(parseModelAliases(process.env.MODEL_ALIASES));

export function hasModelAliases() {
    return Object.keys(modelAliases).length > 0;
}

export function getModelAliases() {
    return { ...modelAliases };
}

export function resolveModelAlias(model) {
    if (typeof model !== 'string' || !model) {
        return model;
    }

    let current = model;
    const visited = new Set();

    while (modelAliases[current] && !visited.has(current)) {
        visited.add(current);
        current = modelAliases[current];
    }

    if (modelAliases[current]) {
        logger.warn(`[ModelAliases] Detected alias loop while resolving "${model}". Using original value.`);
        return model;
    }

    return current;
}

export function maybeRewriteRequestModel(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.model !== 'string') {
        return null;
    }

    const originalModel = body.model;
    const resolvedModel = resolveModelAlias(originalModel);

    if (originalModel === resolvedModel) {
        return null;
    }

    body.model = resolvedModel;
    return { originalModel, resolvedModel };
}

export function appendAliasModels(modelList) {
    if (!Array.isArray(modelList) || !hasModelAliases()) {
        return modelList;
    }

    const byId = new Map(modelList.map((model) => [model.id, model]));
    const aliasModels = [];

    for (const [alias, target] of Object.entries(modelAliases)) {
        if (byId.has(alias)) {
            continue;
        }

        const resolvedTarget = resolveModelAlias(target);
        const targetModel = byId.get(resolvedTarget);
        if (!targetModel) {
            continue;
        }

        aliasModels.push({
            ...targetModel,
            id: alias,
            owned_by: 'alias',
            description: `${targetModel.description || resolvedTarget} (alias for ${resolvedTarget})`,
            alias_target: resolvedTarget
        });
    }

    return [...modelList, ...aliasModels];
}

export function appendAliasModelIds(modelIds) {
    if (!Array.isArray(modelIds) || !hasModelAliases()) {
        return modelIds;
    }

    const ids = [...modelIds];
    const existing = new Set(modelIds);

    for (const [alias, target] of Object.entries(modelAliases)) {
        const resolvedTarget = resolveModelAlias(target);
        if (existing.has(alias) || !existing.has(resolvedTarget)) {
            continue;
        }

        ids.push(alias);
        existing.add(alias);
    }

    return ids;
}

export function appendAliasLimits(limitsByModel) {
    if (!limitsByModel || typeof limitsByModel !== 'object' || Array.isArray(limitsByModel) || !hasModelAliases()) {
        return limitsByModel;
    }

    const expanded = { ...limitsByModel };

    for (const [alias, target] of Object.entries(modelAliases)) {
        const resolvedTarget = resolveModelAlias(target);
        if (expanded[alias] || !expanded[resolvedTarget]) {
            continue;
        }

        expanded[alias] = {
            ...expanded[resolvedTarget],
            aliasTarget: resolvedTarget
        };
    }

    return expanded;
}
