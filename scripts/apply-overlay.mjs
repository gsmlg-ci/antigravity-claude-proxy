import fs from 'node:fs';
import path from 'node:path';

const upstreamRoot = process.argv[2];

if (!upstreamRoot) {
    throw new Error('Usage: node scripts/apply-overlay.mjs <upstream-dir>');
}

function replaceOnce(source, search, replacement, label) {
    if (!source.includes(search)) {
        throw new Error(`Could not find patch target for ${label}`);
    }
    return source.replace(search, replacement);
}

function writePatchedFile(filePath, transform) {
    const original = fs.readFileSync(filePath, 'utf8');
    const patched = transform(original);
    fs.writeFileSync(filePath, patched, 'utf8');
}

const overlayModelAliases = path.resolve('overlay/src/model-aliases.js');
const upstreamModelAliases = path.join(upstreamRoot, 'src/model-aliases.js');
const upstreamServer = path.join(upstreamRoot, 'src/server.js');
const upstreamModelApi = path.join(upstreamRoot, 'src/cloudcode/model-api.js');

fs.mkdirSync(path.dirname(upstreamModelAliases), { recursive: true });
fs.copyFileSync(overlayModelAliases, upstreamModelAliases);

writePatchedFile(upstreamServer, (source) => {
    let patched = source;

    patched = replaceOnce(
        patched,
        "import usageStats from './modules/usage-stats.js';",
        "import usageStats from './modules/usage-stats.js';\nimport { maybeRewriteRequestModel } from './model-aliases.js';",
        'server import'
    );

    patched = replaceOnce(
        patched,
        "    next();\n});\n\n// Setup usage statistics middleware",
        "    next();\n});\n\n// Rewrite model aliases for all JSON-based /v1 requests before route handlers run.\napp.use('/v1', (req, res, next) => {\n    const rewrite = maybeRewriteRequestModel(req.body);\n    if (rewrite) {\n        logger.info(`[ModelAliases] Rewriting model ${rewrite.originalModel} -> ${rewrite.resolvedModel}`);\n    }\n    next();\n});\n\n// Setup usage statistics middleware",
        'server middleware'
    );

    return patched;
});

writePatchedFile(upstreamModelApi, (source) => {
    let patched = source;

    patched = replaceOnce(
        patched,
        "import { logger } from '../utils/logger.js';",
        "import { appendAliasModels } from '../model-aliases.js';\nimport { logger } from '../utils/logger.js';",
        'model api import'
    );

    patched = replaceOnce(
        patched,
        "    // Warm the model validation cache\n    modelCache.validModels = new Set(modelList.map(m => m.id));\n    modelCache.lastFetched = Date.now();\n\n    return {\n        object: 'list',\n        data: modelList\n    };",
        "    const expandedModelList = appendAliasModels(modelList);\n\n    // Warm the model validation cache\n    modelCache.validModels = new Set(expandedModelList.map(m => m.id));\n    modelCache.lastFetched = Date.now();\n\n    return {\n        object: 'list',\n        data: expandedModelList\n    };",
        'model api list response'
    );

    return patched;
});
