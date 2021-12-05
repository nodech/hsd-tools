/*!
 * fmt.js - format some things.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const colors = require('./colors');
const util = require('./util');
const fmt = exports;

fmt.NO = colors.redText('X');
fmt.YES = colors.greenText('Y');

/**
 * Format red if check passes.
 * @param {String|Number} text
 * @param {Function} check
 * @returns {String}
 */

fmt.redIf = (text, check) => {
  if (check(text))
    return colors.redText(text);

  return text;
};

/**
 * Format green if check passes.
 * @param {String|Number} text
 * @param {Function} check
 * @returns {String}
 */

fmt.greenIf = (text, check) => {
  if (check(text))
    return colors.greenText(text);

  return text;
};

/**
 * Format green if check passes, otherwise red.
 * @param {String|Number} text
 * @param {Function} check
 * @returns {String}
 */

fmt.greenRed = (text, check) => {
  if (check(text))
    return colors.greenText(text);

  return colors.redText(text);
};

/**
 * Format package info.
 * @param {PackagesInfo} pkgInfo
 * @param {DependencyInfo} deps
 * @param {Object} options
 * @returns {String}
 */

fmt.formatInfo = (pkgInfo, deps, options) => {
  let formatted = '';

  const {gitInfo, npmInfo} = pkgInfo;

  formatted += 'Package information for ${name}:\n';

  {
    const gitLatest = gitInfo.latest;
    const npmLatest = npmInfo.latest;

    const fmtGitLatest = colors.greenText(gitLatest);
    const fmtNPMLatest = fmt.greenRed(npmLatest,
      () => gitLatest === npmLatest);

    formatted += `  Latest - git: ${fmtGitLatest}, npm: ${fmtNPMLatest}\n\n`;
  }

  formatted += fmt.formatDepsSummary(pkgInfo, deps) + '\n';

  if (options.versions)
    formatted += fmt.formatVersions(gitInfo.versions, npmInfo.versions);

  return formatted;
};

/**
 * Print versions table for the package.
 * @param {Map} gitVersions
 * @param {Map} npmVersions
 * @returns {String}
 */

fmt.formatVersions = (gitVersions, npmVersions) => {
  const gversions = new Set(gitVersions.keys());
  const nversions = new Set(npmVersions.keys());
  const all = Array.from(new Set([...gversions, ...nversions]));

  const sorted = util.sortSemver(all);

  let formatted = 'Versions:\n';

  for (const version of sorted) {
    const git = gversions.has(version);
    const npm = nversions.has(version);
    formatted += `  v${version} - `
      + `git: ${git ? fmt.YES : fmt.NO}, `
      + `npm: ${npm ? fmt.YES : fmt.NO}\n`;
  }

  return formatted;
};

/**
 * Return dependencies summary
 * @param {PackagesInfo} pkginfo
 * @param {DependencyInfo} depinfo
 * @returns {String}
 */

fmt.formatDepsSummary = (pkginfo, depinfo) => {
  let formatted = '';

  const format = ({deps, git, npm}) => {
    const allDeps = fmt.greenRed(deps, v => v === git);
    const gitDeps = fmt.greenIf(git, v => v !== 0);
    const npmDeps = fmt.redIf(npm, v => v !== 0);

    return `all: ${allDeps}, git: ${gitDeps}, npm: ${npmDeps}`;
  };

  const name = pkginfo.name;

  const deps = depinfo.dependencies.get(name);
  const devDeps = depinfo.devDependencies.get(name);
  const dependents = depinfo.dependents.get(name);
  const devDependents = depinfo.devDependents.get(name);

  const fmtDeps = format({
    deps: deps,
    git: depinfo.gitDependencies.get(name),
    npm: depinfo.npmDependencies.get(name)
  });

  formatted += `Dependencies:  ${fmtDeps}\n`;

  const fmtDevDeps = format({
    deps: devDeps,
    git: depinfo.gitDevDependencies.get(name),
    npm: depinfo.npmDevDependencies.get(name)
  });

  formatted += `Dev deps:      ${fmtDevDeps}\n`;

  const fmtDependents = format({
    deps: dependents || 0,
    git: depinfo.gitDependents.get(name) || 0,
    npm: depinfo.npmDependents.get(name) || 0
  });

  formatted += `Dependents:    ${fmtDependents}\n`;

  const fmtDevDependents = format({
    deps: devDependents || 0,
    git: depinfo.gitDevDependents.get(name) || 0,
    npm: depinfo.npmDevDependents.get(name) || 0
  });

  formatted += `DevDependents: ${fmtDevDependents}\n`;

  return formatted;
};
