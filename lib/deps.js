/*!
 * deps.js - package dependencies
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

/**
 * @property {PackagesInfo} pkginfo
 * @property {Map} resolvedDependencies - dependencies with specific versions.
 * @property {Map} dependencies - package -> no dependencies.
 * @property {Map} gitDependencies - package -> no git dependencies.
 * @property {Map} npmDependencies - package -> no npm dependencies.
 * @property {Map} dependents - package -> no dependents.
 * @property {Map} gitDependents - package -> no git dependents.
 * @property {Map} npmDependents - package -> no npm dependents.
 * @property {Map} devDependencies - package -> no dev dependencies.
 * @property {Map} gitDevDependencies - package -> no git dev dependencies.
 * @property {Map} npmDevDependencies - package -> no npm dev dependencies.
 * @property {Map} devDependents - package -> no dev dependents.
 * @property {Map} gitDevDependents - package -> no git dev dependents.
 * @property {Map} npmDevDependents - package -> no npm dev dependents.
 */
class DependencyInfo {
  constructor(pkginfo) {
    this.pkginfo = pkginfo;

    this.resolvedDependencies = new Map();

    this.dependencies = new Map();
    this.gitDependencies = new Map();
    this.npmDependencies = new Map();

    this.dependents = new Map();
    this.gitDependents = new Map();
    this.npmDependents = new Map();

    this.devDependencies = new Map();
    this.gitDevDependencies = new Map();
    this.npmDevDependencies = new Map();

    this.devDependents = new Map();
    this.gitDevDependents = new Map();
    this.npmDevDependents = new Map();
  }

  init() {
    this.countDeps();
    this.resolveDependencies();
  }

  countDeps() {
    for (const [name, pkg] of this.pkginfo.packages.entries()) {
      this.dependencies.set(name, pkg.dependencies.size);
      this.devDependencies.set(name, pkg.devDependencies.size);

      this.gitDependencies.set(name, 0);
      this.npmDependencies.set(name, 0);
      this.gitDevDependencies.set(name, 0);
      this.npmDevDependencies.set(name, 0);

      for (const [dname, dep] of pkg.dependencies.entries()) {
        const n = this.dependents.get(dname) || 0;
        this.dependents.set(dname, n + 1);

        if (dep.isGIT()) {
          const n = this.gitDependents.get(dname) || 0;
          this.gitDependents.set(dname, n + 1);

          const ndeps = this.gitDependencies.get(name);
          this.gitDependencies.set(name, ndeps + 1);
        } else if (dep.isNPM()) {
          const n = this.npmDependents.get(dname) || 0;
          this.npmDependents.set(dname, n + 1);

          const ndeps = this.npmDependencies.get(name);
          this.npmDependencies.set(name, ndeps + 1);
        }
      }

      for (const [dname, dep] of pkg.devDependencies.entries()) {
        const n = this.devDependents.get(dname) || 0;
        this.devDependents.set(dname, n + 1);

        if (dep.isGIT()) {
          const n = this.gitDevDependents.get(dname) || 0;
          this.gitDevDependents.set(dname, n + 1);

          const ndeps = this.gitDevDependencies.get(name);
          this.gitDevDependencies.set(name, ndeps + 1);
        } else if (dep.isNPM()) {
          const n = this.npmDevDependents.get(dname) || 0;
          this.npmDevDependents.set(dname, n + 1);

          const ndeps = this.npmDevDependencies.get(name);
          this.npmDevDependencies.set(name, ndeps + 1);
        }
      }
    }
  }

  resolveDependencies() {
  }
}

exports.DependencyInfo = DependencyInfo;
