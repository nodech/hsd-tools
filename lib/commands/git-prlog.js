/*!
 * commands/prlog.js - Log commits groupd by PRs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {Command} = require('./command');
const {git, GitAPI, GithubAPI} = require('../api');
const {Semaphore} = require('../utils/semaphore');

const TASK_GATHER_DATA = 'Gather data from git.';
const STEP_GET_COMMIT_LOG = 'Get commit log.';
const STEP_GET_MERGES = 'Get merges.';
const STEP_GET_GH_DATA = 'Get github PR list.';

const TASK_GATHER_PR_INFO = 'Gather PR info from Github.';
const STEP_GETTING_PR = pr => `Getting info for PR #${pr}.`;

const TASK_GATHER_MERGE_DATA = 'Gather merge data.';
const STEP_GATHER_MERGE_DATA = hash => `Gather merge data for ${hash}.`;

const MERGE_REGEX = /^\s*?Merge.*#(\d+) .*$/i;

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
 *
 * Regarding Pull request detection.
 *   There are multiple sources of the data for
 * determining what PR this commit belongs to:
 *   - Merges (revlist --merges) - This is the main source of merges.
 *   For each merge we have to cross check other sources to figure out
 *   the PR Number of the merge.
 *   - ls-remote and githubs entries there. Github has list of refs
 *   listed in their remote: refs/heads is what's interesting for us,
 *   it contains the head of the commit list, it can be cross refed with
 *   merges. - this probably has the highest reliability. Downside is
 *   any kind of rebase on these commits after the merge, which can occur
 *   when PR is merged in a single unifying PR can lead to changed hashes.
 *   - GH API Information - This contains head as well as merge sha
 *   for the PR. But this information is most useful for the title and meta
 *   data. Usefulness of other hashes is TBD.
 *   - Log message format - Most of our merge commits have strict rules
 *   to contain "Merge PR(or Pull Request) #Number from remote". From here
 *   we can extract the Merge PR Information, but this is not 100% reliable:
 *   Because several of PRs have been merged into another PR before going
 *   to master. As well as human error of misnumbering the PR. So this needs
 *   to be questioned.
 *
 *   So process will be something like:
 *    - Index commits by PR using `merges`.
 *    - Try matching head of the Merge to the ls-remote pull head, if it does
 *    not match, double check with GH API Data of the Merge commit (there are
 *    some commits, e.g. fast forward merged which merge commit is same as
 *    head).
 *      - Check merge head is same as ls-remote/pull/head.
 *      (merge head: take list of commits head)
 *      - else check merge HASH is same as ls-remote/pull/head
 *      - else check merge HASH is same as gh-api/merge-hash
 *      - else check merge head is same as gh-api/merge-hash
 *      - else use merge log as the number.
 *      - else it means we could not find the PR No.
 *    - Commits with merge format but without being merge commits will
 *      still be cross checked against those commits, but will only
 *      show up as secondary/commit number. Major PR No will come from the
 *      actual merge list.
 */

class GitPRLog extends Command {
  constructor(options) {
    super(options);

    this.options = options;
    this.cache = options.cache;
    this.ghuser = options.ghuser;
    this.ghkey = options.ghkey;
    this.ghconc = options.ghconc;
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
      ghkey: this.ghkey,
      ghconc: this.ghconc
    });

    // Commit log.
    this.logs = new Map();

    // Try recovering PR ID from Commit message.
    this.logPRByHash = new Map();

    // Get merge commits
    this.merges = new Set();
    this.commitsByMerge = new Map();
    this.mergesByHash = new Map();
    this.prsByHash = new Map();

    // This will have github HEADs for each PR providing hashes for each PR.
    this.remoteInfo = {};

    // This will fill the metadata for display.
    this.ghdata = new Map();
    this.ghdataPRByHash = new Map();
  }

  /**
   * Gather information from the local git.
   */

  async gatherGitData() {
    const {gitAPI} = this;

    const steps = {
      [STEP_GET_COMMIT_LOG]: async () => {
        this.logs = await gitAPI.getMiniLog();

        for (const [hash, message] of this.logs.entries()) {
          const match = message.match(MERGE_REGEX);

          if (match === null)
            continue;

          const pr = Number(match[1]);
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

  /*
   * Maybe we will support non-github as well in the future?
   */

  /**
   * Gather information from the GithubAPI.
   */

  async gatherGithubData() {
    const allRemotePRs = Object.keys(this.remoteInfo.pulls);
    const parallel = this.ghconc || 2;
    const sem = new Semaphore(parallel);

    for (const pr of allRemotePRs)
      this.step(STEP_GETTING_PR(pr));

    const {owner, repository: repo} = this.remoteURL;

    const steps = [];

    for (const pr of allRemotePRs) {
      steps.push([STEP_GETTING_PR(pr), async () => {
        const [info, cached] = await this.githubAPI.getPRInfo(owner, repo, pr);

        if (!info)
          throw new this.Error(`Could not fetch PR #${pr}.`);

        if (cached)
          this.step(STEP_GETTING_PR(pr), null, 'Recovered from the cache.');

        this.ghdata.set(pr, info);

        if (info.merge_commit_sha)
          this.ghdataPRByHash.set(info.merge_commit_sha, pr);
      }]);
    }

    await this.runParallelSteps(steps, sem);
  }

  /**
   * Make sure remote is correct and we can use it.
   */

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

  /**
   * Group commits by merger commits.
   */

  async groupByMerges() {
    const semaphore = new Semaphore(5);

    for (const hash of this.merges.values())
      this.step(STEP_GATHER_MERGE_DATA(hash));

    const steps = [];
    for (const hash of this.merges.values()) {
      steps.push([STEP_GATHER_MERGE_DATA(hash), async () => {
        const commits = await this.gitAPI.getCommitsForMerge(hash);

        this.commitsByMerge.set(hash, commits);

        for (const commit of commits)
          this.mergesByHash.set(commit, hash);
      }]);
    }

    await this.runParallelSteps(steps, semaphore);
  }

  /**
   * Run everything ?
   */

  async run() {
    await this.checkRemote();

    const tasks = {
      [TASK_GATHER_DATA]: async () => this.gatherGitData(),
      [TASK_GATHER_PR_INFO]: async () => this.gatherGithubData(),
      [TASK_GATHER_MERGE_DATA]: async () => this.groupByMerges()
    };

    this.registerTasks(Object.keys(tasks));
    await this.runTasks(Object.entries(tasks));

    this.output();
  }

  /**
   * Is it possibly a merge commit?
   * @param {String} hash
   * @returns {Boolean}
   */

  isMerge(hash) {
    const msgMerge = this.logPRByHash.has(hash);
    const merges = this.merges.has(hash);
    const prs = this.ghdataPRByHash.has(hash);

    // if ((msgMerge || prs) && !merges)
    //   this.log(`!!! WTF IS WRONG with ${hash}, merge msg: ${msgMerge}, pr: ${prs}`);

    // if (msgMerge !== merges || merges !== prs)
    //   this.log(`Found inconsistency: ${msgMerge}, ${merges}, ${prs} `
    //     + `for ${hash}`);

    return msgMerge || merges || prs;
  }

  getPRInfo(hash) {
    assert(this.merges.has(hash), `${hash} is not a merge.`);

    const messagePR = this.logPRByHash.get(hash);
    const head = this.commitsByMerge.get(hash)[0];
    const gh = this.ghdataPRByHash.has(hash);
    const prByHead = this.remoteInfo.prByHash[head];
    const prByMerge = this.remoteInfo.prByHash[hash];

    // this.prsByHash.set()

    this.log(
      `MessagePR: ${messagePR || 0}, head: ${head}, gh: ${gh},`
      + ` prByHead: ${prByHead}, prByMerge: ${prByMerge}\n`
    );
  }

  output() {
    return this.outputGroupedByPR();
  }

  outputGroupedByPR() {
    const output = [];

    // clone the logs.
    const logs = new Map(this.logs.entries());
    const formatMsg = (hash, message, pr) => {
      return `${hash} - ${message}`;
    };

    for (const [hash, message] of logs) {
      if (this.merges.has(hash)) {
        output.push(formatMsg(hash, message, true));

        const hashes = this.commitsByMerge.get(hash);
        const mergeOut = [];

        for (const hash of hashes) {
          const msg = logs.get(hash);
          logs.delete(hash);

          mergeOut.push(formatMsg(hash, msg));
        }

        output.push(mergeOut, '');

        continue;
      }

      output.push(formatMsg(hash, message));
    }

    this.log(assembleOutput(output));
  }
}

function assembleOutput(out, depth = 0, width = 2) {
  const padding = ' '.repeat(depth * width);

  let output = '';

  for (const line of out) {
    if (Array.isArray(line)) {
      output += assembleOutput(line, depth + 1, width);
      continue;
    }

    output += padding + line + '\n';
  }

  return output;
}

exports.GitPRLog = GitPRLog;
