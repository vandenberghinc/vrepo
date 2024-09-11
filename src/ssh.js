/*
 * @author: Daan van den Bergh
 * @copyright: © 2024 - 2024 Daan van den Bergh.
 */

// ---------------------------------------------------------
// Imports.

const {vlib} = require("./vinc.js");

// ---------------------------------------------------------
// The ssh class.

class SSH {
    constructor({
        source = null,
    } = {}) {

        // Verify arguments.
        vlib.scheme.verify({
            object: arguments[0],
            check_unknown: true,
            scheme: {
                source: "string",
            },
        })

        // Parameters.
        this.source = new vlib.Path(source);

        // Attributes.
        this.proc = new vlib.Proc();
    }

    // Push through ssh.
    async push(alias, dest, del = false) {
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

            // Trim.
            alias = alias.trim();
            dest = dest.trim();

            // Create args.
            const args = ["-azP", `${this.source.str()}/`, `${alias}:${dest}/`];
            if (del) { args.push("--delete"); }

            // Create a github repo.
            await this.proc.start({
                command: "rsync",
                args: args, // only works in production cause otherwise the terminal where electron was lauched will receive user input prompts.
                // command: `${SETTINGS.app_contents}/lib/non_interactive_exec.sh`,
                // args: ["rsync " + args.join(" ")], // otherwise it will cause weird errors or redirect to process.stdin which cant be fixed.
                working_directory: this.source.str(),
                interactive: false,
            })
            if (code != 0) {
                return resolve("Failed to push the repository over ssh:\n" + err);
            }
            resolve();
        })
    }

    // Push through ssh.
    async pull(alias, src, del = false) {
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

            // Create args.
            const args = ["-azP", `${alias.trim()}:${src.trim()}/`, `${this.source.str()}/`];
            if (del) { args.push("--delete"); }

            // Create a github repo.
            await this.proc.start({
                command: "rsync",
                args: args, // only works in production cause otherwise the terminal where electron was lauched will receive user input prompts.
                // command: `${SETTINGS.app_contents}/lib/non_interactive_exec.sh`,
                // args: ["rsync " + args.join(" ")], // otherwise it will cause weird errors or redirect to process.stdin which cant be fixed.
                working_directory: this.source.str(),
                interactive: false,
            })
            if (code != 0) {
                return resolve("Failed to push the repository over ssh:\n" + err);
            }
            resolve();
        })
    }
}

// ---------------------------------------------------------
// Exports.

module.exports = SSH;