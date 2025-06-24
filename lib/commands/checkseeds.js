/*!
 * checkseeds.js - Check specific seeds for details.
 * Copyright (c) 2025, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {Command} = require('./command');
const {Semaphore} = require('../utils/semaphore');
const {NullCache, T_MINUTE} = require('../cache');
const util = require('../utils/util');
const colors = require('../utils/colors');
const {fetchCached} = require('../utils/fetch');

const CACHE_NAME = 'hs-checkseeds';

const NETHEALTH_URL = 'https://hsdnethealth.nodech.dev/data/nodes';
const NETHEALTH_NODE = addr => `${NETHEALTH_URL}/hosts/${addr}/general.json`;
const NETHEALTH_5MONTHS = (ip, port) => {
  return `${NETHEALTH_URL}/hosts/${ip}/${port}-history-day-5month.json`;
};

const PORT_CLEAR = 12038;
const FIVE_MONTHS = 150;

const TASK_GET_SEEDS = 'Gather seed details';
const STEP_GET_NODE_DETAILS = seed => `Get ${seed} info`;

/**
 * @typedef {Object} SeedData
 * @property {string} addr
 * @property {boolean} isMainSeed
 * @property {boolean} isGeneratedSeed
 * @property {boolean} isOnline
 * @property {Boolean} isFullNode
 * @property {Boolean} isFullTree
 * @property {Number} lastSeen
 * @property {Number} lastHeight
 * @property {Number} lastVersion
 * @property {Months5Data} uptime5months
 * @property {Boolean} bcoinNinja
 * @property {Boolean} hsdnodesTools
 */

class CheckSeeds extends Command {
  constructor(options) {
    super(options);

    this.cache = options.cache || new NullCache();

    /** @type {String[]} */
    this.seeds = parseSeeds(options.seeds || []);

    /** @type {Map<string, SeedData>} */
    this.seedData = new Map();
  }

  async getCachedNethealth(url) {
    const fileName = url.substring(NETHEALTH_URL.length + 1)
      .replaceAll('/', '_');

    const [response] = await fetchCached(this.cache, {
      Error: this.Error,

      cacheName: CACHE_NAME,
      fileName: fileName,
      expire: 5 * T_MINUTE,

      sema: this.fetchSem,

      method: 'GET',
      url: url
    });

    return response;
  };

  /**
   * @param {Object} nethealthEntry
   * @returns {SeedData}
   */

  seedDataFromEntry(entry) {
    const lastUp = entry.lastUp;
    const lastStatus = entry.lastStatus;
    const addr = lastStatus.info.host + ':' + lastStatus.info.port;

    /** @type {SeedData} */
    const seedData = {
      addr,
      isOnline: entry.isUp,
      uptime5months: null,

      lastSeen: 0,
      isFullNode: false,
      isFullTree: false,
      lastHeight: 0,
      lastVersion: ''
    };

    if (!lastUp)
      return seedData;

    const lastDetails = lastUp.info.result;

    seedData.lastSeen = lastUp.info.time;
    seedData.isFullNode = !lastDetails.chain.pruned;
    seedData.isFullTree = !lastDetails.chain.treeCompacted;
    seedData.lastHeight = lastDetails.peer.height;
    seedData.lastVersion = extractVersion(lastDetails.peer.agent);

    return seedData;
  }

  async getNodeDetails(seed) {
    const ip = seed.split(':')[0];
    const port = seed.split(':')[1];

    let general, months5;

    try {
      const results = await Promise.all([
        this.getCachedNethealth(NETHEALTH_NODE(ip)),
        this.getCachedNethealth(NETHEALTH_5MONTHS(ip, port))
      ]);

      general = results[0];
      months5 = results[1];
    } catch (e) {
      this.failedToGet.add(seed);
      throw e;
    }

    if (general == null || months5 == null) {
      this.failedToGet.add(seed);
      throw new Error('Failed to get node details');
    }

    if (general.general[port] == null) {
      this.failedToGet.add(seed);
      throw new Error(`Port ${port} not found in general.json`);
    }

    const data = this.seedDataFromEntry(general.general[port]);
    data.uptime5months = Months5Data.fromEntries(months5.data);

    this.seedData.set(seed, data);
  }

  async getAllNodeDetails() {
    const steps = new Map();

    for (const seed of this.seeds) {
      const stepName = STEP_GET_NODE_DETAILS(seed);

      this.step(stepName);

      steps.set(stepName, async () => {
        await this.getNodeDetails(seed);
      });
    }

    const sem = new Semaphore(3);
    await this.runParallelSteps(steps, sem);
  }

  async run() {
    const tasks = {
      [TASK_GET_SEEDS]: () => this.getAllNodeDetails()
    };

    this.registerTasks(Object.keys(tasks));
    await this.runTasks(Object.entries(tasks));

    this.report();
  }

  report() {
    const headers = [
      'seed',
      'on',
      'uptime',
      'uptime5',
      'full',
      'fullNow',
      'fullTree',
      'height',
      'version'
    ];

    const entries = [];
    for (const entry of this.seedData.values()) {
      const tableEntry = {};

      tableEntry.entry = entry;

      tableEntry.seed = entry.addr;
      tableEntry.on = formatYN(entry.isOnline);
      tableEntry.uptime = entry.uptime5months.onlinePerc.toFixed(2) + '%';
      tableEntry.uptime5 = entry.uptime5months.allOnlinePerc.toFixed(2) + '%';
      tableEntry.full = entry.uptime5months.fullPerc.toFixed(2) + '%';
      tableEntry.fullNow = formatYN(entry.isFullNode);
      tableEntry.fullTree = formatYN(entry.isFullTree);
      tableEntry.version = entry.lastVersion;

      tableEntry.height = String(entry.lastHeight);
      tableEntry.rawHeight = String(entry.lastHeight);

      entries.push(tableEntry);
    }

    this.log(util.printTable(headers, entries));
  }
}

function parseSeeds(seeds) {
  return seeds.map((seed) => {
    // no ipv6
    assert(seed.includes('.'));

    const trimmed = seed.trim();

    if (seed.includes(':')) {
      return trimmed;
    }

    return `${trimmed}:${PORT_CLEAR}`;
  });
}

function extractVersion(version) {
  return version.split('/')[1];
}

class Months5Data {
  constructor() {
    this.countSync = 0;
    this.countSPV = 0;
    this.countPruned = 0;
    this.countCompacted = 0;
    this.total = 0;
    this.totalEntries = 0;
  }

  get onlinePerc() {
    if (this.total === 0)
      return 0;

    return percent(this.countSync, this.total);
  }

  get allOnlinePerc() {
    if (this.total === 0)
      return 0;

    const avg = this.total / this.totalEntries | 0;

    if (this.totalEntries < FIVE_MONTHS)
      this.total = this.total + (avg * (FIVE_MONTHS - this.totalEntries));

    return percent(this.countSync, this.total);
  }

  get fullPerc() {
    if (this.countSync === 0)
      return 0;

    const full = this.countSync - this.countPruned;
    return percent(full, this.countSync);
  }

  fromEntries(entries) {
    this.totalEntries = 0;

    for (const entry of Object.values(entries)) {
      this.countSync += entry.canSync;
      this.countSPV += entry.spv;
      this.countPruned += entry.pruned;
      this.countCompacted += entry.compacted;
      this.total += entry.total;
      this.totalEntries++;
    }

    return this;
  }

  static fromEntries(entries) {
    return new this().fromEntries(entries);
  }
}

function percent(num, total) {
  return ((num / total) * 100);
}

function formatYN(bool) {
  return bool
    ? colors.greenText('y')
    : colors.redText('n');
}

exports.CheckSeeds = CheckSeeds;
