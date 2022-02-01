/*!
 * api/git.js - Cached version of the git API.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {API} = require('./api');
const git = require('./git-low');
const {T_HOUR} = require('../cache');

const GIT_CACHE = 'git';
const GIT_LS_REMOTE = name => `ls-remote-${name}.json`;

class GitAPI extends API {
  constructor(options) {
    super(options);

    this.remote = 'origin';

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);

    if (options.remote != null) {
      assert(typeof options.remote === 'string');
      this.remote = options.remote;
    }
  }

  /**
   * Execute command
   * @param {Function} command
   * ...args
   * @returns {Promise<Object>}
   */

  async exec(command, ...args) {
    try {
      const {stdout, stderr} = await command(...args);
      assert(stderr.length === 0, stderr);

      return stdout;
    } catch (e) {
      throw new this.Error(
        `git command "${e.cmd}" failed:\n`
        + `  ${e.stderr}`);
    }
  }

  /**
   * Get commit hash and message
   * No Cache
   * @returns {Promise<Map<String, String>}
   */

  async getMiniLog() {
    // Make sure message is always last.
    const format = '%H|%s';

    const stdout = await this.exec(git.log, this.cwd, {
      pretty: format
    });

    const map = new Map();

    for (const line of stdout.split('\n')) {
      if (!line)
        continue;

      const [hash, message] = line.split('|');

      map.set(hash, message);
    }

    return map;
  }

  /**
   * Get merge commits
   * No Cache
   * @returns {Promise<Set<String>}
   */

  async getMergeCommits() {
    const stdout = await this.exec(git.revList, this.cwd, {
      merges: true,
      from: 'HEAD'
    });

    const set = new Set();

    for (const line of stdout.split('\n')) {
      if (!line)
        continue;

      set.add(line);
    }

    return set;
  }

  /**
   * Get merge commits
   * @param {String} hash
   * @returns {Promise<Set<String>>} - list of commit hashes
   */

  async getCommitsForMerge(hash) {
    const commitInfo = await this.exec(git.show, this.cwd, {
      noPatch: true,
      pretty: '%P',
      args: [hash]
    });

    const [from, to] = commitInfo.trim().split(' ');

    if (!from || !to)
      throw new Error(`${hash} is not merge commit.`);

    const stdout = await this.exec(git.log, this.cwd, {
      pretty: '%H',
      args: [`${from}..${to}`]
    });

    const commits = [];

    for (const commitHash of stdout.trim().split('\n'))
      commits.push(commitHash);

    return commits;
  }

  /**
   * List remotes
   * @param {String} matchType
   * @returns {Promise<Map<String, String>>}
   */

  async remotes(matchType) {
    const stdout = await this.exec(git.remotes, this.cwd);

    const map = new Map();

    for (const line of stdout.trim().split('\n')) {
      if (!line)
        continue;

      const [name, url, type] = line.split(/\s+/);

      if (type !== `(${matchType})`)
        continue;

      const gurl = git.GitUrl.fromRemoteURL(url);

      map.set(name, gurl);
    }

    return map;
  }

  /**
   * Get remote info
   * @returns {Promise<[Object, Boolean]>} - remote object, cache?
   */

  async lsRemote() {
    const cacheName = GIT_CACHE;
    const fileName = GIT_LS_REMOTE(this.remote);

    const cached = await this.cache.getCache(cacheName, fileName);

    if (cached != null)
      return [JSON.parse(cached), true];

    const stdout = await this.exec(git.lsRemote, this.remote);

    const items = stdout.trim().split('\n');
    const lsRemote = {
      master: null,
      branches: {},   // heads
      tags: {},
      pulls: {},
      prByHash: {}
    };

    for (const rawItem of items) {
      const [hash, ref] = rawItem.split('\t');

      if (ref.startsWith('refs/tags/')) {
        let version = ref.replace('refs/tags/', '');

        if (version.endsWith('^{}'))
          version = version.replace('^{}', '');

        if (!lsRemote.tags[version])
          lsRemote.tags[version] = [];

        lsRemote.tags[version].push(hash);

        continue;
      } else if (ref.startsWith('refs/heads')) {
        const branch = ref.replace('refs/heads/', '');
        lsRemote.branches[branch] = hash;
        continue;
      } else if (ref.startsWith('refs/pull/')) {
        const regex = /^refs\/pull\/(\d+)\/head$/;
        const match = ref.match(regex);

        // unknown format ?
        if (!match || !match[1])
          continue;

        const pr = Number(match[1]);

        if (isNaN(pr))
          continue;

        lsRemote.prByHash[hash] = pr;
        lsRemote.pulls[pr] = hash;
        continue;
      }

      // unknown ref type
    }

    lsRemote.master = lsRemote.branches.master;

    const data = JSON.stringify(lsRemote, null, 2);
    await this.cache.cache(cacheName, fileName, data, T_HOUR * 2);

    return [lsRemote, false];
  }
}

exports.GitAPI = GitAPI;
