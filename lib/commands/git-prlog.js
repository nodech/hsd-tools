/*!
 * commands/prlog.js - Log commits groupd by PRs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {Command} = require('./command');
const {git, GitAPI, GithubAPI} = require('../api');

const TASK_GATHER_DATA = 'Gather data from git.';
const STEP_GET_COMMIT_LOG = 'Get commit log.';
const STEP_GET_MERGES = 'Get merges.';
const STEP_GET_GH_DATA = 'Get github PR list.';

const TASK_GATHER_PR_INFO = 'Gather PR info from Github.';
const STEP_GETTING_PR = pr => `Getting info for PR #${pr}.`;

/**
 * This needs several things:
 *  - Collect merge commits with Parents.
 *    - git rev-list --merges ...
 *  - Get commits for that parent diff (Group to merges)
 *    - git log p1..p2
 *  - Get LS-Remote to check what are remove PRs available.
 *    - git ls-remote
 *  - Match ls-remote head to the top Merge hash
 *    - If they match, it's our pr
 *    - Otherwise it could be bcoin PR (We don't grab those)
 *    - We could also collect PR Names at this point for caching.
 *  - Finally get another full list of commits to iterate and
 *    pretty print.
 */

class GitPRLog extends Command {
  constructor(options) {
    super(options);

    this.options = options;
    this.cache = options.cache;
    this.ghuser = options.ghuser;
    this.ghkey = options.ghkey;
    this.cwd = options.cwd;

    this.remote = options.remote;
    this.remoteURL = null;

    this.gitAPI = new GitAPI({
      Error: this.Error,
      cache: this.cache,
      cwd: this.cwd,
      remote: this.remote
    });

    this.githubAPI = new GithubAPI({
      Error: this.Error,
      cache: this.cache,
      cwd: this.cwd,
      ghuser: this.ghuser,
      ghkey: this.ghkey
    });

    // This is where we collect data.
    this.logs = new Map();
    // Try recovering PR ID from Commit message.
    this.logHashByPR = new Map();
    this.logPRByHash = new Map();

    // Get merge commits
    this.merges = new Set();

    // This will have github HEADs for each PR providing hashes for each PR.
    this.remoteInfo = {};

    // This will fill the metadata for display.
    this.prData = new Map();
  }

  async gatherGitData() {
    const {gitAPI} = this;

    const steps = {
      [STEP_GET_COMMIT_LOG]: async () => {
        this.logs = await gitAPI.getMiniLog();

        const regex = /^\s*?Merge.*#(\d+) .*$/i;

        for (const [hash, message] of this.logs.entries()) {
          const match = message.match(regex);

          if (match === null)
            continue;

          const pr = Number(match[1]);
          this.logHashByPR.set(pr, hash);
          this.logPRByHash.set(hash, pr);
        }
      },
      [STEP_GET_MERGES]: async () => {
        this.merges = await gitAPI.getMergeCommits();
      },
      [STEP_GET_GH_DATA]: async () => {
        const [info, cached] = await gitAPI.lsRemote();

        if (cached)
          this.step(STEP_GET_GH_DATA, 0, 'Recovered from the cache.');

        this.remoteInfo = info;
      }
    };

    this.registerSteps(Object.keys(steps));

    await this.runSeriesSteps(Object.entries(steps));
  }

  /**
   * Maybe we will support non-github as well in the future?
   */

  async gatherGithubData() {
    const allRemotePRs = Object.keys(this.remoteInfo.pulls);
    let done = 0;

    const {owner, repository: repo} = this.remoteURL;
    for (const pr of allRemotePRs) {
      this.task(TASK_GATHER_PR_INFO, null,
        `Fetching (${done}/${allRemotePRs.length})`);

      const info = await this.githubAPI.getPRInfo(owner, repo, pr);
      this.prData.set(pr, info);
      done++;
      this.task(TASK_GATHER_PR_INFO, null,
        `Fetching (${done}/${allRemotePRs.length})`);
    }
  }

  async checkRemote() {
    const gurl = git.GitUrl.fromRemoteURL(this.remote);

    if (gurl.isNull()) {
      const remotes = await this.gitAPI.remotes('fetch');

      if (!remotes.has(this.remote))
        throw new this.Error(`Could not find remote "${this.remote}".`);

      const url = remotes.get(this.remote);

      this.remote = url.toHTTP();
      this.remoteURL = url;
      return;
    }

    this.remote = gurl.toHTTP();
    this.remoteURL = gurl;
  }

  async run() {
    await this.checkRemote();

    const tasks = {
      [TASK_GATHER_DATA]: async () => this.gatherGitData(),
      [TASK_GATHER_PR_INFO]: async () => this.gatherGithubData()
    };

    this.registerTasks(Object.keys(tasks));
    await this.runTasks(Object.entries(tasks));
  }
}

exports.GitPRLog = GitPRLog;
