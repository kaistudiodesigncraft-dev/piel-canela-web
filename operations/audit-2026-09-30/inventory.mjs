// Read-only import inventory. Next route conventions are explicit entrypoints.
// Candidates need human review; no source or asset is deleted by this script.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk(path.join(root, 'src')).filter(file => /\.(ts|tsx)$/.test(file));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const imports = new Map();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const linked = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = ts.resolveModuleName(node.moduleSpecifier.text, file, options, ts.sys).resolvedModule;
      if (resolved) linked.push(path.normalize(resolved.resolvedFileName));
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const resolved = ts.resolveModuleName(node.arguments[0].text, file, options, ts.sys).resolvedModule;
      if (resolved) linked.push(path.normalize(resolved.resolvedFileName));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  imports.set(file, linked);
}
const routeEntry = /^(page|layout|template|loading|error|global-error|not-found|default|route|robots|sitemap|manifest|icon|apple-icon|opengraph-image|twitter-image)\.(ts|tsx)$/;
const roots = files.filter(file => file.includes(`${path.sep}app${path.sep}`) && routeEntry.test(path.basename(file)) || /^(proxy|instrumentation|instrumentation-client)\.ts$/.test(path.basename(file)));
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of imports.get(file) ?? []) visit(dependency);
}
roots.forEach(visit);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
console.log(JSON.stringify({
  sourceFiles: files.length,
  routeEntrypoints: roots.length,
  runtimeUnreachableCandidates: files.filter(file => !reachable.has(file) && !file.includes('.test.') && !file.endsWith('.d.ts')).map(relative),
  largestSource: files.map(file => ({ path: relative(file), lines: fs.readFileSync(file, 'utf8').split('\n').length, bytes: fs.statSync(file).size })).sort((a,b) => b.bytes-a.bytes).slice(0,12),
  publicAssets: walk(path.join(root, 'public')).map(file => ({path:relative(file),bytes:fs.statSync(file).size})).sort((a,b)=>b.bytes-a.bytes).slice(0,10),
}, null, 2));
