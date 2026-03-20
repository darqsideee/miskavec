// ============================================
// Build Script — Concatenates all source files
// into a single bundle.js wrapped in an IIFE
// ============================================
const fs = require('fs');
const path = require('path');

// Files in dependency order (dependencies first)
const sourceFiles = [
    // Utilities
    'src/utils/DOMHelpers.js',
    'src/utils/MathSolver.js',
    'src/utils/NetworkInterceptor.js',
    'src/utils/CanvasInterceptor.js',

    // Humanizer
    'src/humanizer/BezierMouse.js',
    'src/humanizer/Humanizer.js',

    // Core
    'src/core/DOMWatcher.js',
    'src/core/StateManager.js',
    'src/core/GameRouter.js',

    // Modules (base first)
    'src/modules/BaseModule.js',
    'src/modules/TextInputModule.js',
    'src/modules/ChoiceModule.js',
    'src/modules/PexesoModule.js',
    'src/modules/DragDropModule.js',

    // Orchestrator (last — depends on everything above)
    'src/core/UmimeSolver.js'
];

const rootDir = __dirname;

console.log('🔨 Building UmimeTo Solver bundle...\n');

let bundle = '';
bundle += '// ╔══════════════════════════════════════════════════╗\n';
bundle += '// ║  UmimeTo Solver v1.0                            ║\n';
bundle += '// ║  github.com/darqsideee/miskavec                 ║\n';
bundle += '// ║  Auto-generated bundle — do not edit directly    ║\n';
bundle += `// ║  Built: ${new Date().toISOString().slice(0, 19)}              ║\n`;
bundle += '// ╚══════════════════════════════════════════════════╝\n\n';
bundle += '(function() {\n';
bundle += '"use strict";\n\n';

let totalLines = 0;

for (const file of sourceFiles) {
    const filePath = path.join(rootDir, file);

    if (!fs.existsSync(filePath)) {
        console.error(`  ❌ File not found: ${file}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    totalLines += lines;

    bundle += `\n// ── ${file} ${'─'.repeat(Math.max(0, 50 - file.length))}──\n\n`;
    bundle += content;
    bundle += '\n';

    console.log(`  ✅ ${file} (${lines} lines)`);
}

bundle += '\n})();\n';

// Write output
const outputPath = path.join(rootDir, 'bundle.js');
fs.writeFileSync(outputPath, bundle, 'utf-8');

const sizeKB = (Buffer.byteLength(bundle, 'utf-8') / 1024).toFixed(1);
console.log(`\n🎉 Bundle created: bundle.js`);
console.log(`   Total: ${sourceFiles.length} files, ${totalLines} lines, ${sizeKB} KB`);
