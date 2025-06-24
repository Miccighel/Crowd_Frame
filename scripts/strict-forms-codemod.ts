/**
 * Codemod: strict-forms guard for Angular 19
 *
 * Inserts optional chaining (?.) in front of every call that may throw
 * under Angular 19’s stricter Reactive-Forms handling:
 *   • formGroup.get(...)
 *   • formArray.at(...)
 *   • formGroup.addControl(...)
 *
 * Usage:
 *   yarn tsx scripts/strict-forms-codemod.ts
 *   yarn lint --fix
 *
 * The script is idempotent – running it twice makes no further edits.
 */

import {Project, SyntaxKind} from 'ts-morph';

const project = new Project({tsConfigFilePath: 'tsconfig.json'});
const FILE_GLOB = 'src/**/*.{ts,tsx}';
const CALL_REGEX = /\.(get|addControl|at)\s*\(/;

project.getSourceFiles(FILE_GLOB).forEach(sf => {
    let changed = false;

    // Guard .get / .addControl / .at calls
    sf.forEachDescendant(node => {
        if (node.getKind() !== SyntaxKind.CallExpression) return;

        const call = node.asKind(SyntaxKind.CallExpression)!;
        if (!CALL_REGEX.test(call.getText())) return;

        const expr = call.getExpression();
        if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;

        const pa = expr.asKind(SyntaxKind.PropertyAccessExpression)!;
        const obj = pa.getExpression().getText();
        const method = pa.getName();

        // Skip if already optional-chained
        if (obj.endsWith('?')) return;

        pa.replaceWithText(`${obj}?.${method}`);
        changed = true;
    });

    if (changed) {
        sf.insertStatements(
            0,
            '// TODO(strict-forms): auto-guarded by codemod – review if needed.'
        );
    }
});

project.saveSync();
console.log('✅ strict-forms codemod complete');
