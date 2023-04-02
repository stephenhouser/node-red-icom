/* ci-v-decode.js - Node-RED node for decoding ICOM CI-V messages
 *
 * 2023/04/02 Stephen Houser, MIT License
 */
const civ = require('@n1sh/icom-ci-v');

module.exports = function(RED) {
	'use strict';

	function CIVDecodeNode(config) {
		RED.nodes.createNode(this, config);

		const node = this;
		node.name = config.name;

		node.on('input', function(msg, send, done) {
			msg.input = msg.payload;
			const decoded = civ.decode(msg.payload);
			if (decoded && send) {
				msg.payload = decoded;
				// msg.topic = decoded.command;
				send(msg);
			}

			if (done) {
				done();
			}
		});
	}

	RED.nodes.registerType('ci-v-decode', CIVDecodeNode);
};
