hsd-tools
=========

Some CLI tools for [hsd](https://github.com/handshake-org/hsd) maintainance.


### Config

Global config is being loaded from `$HOME/.hs-tools.json`.

Example:

```
{
  "ghuser": "nodech",
  "ghkey": "ghp_somekey"
}
```

### Install

`npm i -g hsd-tools`

### Cache

Cache will be created in the folder you are running: `process.cwd()/.hs-tools`.
If it ever becomes stale you can either remove .hs-tools directory or use `--cache-ignore`.

### HELP

```
hsd-tools [tool options] command [command options]
Commands:
  help                   - Show this help.
  git                    - Git related subcommands
  depcheck               - Check dependencies of the pkg.
  genseeds               - Generate seeds for hsd network.
    --format             - Output format: ui, seeds
    --sort               - Sort by: uptime, height, ip
    --no-categories      - Do not group by categories
    --ignore-main        - Ignore main seeds
    --ignore-gen         - Ignore generated seeds
    --ignore-other       - Ignore other seeds
    --filter-pruned      - Filter pruned seeds (default: true)
    --filter-uptime      - Filter by uptime (default: 0)%
    --filter-online      - Filter online seeds (default: false)

  checkseeds [seeds..]   - Check hsd network seeds.

Git subcommands:
  prlog                  - Log formatted by PRs
    --remote [=origin]   - Which remote to use.
    --groupbypr          - Group Commits by pr
    --longid             - Log full commit hash
    Github options bellow...

Options:
  -h, --help             - show help
  -f, --force            - Ignore lock
  --ui=<type>            - text or loader

General options:
  --ghuser               - GH API User
  --ghkey                - GH API Key
  --ghconcurrent         - Concurrent requests to send to the API.
  --npmconcurrent        - Concurrent requests to send to the NPM.
  --cache-ignore         - Ignore cache (default: false)

NOTE:
  Any above configuration can be stored in a config filed at
$HOME/.hs-tools.json. Example: {"ghuser": "user", "ghkey" : "apikey.."}
```
