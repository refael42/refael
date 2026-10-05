import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Guard for a crash only phones have: code that runs on the UI thread (a 'worklet', or a
// callback Reanimated runs there) may only call other worklets. Calling a plain function from
// there closes the app with no error at all, while the browser runs it fine (one thread). This
// reads the source and lists every such call to one of our own functions.

const ROOT = path.resolve(__dirname, '..');
/** Reanimated hooks whose function arguments run on the UI thread. */
const UI_HOOKS = new Set(['useAnimatedStyle', 'useAnimatedReaction', 'useDerivedValue', 'useAnimatedProps', 'useFrameCallback']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

type Fn = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
const isFn = (n: ts.Node): n is Fn => ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);

function isWorklet(fn: Fn): boolean {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'worklet';
}

interface Module {
  sf: ts.SourceFile;
  /** Top-level functions by name: whether each is a worklet. */
  fns: Map<string, boolean>;
  /** Imported name -> [file it comes from, its name there] (our own files only). */
  imports: Map<string, [string, string]>;
}

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}

function load(file: string): Module {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const fns = new Map<string, boolean>();
  const imports = new Map<string, [string, string]>();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) fns.set(st.name.text, isWorklet(st));
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && isFn(d.initializer)) fns.set(d.name.text, isWorklet(d.initializer));
      }
    }
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      const target = resolve(file, st.moduleSpecifier.text);
      if (!target) continue;
      for (const el of st.importClause.namedBindings.elements) imports.set(el.name.text, [target, (el.propertyName ?? el.name).text]);
    }
  }
  return { sf, fns, imports };
}

function uiThreadCallsToPlainFunctions(): string[] {
  const files = sourceFiles(path.join(ROOT, 'src'));
  const modules = new Map(files.map((f) => [f, load(f)]));
  const problems: string[] = [];
  for (const [file, mod] of modules) {
    const check = (fn: Fn) => {
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
          const name = n.expression.text;
          let worklet = mod.fns.get(name);
          const imported = mod.imports.get(name);
          if (worklet === undefined && imported) worklet = modules.get(imported[0])?.fns.get(imported[1]);
          if (worklet === false) {
            const { line } = mod.sf.getLineAndCharacterOfPosition(n.getStart());
            problems.push(`${path.relative(ROOT, file)}:${line + 1} calls ${name}() from the UI thread`);
          }
        }
        ts.forEachChild(n, visit);
      };
      if (fn.body) visit(fn.body);
    };
    const walk = (n: ts.Node) => {
      if (isFn(n) && isWorklet(n)) check(n);
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && UI_HOOKS.has(n.expression.text)) {
        for (const arg of n.arguments) if (isFn(arg)) check(arg);
      }
      ts.forEachChild(n, walk);
    };
    walk(mod.sf);
  }
  return problems;
}

describe('UI-thread code', () => {
  it('only calls worklets (a plain function there closes the app on phones)', () => {
    expect(uiThreadCallsToPlainFunctions()).toEqual([]);
  });
});
