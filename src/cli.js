#!/usr/bin/env node

// ---------------------------------------------------------
// Libraries.

const {vlib} = require("./vinc.js");
const Repo = require("./repo.js");

// ---------------------------------------------------------
// CLI.

// const repo = new Repo({
//     source: "/Users/administrator/persistance/private/dev/libris/libris/",
//     npm: false,
// })
// console.log(repo.git.is_ignored("/Users/administrator/persistance/private/dev/libris/libris/lpm/weights/somedir"))
// console.log(repo.git.is_ignored("/Users/administrator/persistance/private/dev/libris/libris/lpm/weights"))
// console.log(repo.git.is_ignored("/Users/administrator/persistance/private/dev/libris/libris/.git/x"))
// process.exit(1)

const cli = new vlib.CLI({name: "vrepo", version: "1.0.0", commands: [

    // Push.
    {
        id: "--push",
        description: "Push the current project to one or multiple remotes.",
        examples: {
            "Push": "vrepo --push --git origin --ssh myserver,mybackupserver --del --forced",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the package."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the package."},
            {id: "--git", type: "array", description: "Push to all git or a list of specific git remotes.", default: []},
            {id: "--ssh", type: "array", description: "Push to all ssh or a list of specific ssh remotes.", default: []},
            {id: ["--forced", "-f"], type: "boolean", description: "Push with git in forced mode."},
            {id: ["--del", "-d"], type: "boolean", description: "Push with ssh in delete mode."},
            {id: ["--ensure-push", "-e"], type: "boolean", description: "Ensure a git push by editing the gitignore safely."},
            {id: ["--log-level", "-l"], type: "number", description: "The log level."},
        ],
        callback: async ({
            source = null,
            sources = null,
            git = null,
            ssh = null,
            forced = false,
            del = false,
            ensure_push = false,
            log_level = 0,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });

                // Build the selected git and ssh remotes.
                let ssh_remotes = [], git_remotes = [];

                // Build git remotes.
                if (Array.isArray(git) && git.length > 0) {
                    // Add specified git remotes.
                    git.iterate((remote) => {
                        const found = repo.config.git.remotes.iterate((item) => {
                            if (item.remote === remote) {
                                git_remotes.push(item);
                                return true;
                            }
                        })
                        if (!found) {
                            cli.throw_error(`Git remote "${remote}" does not exist.`);
                        }
                    })
                }
                else if (Array.isArray(git) && git.length === 0) {
                    // Add all git remotes.
                    git_remotes = repo.config.git.remotes;
                }

                // Build ssh remotes.
                if (Array.isArray(ssh) && ssh.length > 0) {
                    // Add specified ssh remotes.
                    ssh.iterate((alias) => {
                        const found = repo.config.ssh.remotes.iterate((item) => {
                            if (item.alias === alias) {
                                ssh_remotes.push(item);
                                return true;
                            }
                        })
                        if (!found) {
                            cli.throw_error(`SSH remote "${alias}" does not exist.`);
                        }
                    })
                }
                else if (Array.isArray(ssh) && ssh.length === 0) {
                    // Add all ssh remotes.
                    ssh_remotes = repo.config.ssh.remotes;
                }

                // Add all remotes when no specific remotes are defined.
                if (git == null && ssh == null) {
                    ssh_remotes = repo.config.ssh.remotes;
                    git_remotes = repo.config.git.remotes;
                }
                
                // Push all remotes.
                for (const remote of git_remotes) {
                    vlib.print_marker(`Pushing ${vlib.color.bold(repo.name)} branch "${remote.branch}" to "${remote.remote} ${remote.destination}" (git).`);
                    try {
                        const err = await repo.git.push({
                            remote: remote.remote,
                            dest: remote.destination,
                            branch: remote.branch,
                            forced,
                            ensure_push,
                            log_level,
                        })
                        if (err) {
                            cli.throw_error(err);
                        }
                    } catch (err) {
                        cli.throw_error(err);
                    }
                }
                for (const remote of ssh_remotes) {
                    vlib.print_marker(`Pushing ${vlib.color.bold(repo.name)} to ${vlib.color.bold(remote.alias)}:${remote.destination} (ssh).`);
                    try {
                        const err = await repo.ssh.push(remote.alias, remote.destination, del)
                        if (err) {
                            cli.throw_error(err);
                        }
                    } catch (err) {
                        cli.throw_error(err);
                    }
                }
            }
        }
    },

    // Pull.
    {
        id: "--pull",
        description: "Pull the current project from one of the remotes.",
        examples: {
            "Pull": "vrepo --pull --ssh myserver --del",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
            {id: "--git", type: "array", description: "Pull from all git or a list of specific git remotes.", default: []},
            {id: "--ssh", type: "array", description: "Pull from all ssh or a list of specific ssh remotes.", default: []},
            {id: ["--forced", "-f"], type: "boolean", description: "Pull with git in forced mode."},
            {id: ["--del", "-d"], type: "boolean", description: "Pull with ssh in delete mode."},
        ],
        callback: async ({
            source = null,
            sources = null,
            git = null,
            ssh = null,
            forced = false,
            del = false,
            _command = null,
        }) => {

            // Check args.
            if (git == null && ssh == null || (git != null && ssh != null)) {
                cli.error(`Define either parameter "git" or "ssh".`);
                cli.docs(_command);
                process.exit(1);
            }

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });

                // Pull through git.
                if (git != null) {
                    let remote;
                    const found = repo.config.git.remotes.iterate((item) => {
                        if (item.remote === git) {
                            remote = item;
                            return true;
                        }
                    })
                    if (!found) {
                        cli.throw_error(`Git remote "${git}" does not exist.`);
                    }
                    vlib.print_marker(`Pulling ${vlib.color.bold(repo.name)} branch "${remote.branch}" from "${remote.remote}" "${remote.destination}" (git).`);
                    try {
                        const err = await repo.git.pull({remote: remote.remote, dest: remote.destination, branch: remote.branch, forced})
                        if (err) {
                            cli.throw_error(err);
                        }
                    } catch (err) {
                        cli.throw_error(err);
                    }
                }

                // Pull through ssh.
                else {
                    let remote;
                    const found = repo.config.ssh.remotes.iterate((item) => {
                        if (item.alias === ssh) {
                            remote = item;
                            return true;
                        }
                    })
                    if (!found) {
                        cli.throw_error(`SSH remote "${git}" does not exist.`);
                    }
                    vlib.print_marker(`Pulling ${vlib.color.bold(repo.name)} from ${vlib.color.bold(remote.alias)}:${remote.destination} (ssh).`);
                    try {
                        const err = await repo.ssh.pull(remote.alias, remote.destination, del)
                        if (err) {
                            cli.throw_error(err);
                        }
                    } catch (err) {
                        cli.throw_error(err);
                    }
                }
            }
        }
    },

    // Publish.
    {
        id: "--publish-npm",
        description: "Publish a npm package.",
        examples: {
            "Publish": "vrepo --publish-npm",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
        ],
        callback: async ({
            source = null,
            sources = null,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    git: false,
                    ssh: false,
                });
                vlib.print_marker(`Publishing npm package ${vlib.color.bold(repo.npm.config.name + "@" + repo.npm.config.version)}.`);
                try {
                    await repo.npm.publish();
                } catch (err) {
                    cli.throw_error(err);
                }
            }
        }
    },

    // Add remote.
    {
        id: "--add-remote",
        description: "Add a remote.",
        examples: {
            "Add ssh remote": "vrepo --add-remote --ssh myalias:./destination",
            "Add ssh remote": "vrepo --add-remote --git --remote origin --destination git@github.com:username/project.git --branch main",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--ssh", type: "string", description: "The ssh alias and destination formatted like <alias>:<destination>"},
            {id: "--git", type: "boolean", description: "Add a git remote."},
            {id: "--remote", type: "string", description: "The git branch, by default \"origin\"."},
            {id: "--destination", type: "string", description: "The git destination."},
            {id: "--branch", type: "string", description: "The git branch, by default \"main\"."},
        ],
        callback: ({
            source = null,
            ssh = null,
            git = null,
            remote = "origin",
            destination = null,
            branch = "main",
            _command = null,
        }) => {

            // Create sources array.
            if (typeof source !== "string") {
                source = "./";
            }

            // Init repo.
            const repo = new Repo({
                source,
                c
            });
                    
            // Add ssh remote.
            if (ssh !== null) {
                const split = ssh.split(":");
                if (split.length < 2) {
                    cli.error(`Invalid value for parameter "ssh", the parameter value must be formatted like "<alias>:<destination>".`);
                    cli.docs(_command);
                    process.exit(1);
                }
                const remote = {
                    alias: split[0],
                    destination: split[1],
                    enabled: true,
                }
                vlib.print_marker(`Adding ssh remote "${remote.alias}:${remote.destination}" to "${repo.name}".`);
                const duplicate = repo.config.ssh.remotes.iterate((item) => {
                    if (item.alias === remote.alias && item.destination === remote.destination) {
                        return true;
                    }
                })
                if (duplicate !== true) {
                    repo.config.ssh.remotes.push(remote);
                }
            }

            // Add git remote.
            else if (git !== null) {

                // Check args.
                if (destination == null) {
                    cli.error(`Define parameter "--destination" (string).`);
                    cli.docs(_command);
                    process.exit(1);
                }

                // Create remote.
                const item = {
                    remote: remote,
                    destination: destination,
                    branch: branch,
                    enabled: true,
                }
                vlib.print_marker(`Adding git remote "${item.remote}:${item.destination}:${item.branch}" to "${repo.name}".`);
                const duplicate = repo.config.git.remotes.iterate((item) => {
                    if (item.remote === item.remote && item.destination === item.destination && item.branch === item.branch) {
                        return true;
                    }
                })
                if (duplicate !== true) {
                    repo.config.git.remotes.push(item);
                }
            }

            // Invalid args.
            else {
                cli.error(`Define either parameter "git" or "ssh".`);
                cli.docs(_command);
                process.exit(1);
            }

            // Save.
            try {
                repo.save()
            } catch (err) {
                cli.throw_error(err);
            }
        }
    },

    // Get remotes.
    {
        id: "--remotes",
        description: "Get the registered remotes.",
        examples: {
            "Get remotes": "vrepo --remotes",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
            {id: "--git", type: "bool", description: "Only show the git remotes."},
            {id: "--ssh", type: "bool", description: "Only show the ssh remotes."},
        ],
        callback: ({
            source = null,
            sources = null,
            git = false,
            ssh = false,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });
                vlib.print_marker(repo.name, ":");
                if (git || (git === false && ssh == false)) {
                    repo.config.git.remotes.iterate((item) => {
                        console.log(`    * ${item.branch} ${item.remote}:${item.destination} (git)`);
                    })
                }
                if (ssh || (git === false && ssh == false)) {
                    repo.config.ssh.remotes.iterate((item) => {
                        console.log(`    * ${item.alias}:${item.destination} (ssh)`);
                    })
                }
            }
        }
    },

    // Remove commit history.
    {
        id: "--remove-commit-history",
        description: "Remove the commit history.",
        examples: {
            "Remove commit history": "vrepo --remove-commit-history",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
        ],
        callback: async ({
            source = null,
            sources = null,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });
                vlib.print_marker(`Removing the git commit history of package ${vlib.color.bold(repo.name)}.`);
                let remote;
                const found = repo.config.git.remotes.iterate((item) => {
                    if (item.branch != null) {
                        remote = item;
                        return true;
                    }
                })
                if (!found) {
                    cli.throw_error(`Git remote "${git}" does not exist.`);
                }
                await repo.git.remove_commit_history({branch: remote.branch})
            }
        }
    },

    // Remove git cache.
    {
        id: "--remove-git-cache",
        description: "Remove the git cache.",
        examples: {
            "Remove git cache": "vrepo --remove-git-cache",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
        ],
        callback: async ({
            source = null,
            sources = null,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });
                vlib.print_marker(`Removing the git cache of package ${vlib.color.bold(repo.name)}.`);
                repo.git.remove_cache()
            }
        }
    },

    // List large files.
    {
        id: "--list-large-files",
        description: "List large files optionally with a gitignore filter.",
        examples: {
            "List large files": "vrepo --list-large-files --gitnore",
        },
        args: [
            {id: "--source", type: "string", description: "The source path to the package, when undefined the current working directory will be used as the source path."},
            {id: "--sources", type: "array", description: "The source paths to multiple packages, when undefined the argument --source or the current working directory will be used as the source path."},
            {id: "--exclude", type: "array", description: "Exclude file paths."},
            {id: "--limit", type: "number", description: "The maximum number of files to list."},
            {id: ["--gitignore", "-g"], type: "boolean", description: "Enable the gitignore filter."},
            {id: ["--directories", "-d"], type: "boolean", description: "Also include directories."},
        ],
        callback: async ({
            source = null,
            sources = null,
            exclude = [],
            limit = 25,
            gitignore = false,
            directories = false,
        }) => {

            // Create sources array.
            all_sources = [];
            if (typeof source === "string") {
                all_sources.append(source);
            } else if (Array.isArray(sources)) {
                all_sources.append(...sources);
            } else {
                all_sources.append("./");
            }

            // Iterate sources array.
            for (const source of all_sources) {
                const repo = new Repo({
                    source,
                    npm: false,
                });
                vlib.print_marker(repo.name, ":");
                const list = await repo.git.list_large_files({
                    limit,
                    exclude,
                    gitignore,
                    directories,
                })
                list.iterate(({path, size}) => {
                    console.log(`    * ${path}: ${vlib.utils.format_bytes(size)}.`);
                })
            }
        }
    },
]});

// Start.
cli.start();