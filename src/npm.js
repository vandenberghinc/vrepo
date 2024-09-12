/*
 * @author: Daan van den Bergh
 * @copyright: © 2024 - 2024 Daan van den Bergh.
 */

// ---------------------------------------------------------
// Imports.

const {vlib} = require("./vinc.js");

// ---------------------------------------------------------
// The npm class.

class NPM {
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

        // Config file.
        this.config_path = this.source.join(`/package.json`);
        if (!this.config_path.exists()) {
            throw new Error(`NPM configuration file "${this.config_path.str()}" does not exist.`);
        }
        this.config = JSON.parse(this.config_path.load_sync());
    }

    // Check if the user is logged in.
    async logged_in() {
        return new Promise(async (resolve) => {
            const proc = new vlib.Proc();
            await proc.start({
                command: "npm",
                args: ["whoami"],
                working_directory: this.source.str(),
                interactive: false,
            })
            if (proc.exit_status !== 0) {
                return resolve(false);
            }
            resolve(true);
            // resolve(proc.out.trim() == this.username);
        });
    }

    // Log a user in.
    async login() {
        return new Promise(async (resolve, reject) => {
            const logged_in = await this.logged_in();
            if (logged_in === false) {
                return reject("No npm user is logged in, execute ($ npm login).")
                // const proc = new vlib.Proc({debug: true});
                // await proc.start({
                //     command: "npm",
                //     args: ["login"],
                //     working_directory: this.source.str(),
                //     interactive: true,
                // })
                // if (proc.exit_status !== 0) {
                //     return reject(proc.err);
                // }
            }
            resolve();
        });
    }

    // Save the config.
    save() {
        this.config_path.save_sync(JSON.stringify(this.config, null, 4));
    }

    // Increment the version.
    async increment_version() {
        return new Promise(async (resolve, reject) => {
            try {

                // Increment the version in package.json.
                this.load();
                let version = this.config.version;
                if (version === undefined) {
                    version = "1.0.0";
                } else {
                    const split = version.split(".").map((x) => parseInt(x));
                    for (let i = split.length - 1; i >= 0; i--) {
                        if (i > 0) {
                            if (split[i] < 9) {
                                ++split[i];
                                break;
                            } else {
                                split[i] = 0;
                            }
                        } else if (i === 0) {
                            ++split[i];
                            break;
                        }
                    }
                    version = split.join(".");
                }
                this.config.live_version = this.config.version;
                this.config.version = version;
                this.save();

                // Resolve.
                resolve();
            } catch(err) {
                return reject(err);
            }
        });
    }

    // Publish a package.
    async publish() {
        return new Promise(async (resolve, reject) => {

            // Log in.
            try {
                await this.login();
            } catch (err) {
                return reject(err);
            }

            // Load the config file.
            this.load();

            // Export version.
            const version_export = this.source.join(".version.js");
            version_export.save_sync(`module.exports="${this.config.version}";`)

            // Link when attribute "bin" is defined in the config.
            if (this.config.bin !== undefined) {
                const proc = new vlib.Proc();
                await proc.start({
                    command: "npm",
                    args: ["link"],
                    working_directory: this.source.str(),
                    interactive: false,
                })
                if (proc.exit_status !== 0) {
                    if (proc.err) {
                        console.log(proc.err);
                    }
                    return reject(proc.err);
                }
            }

            // Replace the {{VERSION}} tag in the README.md.
            const readme = this.source.join(`/README.md`);
            let readme_data;
            if (readme.exists()) {
                readme_data = await readme.load();
                await readme.save(readme_data.replace(/version-.s*-blue/, `badge/version-${this.config.version}-blue`));
            }

            // Publish.
            const proc = new vlib.Proc();
            await proc.start({
                command: "npm",
                args: ["publish"],
                working_directory: this.source.str(),
                interactive: false,
            })
            if (proc.exit_status !== 0) {
                if (proc.err) {
                    console.log(proc.err);
                }
                if (readme_data !== undefined) {
                    await readme.save(readme_data);
                }
                return reject(`Failed to publish pacakge ${this.config.name}.`);
            }

            // Increment version.
            try {
                await this.increment_version();
            } catch (err) {
                if (readme_data !== undefined) {
                    await readme.save(readme_data);
                }
                return reject(err);
            }
            resolve();
        })
    }
}

// ---------------------------------------------------------
// Exports.

module.exports = NPM;