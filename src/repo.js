/*
 * Author: Daan van den Bergh
 * Copyright: © 2024 - 2024 Daan van den Bergh.
 */

// Imports.
const {vlib} = require("./vinc.js");
const Git = require("./git.js");
const NPM = require("./npm.js");
const SSH = require("./ssh.js");

// Repo class.
class Repo {
	constructor({
		source,
		git = true, // git enabled.
		ssh = true, // ssh enabled.
		npm = true, // npm enabled.
	} = {}) {

		// Verify arguments.
		vlib.scheme.verify({
			object: arguments[0],
			check_unknown: true,
			scheme: {
				source: "string",
				git: {type: "boolean", default: "boolean"},
				ssh: {type: "boolean", default: "boolean"},
				npm: {type: "boolean", default: "boolean"},
			},
		})

		// Attributes.
		this.source = new vlib.Path(source);
		this.name = this.source.name();
		this.git_enabled = git;
		this.ssh_enabled = ssh;
		this.npm_enabled = npm;

		// Load the config file.
		this.config_path = this.source.join(".vrepo");
		if (!this.config_path.exists()) {
			// throw new Error(`VRepo configuration file "${this.config_path.str()}" does not exist.`);
			this.config = {
				ssh: {
					remotes: [],
				},
				git: {
					username: null,
					email: null,
					remotes: [],
				},
			}
			this.config_path.save_sync(JSON.stringify(this.config))
		} else {
			try {
				this.config = JSON.parse(this.config_path.load_sync());
			} catch (e) {
				e.message = `${this.config_path.abs().str()}: ${e.message}`;
				throw e;
			}
		}
		vlib.scheme.verify({
			object: this.config,
			error_prefix: `${this.config_path.str()}: Invalid vrepo configuration file. `,
			check_unknown: true,
			scheme: {
				ssh: {
					type: "object",
					required: this.ssh_enabled,
					scheme: {
						remotes: {
							type: "array",
							default: [],
							value_scheme: {
								alias: "string",
								destination: "string",
								enabled: {type: "boolean", default: true},
							},
						},
					},
				},
				git: {
					type: "object",
					required: this.git_enabled,
					scheme: {
						username: "string",
						email: "string",
						remotes: {
							type: "array",
							default: [],
							value_scheme: {
								remote: "string",
								branch: "string",
								destination: "string",
								enabled: {type: "boolean", default: true},
							},
						},
					},
				},
			}
		})

		// Initialize sub objects.
		this.git = !this.git_enabled ? undefined : new Git({
			source: this.source.str(),
			username: this.config.git.username,
			email: this.config.git.email,
		});
		this.npm = !this.npm_enabled ? undefined : new NPM({
			source: this.source.str(),
		});
		this.ssh = !this.ssh_enabled ? undefined : new SSH({
			source: this.source.str(),
		});
	}

	// Save config files.
	save() {
		this.source.join(".vrepo").save_sync(JSON.stringify(this.config, null, 4));
		if (this.npm_enabled) {
			this.npm.save();
		}
	}
}

// ---------------------------------------------------------
// Exports.

module.exports = Repo;