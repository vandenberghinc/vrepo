/*
 * @author: Daan van den Bergh
 * @copyright: © 2024 - 2024 Daan van den Bergh.
 */

// ---------------------------------------------------------
// Imports.

const {vlib} = require("./vinc.js");
const gitignore = require("ignore");

// ---------------------------------------------------------
// The git class.

class Git {
    constructor({
        source = null,
        username = null,
        email = null,
    } = {}) {

        // Verify arguments.
        vlib.scheme.verify({
            object: arguments[0],
            check_unknown: true,
            scheme: {
                source: "string",
                username: "string",
                email: "string",
            },
        })

        // Parameters.
        this.source = new vlib.Path(source).abs()
        this.username = username;
        this.email = email;

        // Git ignore file.
        this.gitignore = gitignore()
        const gitignore_path = this.source.join(".gitignore");
        if (gitignore_path.exists()) {
            // since ignore lib does not work with ending slashes we need to trim it.
            let filtered = "";
            const data = gitignore_path.load_sync();
            for (let line of data.split("\n")) {
                line = line.trim();
                if (line.length > 0) {
                    // while (line.length > 0 && line.first() === "/") {
                    //     line = line.substr(1, line.length);
                    // }
                    while (line.length > 0 && line.last() === "/") {
                        line = line.substr(0, line.length - 1);
                    }
                    filtered += line + "\n";
                }
            }
            this.gitignore.add(filtered)
        }

        // Process.
        this.proc = new vlib.Proc();
    }

    // Git preperation.
    async _git_prepare(remote, dest, branch) {
        return new Promise(async (resolve) => {

            // Vars.
            let err = "";
            let code = 0;

            // Set handlers.
            this.proc.on_output = (data) => {
            }
            this.proc.on_error = (data) => {
                err += data;
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code != 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }

            remote = remote.trim();
            dest = dest.trim();
            branch = branch.trim();

            // Check username and email.
            if (this.username == null) {
                return resolve("There is no git username defined.");

            } else if (this.email == null) {
                return resolve("There is no git email defined.");
            }

            // Create a github repo.
            const git = this.source.join(`/.git`)
            if (!git.exists()) {
                await this.proc.start({
                    command: "git",
                    args: ["init"],
                    working_directory: this.source.str(),
                    interactive: false,
                    env: {
                         ...process.env,
                        "GIT_TERMINAL_PROMPT": "0",
                    },
                })
                if (err.length > 0) {
                    return resolve("Failed to create a git repository:\n" + err);
                }
            }

            // Set username and email.
            await this.proc.start({
                command: "bash",
                args: ["-c", `git config --global user.email "${this.email}" && git config --global user.name "${this.username}"`],
                working_directory: this.source.str(),
                interactive: false,
                env: {
                     ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (err.length > 0) {
                return resolve("Failed to set the git username and email:\n" + err);
            }

            // Set the remote.
            await this.proc.start({
                command: "git",
                args: ["remote", "set-url", remote, dest],
                working_directory: this.source.str(),
                interactive: false,
                env: {
                     ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (err.indexOf("error: No such remote ") !== -1) {
                err = "";
                await this.proc.start({
                    command: "git",
                    args: ["remote", "add", remote, dest],
                    working_directory: this.source.str(),
                    interactive: false,
                    env: {
                         ...process.env,
                        "GIT_TERMINAL_PROMPT": "0",
                    },
                })
            }
            if (err.length > 0) {
                return resolve("Failed to set the git origin:\n" + err);
            }

            // Switch to branch.
            await this.proc.start({
                command: "git",
                args: ["checkout", branch],
                working_directory: this.source.str(),
                interactive: false,
                env: {
                     ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (err.indexOf(`Already on '${branch}'`) !== -1) {
                err = "";
            }
            else if (err.indexOf(`error: pathspec '${branch}'`) !== -1) {
                err = "";
                await this.proc.start({
                    command: "git",
                    args: ["checkout", "-b", branch],
                    working_directory: this.source.str(),
                    interactive: false,
                    env: {
                         ...process.env,
                        "GIT_TERMINAL_PROMPT": "0",
                    },
                })
                if (err.indexOf(`Switched to a new branch '${branch}'`) !== -1) {
                    err = "";
                }
            }
            if (err.length > 0) {
                return resolve("Failed to set the git branch:\n" + err);
            }
            resolve();
        })
    }

    // Push through git.
    async push({remote, dest, branch, forced = false, ensure_push = false, log_level = 0}) {
        return new Promise(async (resolve) => {

            // Vars.
            let err = "";
            let code = 0;

            // Prepare.
            err = await this._git_prepare(remote, dest, branch);
            if (err) {
                return resolve(err);
            }
            err = "";

            // Set handlers.
            // let nothing_to_commit = false;
            this.proc.on_output = (data) => {
                if (log_level >= 1) {
                    console.log(data)
                }
                // if (data.indexOf("nothing to commit, working tree clean\n") !== -1) {
                //     nothing_to_commit = true;
                // }
            }
            this.proc.on_error = (data) => {
                if (log_level >= 1) {
                    console.log(data)
                }
                err += data;
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code != 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }

            // Replace the {{VERSION}} tag in the README.md.
            const npm_config_path = this.source.join(`package.json`);
            if (npm_config_path.exists()) {
                const version = JSON.parse(npm_config_path.load_sync()).live_version;
                if (version) {
                    const readme = this.source.join(`README.md`);
                    if (readme.exists()) {
                        await readme.save(
                            (await readme.load()).replaceAll("{{VERSION}}", version)
                        );
                    }
                }
            }

            // Ensure push.
            if (ensure_push) {
                const gitignore_path = this.source.join(".gitignore");
                if (gitignore_path.exists()) {
                    let data = gitignore_path.load_sync();
                    if (data.last() === " ") {
                        data = data.substr(0, data.length - 1);
                    } else {
                        data += " ";
                    }
                    gitignore_path.save_sync(data);
                } else {
                    gitignore_path.save_sync("");
                }
            }

            // Add all data.
            if (log_level >= 1) {
                console.log(`Executing ($ git add).`)
            }
            await this.proc.start({
                command: "git",
                args: ["add", "-A"],
                working_directory: this.source.str(),
                interactive: false,
                env: {
                     ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (log_level >= 1) {
                console.log(`Command ($ git add) exited with code ${code}.`)
            }
            if (err.length > 0) {
                return resolve("Failed to add files to the git repository:\n" + err);
            }

            // Commit.
            if (log_level >= 1) {
                console.log(`Executing ($ git commit).`)
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code > 1 && err == "") { // returns error code 1 if there is nothing to commit.
                    err += `Child process exited with code ${code}.`;
                }
            }
            await this.proc.start({
                command: "git",
                args: ["commit", "-m", "Automatic updates"],
                working_directory: this.source.str(),
                interactive: false,
                env: {
                    ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (log_level >= 1) {
                console.log(`Command ($ git commit) exited with code ${code}.`)
            }
            if (err.length > 0) {
                return resolve("Failed to commit to the git repository:\n" + err);
            }

            // Push.
            if (log_level >= 1) {
                console.log(`Executing ($ git push).`)
            }
            err = "";
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code > 0) {
                    err += `Child process exited with code ${code}.`;
                }
            }
            const args = ["push", "-u", remote, branch];
            if (forced) { args.push("-f"); }
            await this.proc.start({
                command: "git",
                args: args,
                working_directory: this.source.str(),
                interactive: false,
                env: {
                    ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (log_level >= 1) {
                console.log(`Command ($ git push) exited with code ${code}.`)
            }
            if (code > 0) {
                return resolve("Failed to push the git repository:\n" + err);
            }
            resolve();
        })
    }

    // Pull through git.
    async pull({remote, dest, branch, forced = false}) {
        return new Promise(async (resolve) => {

            // Vars.
            let err = "";
            let code = 0;

            // Prepare.
            err = await this._git_prepare(remote, dest, branch);
            if (err) {
                return resolve(err);
            }
            err = "";

            // Set handlers.
            this.proc.on_output = (data) => {
            }
            this.proc.on_error = (data) => {
                err += data;
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code != 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }

            // Pull.
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code > 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }
            const args = ["pull", remote, branch];
            if (forced) { args.push("-f"); }
            await this.proc.start({
                command: "git",
                args: args,
                working_directory: this.source.str(),
                interactive: false,
                env: {
                     ...process.env,
                    "GIT_TERMINAL_PROMPT": "0",
                },
            })
            if (err.length > 0 || code != 0) {
                return resolve("Failed to pull the git repository:\n" + err);
            }
            resolve();
        })
    }

    // Remove commit history.
    async remove_commit_history({branch}) {
        return new Promise(async (resolve) => {

            // Vars.
            let err = "";
            let code = 0;

            // Commands.
            const commands = [
                ["checkout", "--orphan", "tmp-branch", "-q"],
                ["add", "-A"],
                ["commit", "-am", "Initial Commit", "-q"],
                ["branch", "-D", branch, "-q"],
                ["branch", "-m", branch],
                // ["push", "-f", "origin", branch]
            ]

            // Set handlers.
            this.proc.on_output = (data) => {
            }
            this.proc.on_error = (data) => {
                err += data;
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code != 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }

            // Pull.
            for (let i = 0; i < commands.length; i++) {
                await this.proc.start({
                    command: "git",
                    args: commands[i],
                    working_directory: this.source.str(),
                    interactive: false,
                    env: {
                         ...process.env,
                        "GIT_TERMINAL_PROMPT": "0",
                    },
                })
                if (err.length > 0 || code != 0) {
                    return resolve("Failed to remove the commit history:\n" + err);
                }
            }
            resolve();
        })
    }   

    // Remove cache.
    async remove_cache() {
        return new Promise(async (resolve) => {

            // Vars.
            let err = "";
            let code = 0;

            // Commands.
            const commands = [
                ["rm", "-r", "--cached", "."],
            ]

            // Set handlers.
            this.proc.on_output = (data) => {
            }
            this.proc.on_error = (data) => {
                err += data;
            }
            this.proc.on_exit = (_code) => {
                code = _code;
                if (code != 0 && err == "") {
                    err += `Child process exited with code ${code}.`;
                }
            }

            // Pull.
            for (let i = 0; i < commands.length; i++) {
                await this.proc.start({
                    command: "git",
                    args: commands[i],
                    working_directory: this.source.str(),
                    interactive: false,
                    env: {
                         ...process.env,
                        "GIT_TERMINAL_PROMPT": "0",
                    },
                })
                if (err.length > 0 || code != 0) {
                    return resolve("Failed to remove the commit history:\n" + err);
                }
            }
            resolve();
        })
    }

    // Is ignored by gitignore.
    is_ignored(path, _is_relative = false) {
        if (path instanceof vlib.Path) {
            path = path.str();
        }
        return this.gitignore.ignores(
            _is_relative 
            ? path
            : new vlib.Path(path).abs().str().substr(this.source.str().length + 1)
        );
    }

    // List large files.
    async list_large_files({exclude = [], limit = 25, gitignore = true, directories = false}) {

        // Iterate files.
        const sizes = [];
        const paths = await this.source.paths({recursive: true, absolute: true, exclude});
        for (const path of paths) {
            if ((directories || !path.is_dir()) && !exclude.includes(path.str())) {
                sizes.append([path.size, path]);
            }
        }

        // Sort files.
        sizes.sort((a, b) => b[0] - a[0]);

        // Dump non ignored till limit.
        const list = [];
        let listed = 0;
        for (const [size, path] of sizes) {
            if (!gitignore || !this.is_ignored(path)) {
                list.append({path, size});
                ++listed;
                if (listed >= limit) {
                    break;
                }
            }
        }
        return list;
    }
}

// ---------------------------------------------------------
// Exports.

module.exports = Git;