/*!
 * commands/prlog.js - Log commits groupd by PRs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const fs = require('bfile');
const path = require('path');
const {Command} = require('./command');
const {NPMAPI, GithubAPI} = require('../api');
const {Semaphore} = require('../utils/semaphore');
const util = require('../utils/util');
const semver = require('../../vendor/semver');
const colors = require('../utils/colors');

const TASK_GATHER_NPM_DATA = 'Gather version information from npm.';
const TASK_GATHER_GITHUB_DATA = 'Gather version information from github.';
const TASK_GATHER_GITHUB_MASTERS = 'Gather master refs from github.';
const TASK_GATHER_GITHUB_LATESTS = 'Gather latest tag references';

const STEP_GET_PKG_INFO = pkg => `Get npm info for ${pkg}.`;
const STEP_GET_GITHUB_INFO = pkg => `get github info for ${pkg}.`;
const STEP_GET_GITHUB_MASTER = pkg => `get github master ref for ${pkg}.`;
const STEP_GET_GITHUB_LATEST = pkg => `get latest version refs for ${pkg}.`;

const GIT_REPO_REGEX = /^git(?:\+ssh)?:\/\/([^\/]+)\/([^\/]+)\/(.*?)(.git)?$/;

class DependencyCheck extends Command {
  constructor(options) {
    super(options);

    this.options = options;
    this.cache = options.cache;
    this.ghuser = options.ghuser;
    this.ghkey = options.ghkey;
    this.ghconc = options.ghconc;
    this.npmconc = options.npmconc;
    this.cwd = options.cwd;

    this.githubAPI = new GithubAPI({
      Error: this.Error,
      cache: this.cache,
      cwd: this.cwd,
      ghuser: this.ghuser,
      ghkey: this.ghkey,
      ghconc: this.ghconc
    });

    this.npmAPI = new NPMAPI({
      Error: this.Error,
      cwd: this.cwd,
      cache: this.cache,
      npmconc: this.npmconc
    });

    this.packageJSON = null;
    this.deps = new Map();
    this.devDeps = new Map();
    this.optDeps = new Map();
    this.peerDeps = new Map();
    this.allDeps = new Map();

    this.npmInfos = new Map();
    this.gitVersions = new Map();
    this.gitMasters = new Map();
    this.gitLatestTagMasters = new Map();
  }

  async ensureNodePackage() {
    const pkgJSONpath = path.join(this.cwd, 'package.json');

    if (!await fs.exists(pkgJSONpath))
      throw new Error(`Not a npm package. ${pkgJSONpath} not found.`);

    const pkgJSON = JSON.parse(await fs.readFile(pkgJSONpath));

    this.packageJSON = pkgJSON;

    if (pkgJSON.dependencies)
      this.deps = new Map(Object.entries(pkgJSON.dependencies));

    if (pkgJSON.devDependencies)
      this.devDeps = new Map(Object.entries(pkgJSON.devDependencies));

    if (pkgJSON.optionalDependencies)
      this.optDeps = new Map(Object.entries(pkgJSON.optionalDependencies));

    if (pkgJSON.peerDependencies)
      this.peerDeps = new Map(Object.entries(pkgJSON.peerDependencies));

    this.allDeps = new Map([
      ...this.deps,
      ...this.devDeps,
      ...this.optDeps,
      ...this.peerDeps
    ]);
  }

  async gatherNPMData() {
    const steps = new Map();

    for (const [dep] of this.allDeps) {
      const stepName = STEP_GET_PKG_INFO(dep);
      this.step(stepName);
      steps.set(stepName, async () => {
        // TODO: support git deps.
        const [info, cached] = await this.npmAPI.getPkgInfo(dep);

        if (!info)
          throw new this.Error(`Could not fetch pkg info for: ${dep}.`);

        if (cached)
          this.step(stepName, null, 'Recovered from the cache.');

        this.npmInfos.set(dep, info);
      });
    }

    const sem = new Semaphore(this.npmconc);
    await this.runParallelSteps(steps, sem);
  }

  async gatherGithubData() {
    const steps = new Map();

    for (const [dep] of this.allDeps) {
      const stepName = STEP_GET_GITHUB_INFO(dep);
      const {url} = this.npmInfos.get(dep).repository;
      const matches = url.match(GIT_REPO_REGEX);
      const [,, owner, repo] = matches;

      this.step(stepName);
      // TODO: Support something other than GITHUB?
      steps.set(stepName, async () => {
        const [tags] = await this.githubAPI.getRepoTags(owner, repo);
        this.gitVersions.set(dep, tags);
      });
    }

    const sem = new Semaphore(this.ghconc);
    await this.runParallelSteps(steps, sem);

    return true;
  }

  async gatherGithubMasters() {
    const steps = new Map();

    for (const [dep] of this.allDeps) {
      const stepName = STEP_GET_GITHUB_MASTER(dep);
      const {url} = this.npmInfos.get(dep).repository;
      const matches = url.match(GIT_REPO_REGEX);
      const [,, owner, repo] = matches;

      this.step(stepName);
      // TODO: Support something other than GITHUB?
      steps.set(stepName, async () => {
        const [master] = await this.githubAPI.getMasterRef(owner, repo);
        this.gitMasters.set(dep, master);
      });
    }

    const sem = new Semaphore(this.ghconc);
    await this.runParallelSteps(steps, sem);
  }

  async gatherGithubLatests() {
    const steps = new Map();

    for (const [dep] of this.allDeps) {
      const stepName = STEP_GET_GITHUB_LATEST(dep);
      const {url} = this.npmInfos.get(dep).repository;
      const matches = url.match(GIT_REPO_REGEX);
      const [,, owner, repo] = matches;
      const gitInfo = this.gitVersions.get(dep)
        .map((info) => {
          const tag = info.ref.substr('refs/tags/'.length);

          return {
            tag: tag,
            type: info.object.type,
            sha: info.object.sha
          };
        })
        .filter(i => /^v\d+\.\d+\.\d+.*/.test(i.tag))
        .filter(i => semver.valid(semver.coerce(i.tag)))
        .sort((a, b) => {
          return semver.compare(
            semver.coerce(a.tag),
            semver.coerce(b.tag)
          );
        });

      const gitLatest = gitInfo[gitInfo.length - 1];

      this.step(stepName);
      steps.set(stepName, async () => {
        const tag = gitLatest.tag;
        let sha = gitLatest.sha;

        if (gitLatest.type === 'tag') {
          const [tag] = await this.githubAPI.getTagRefInfo(owner, repo, sha);
          sha = tag.object.sha;
        }

        this.gitLatestTagMasters.set(dep, {tag, sha});
      });
    }

    const sem = new Semaphore(this.ghconc);
    await this.runParallelSteps(steps, sem);
  }

  /**
   * Run everything ?
   */

  async run() {
    await this.ensureNodePackage();

    const tasks = {
      [TASK_GATHER_NPM_DATA]: async () => this.gatherNPMData(),
      [TASK_GATHER_GITHUB_DATA]: async () => this.gatherGithubData(),
      [TASK_GATHER_GITHUB_MASTERS]: async () => this.gatherGithubMasters(),
      [TASK_GATHER_GITHUB_LATESTS]: async () => this.gatherGithubLatests()
    };

    this.registerTasks(Object.keys(tasks));
    await this.runTasks(Object.entries(tasks));

    this.output();
  }

  // printing methods
  generalPackageINfo() {
    let out = `All packages: ${this.allDeps.size}`;

    if (this.deps.size)
      out += `, norm: ${this.deps.size}`;

    if (this.devDeps.size)
      out += `, dev: ${this.devDeps.size}`;

    if (this.optDeps.size)
      out += `, optional: ${this.optDeps.size}`;

    if (this.peerDeps.size)
      out += `, peer: ${this.peerDeps.size}`;

    return `${out}.`;
  }

  formatPackageInfo(pkg) {
    // npm info
    const {engines} = this.packageJSON;
    const pkgEngine = engines ? engines.node : '0.0.0';
    const depVersion = this.allDeps.get(pkg);
    const npmInfo = this.npmInfos.get(pkg);
    const npmLatest = npmInfo['dist-tags'].latest;
    const npmVersions = util.sortSemver(Object.keys(npmInfo.versions));
    assert(npmLatest === npmVersions[npmVersions.length - 1]);
    const npmLatestInfo = npmInfo.versions[npmLatest];
    const npmLatestEngine = npmLatestInfo.engines.node;

    const gitLatest = this.gitLatestTagMasters.get(pkg);
    const gitMaster = this.gitMasters.get(pkg).object.sha;

    const versionCmp = semver.compare(gitLatest.tag, npmLatest);
    const latest = versionCmp === -1 ? `v${npmLatest}` : gitLatest.tag;

    // dep package checks:
    // Latest checks
    // Missing tag ? (npm has version but not git)
    // Missing npm release? (git has tag but not npm)
    // Do we have unreleased content ? tag != master.
    // Figure out totally latest thing.

    // Origin package checks
    // Engine Check: is our node engine >= dependency ?
    // Version check: Do we have latest version ?
    // Will npm install use the latest version?

    let tableEntry = {};

    // Handle git version (if it's resolved from git,
    // we need to compare it to git latest)
    {
      const resolved = semver.satisfies(latest, depVersion);
      let version = colors.greenText(depVersion);

      if (!resolved)
        version = colors.redText(depVersion);

      const engineMin = semver.minVersion(npmLatestEngine).version;
      const projectMin = semver.minVersion(pkgEngine).version;

      let engine = '';
      if (semver.compare(engineMin, projectMin) === 1) {
        engine = 'engine: ' + colors.redText(engineMin);
        tableEntry.engine = colors.redText(engineMin);
      }
      tableEntry.dependency = `${pkg}@${version}`;
    }

    {
      let gitText = colors.greenText(gitLatest.tag);

      if (versionCmp === -1)
        gitText = colors.redText(gitLatest.tag);

      let unreleased = '';
      if (gitLatest.sha !== gitMaster)
        unreleased = colors.redText('*');

      tableEntry.git = `${gitText}${unreleased}`;
    }

    {
      let npmText = colors.greenText(`v${npmLatest}`);

      if (versionCmp === 1)
        npmText = colors.redText(`v${npmLatest}`);

      tableEntry.npm = npmText;
    }

    return tableEntry;
  }

  output() {
    this.log(this.generalPackageINfo());

    const headers = ['dependency', 'git', 'npm', 'engine'];
    const table = [];

    for (const [pkg] of this.allDeps) {
      table.push(this.formatPackageInfo(pkg));
    }

    this.log(util.printTable(headers, table));
  }
}

exports.DependencyCheck = DependencyCheck;
