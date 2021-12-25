/*!
 * commands/prlog.js - Log commits groupd by PRs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {Command} = require('./command');

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

class PRLog extends Command {
  constructor(options) {
    super(options);

  }
}

exports.PRLog = PRLog;
