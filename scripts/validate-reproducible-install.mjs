import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

// Deliberately opt-in: this check downloads the already declared dependencies.
// It never installs in the source checkout and preserves its temporary evidence.
const source = await realpath(resolve(process.env.GB_REPRO_SOURCE ?? process.cwd()));
const runtimeRoot = resolve(dirname(process.execPath), '..', '..');
const pnpm = process.env.GB_PNPM ?? join(runtimeRoot, 'bin', 'fallback', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
const git = process.env.GB_GIT ?? 'git';
const auditBase = resolve(process.env.GB_REPRO_BASE ?? join(tmpdir(), 'gbmotion-repro'));
await mkdir(auditBase, {recursive: true});
const audit = await mkdtemp(join(auditBase, 'install-'));
const snapshot = join(audit, 'snapshot');
await mkdir(snapshot);
const report = {source, audit, snapshot, node: process.version, pnpmExecutable: pnpm, checks: []};
const digest = data => createHash('sha256').update(data).digest('hex');
const inside = (root, path) => {
  const part = relative(root, path);
  return part !== '' && !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`);
};
const run = (command, args, cwd, env = process.env) => {
  const result = spawnSync(command, args, {cwd, env, encoding:'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024});
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} exited ${result.status}`);
  return result.stdout.trim();
};
const gitRead = args => {
  const result = spawnSync(git, args, {cwd:source, encoding:'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const quoteCmd = value => {
  assert.ok(!/["&|<>^%!\r\n]/.test(value), 'Unsafe command-shell argument');
  return `"${value}"`;
};
const pnpmRun = (args, env) => process.platform === 'win32' && /\.(cmd|bat)$/i.test(pnpm)
  ? run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${[pnpm, ...args].map(quoteCmd).join(' ')}"`], snapshot, env)
  : run(pnpm, args, snapshot, env);

try {
  report.commit = gitRead(['rev-parse','HEAD']).trim();
  assert.equal(gitRead(['diff','--name-only','HEAD','--']).trim(), '', 'Commit source changes before running the clean-install check');
  const files = gitRead(['ls-files','-z']).split('\0').filter(Boolean).filter(path =>
    !/(^|\/)(node_modules|\.git|\.tmp|\.audit[^/]*|dist|media|exports)(\/|$)/.test(path) &&
    !/(^|\/)\.env(?:\.|$)/.test(path));
  for (const file of files) {
    const original = resolve(source, file);
    const destination = resolve(snapshot, file);
    assert.ok(inside(source, original) && inside(snapshot, destination), `Path escapes snapshot: ${file}`);
    const info = await stat(original);
    assert.ok(info.isFile(), `Only tracked regular files are copied: ${file}`);
    // Resolve source links as well: a tracked link cannot import another checkout.
    assert.ok(inside(source, await realpath(original)), `Tracked link escapes source: ${file}`);
    await mkdir(dirname(destination), {recursive:true});
    await copyFile(original, destination);
  }
  // A local workspace boundary prevents pnpm from finding a parent workspace.
  try { await stat(join(snapshot, 'pnpm-workspace.yaml')); }
  catch { await writeFile(join(snapshot,'pnpm-workspace.yaml'),'packages:\n  - .\n'); }
  report.copiedFiles = files.length;
  const manifest = JSON.parse(await readFile(join(snapshot,'package.json'),'utf8'));
  report.packageManagerDeclared = manifest.packageManager;
  const lockBefore = await readFile(join(snapshot,'pnpm-lock.yaml'));
  const sourceLockBefore = digest(await readFile(join(source,'pnpm-lock.yaml')));
  const env = {...process.env,
    PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
    pnpm_config_pm_on_fail:'ignore',
    pnpm_config_cache_dir:join(audit,'cache'),
    pnpm_config_state_dir:join(audit,'state'),
    pnpm_config_global_virtual_store:false,
  };
  const versionOutput = pnpmRun(['--version'], env);
  report.pnpmEffective = versionOutput.split(/\r?\n/).at(-1);
  pnpmRun(['install','--frozen-lockfile','--store-dir',join(audit,'store')], env);
  assert.equal(digest(await readFile(join(snapshot,'pnpm-lock.yaml'))), digest(lockBefore), 'Frozen installation changed the lockfile');
  assert.equal(digest(await readFile(join(source,'pnpm-lock.yaml'))), sourceLockBefore, 'Source lockfile changed');
  report.checks.push('fresh store and frozen lockfile');
  for (const [name, declared] of Object.entries({...manifest.dependencies, ...manifest.devDependencies})) {
    const installed = JSON.parse(await readFile(join(snapshot,'node_modules',name,'package.json'),'utf8'));
    assert.equal(installed.version, declared, `Version mismatch: ${name}`);
    assert.ok(inside(snapshot, await realpath(join(snapshot,'node_modules',name))), `Dependency escapes snapshot: ${name}`);
  }
  const manifestAfter = JSON.parse(await readFile(join(snapshot,'package.json'),'utf8'));
  for (const field of ['dependencies','devDependencies','packageManager']) assert.deepEqual(manifestAfter[field],manifest[field]);
  report.directPackages = Object.keys({...manifest.dependencies,...manifest.devDependencies}).length;
  report.checks.push('exact direct dependency versions and no external node_modules links');
  run(process.execPath,['node_modules/typescript/bin/tsc','-b','--pretty','false'],snapshot,env);
  run(process.execPath,['node_modules/vite/bin/vite.js','build'],snapshot,env);
  for (const path of ['dist/index.html','dist/editor/index.html','dist/404.html']) assert.ok((await stat(join(snapshot,path))).isFile(), `Missing MPA output: ${path}`);
  report.checks.push('fresh typecheck and three-page production build');
  for (const name of ['font-registry','motion-engine','editor','captions','server']) {
    run(process.execPath,['--experimental-strip-types',`scripts/validate-${name}.mjs`],snapshot,env);
    report.checks.push(`validate-${name}`);
  }
  report.status = 'PASS';
  await writeFile(join(audit,'report.json'), JSON.stringify(report,null,2));
  console.log(`REPRODUCIBLE_INSTALL_OK ${join(audit,'report.json')}`);
} catch (error) {
  report.status = 'FAIL';
  report.error = error instanceof Error ? error.message : String(error);
  await writeFile(join(audit,'report.json'),JSON.stringify(report,null,2));
  console.error(`REPRODUCIBLE_INSTALL_FAILED ${join(audit,'report.json')}\n${report.error}`);
  process.exitCode = 1;
}
