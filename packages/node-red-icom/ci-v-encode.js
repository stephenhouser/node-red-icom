/* ci-v-encode.js - Node-RED node for encoding ICOM CI-V messages
 *
 * 2023/04/02 Stephen Houser, MIT License
 */
const civ = require('@n1sh/icom-ci-v');

module.exports = function(RED) {
	'use strict';

	function CIVEncodeNode(config) {
		RED.nodes.createNode(this, config);

		const node = this;
		node.name = config.name;

		node.on('input', function(msg, send, done) {
			if (typeof(msg.payload) != 'object') {
				throw new Error(`Can only encode objects, ${typeof(msg.payload)} was given.`);
			}

			msg.input = msg.payload;
			msg.payload = civ.encode(msg.payload);
			if (msg.payload && send) {
				send(msg);
			}

			if (done) {
				done();
			}
		});
	}

	RED.nodes.registerType('ci-v-encode', CIVEncodeNode);
};
