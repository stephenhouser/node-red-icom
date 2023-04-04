/* ci-v-parser.js -- ICOM CI-V Protocol Parser/Encoder
 *
 * 2023/04/02 Stephen Houser, MIT License
 */

// extracts BCD encoded digits from a buffer
// each digit is encoded in 4 bits, two digits per byte,
// most significant digit first in each byte
// least significant byte first in each sequence
function bcd_reverse2int(buffer) {
	let bcd = '';
	// map to string of hex digits then reorganize digits into string
	// hex digits are the same as the BCD encoding (nicely)
	[...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.forEach(dp => bcd = dp[0] + dp[1] + bcd);

	return parseInt(bcd);
}

function bcd2int(buffer) {
	let bcd = '';
	[...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.forEach(dp => bcd = bcd + dp[0] + dp[1]);

	return parseInt(bcd);
}

function frequency_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const field = action[2] ? action[2] : 'frequency';
		obj[field] = bcd_reverse2int(buffer);	
	}

	return obj;
}

// decodes BCD 0000 ~ 0255 <- in reverse order from above
function bcd_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const field = action[2];
		obj[field] = bcd2int(buffer);	
	}
	
	return obj;
}
	
function bool_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const field = action[2] ? action[2] : 'status';
		obj[field] = buffer.readUint8(0) == 0x01 ? 'on' : 'off';
	}
	
	return obj;
}

function table_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const idx = buffer.readUint8(0);
		const field = action[2] ? action[2] : 'status';
		const table = action[3] ? action[3] : ['off', 'on'];
		obj[field] = table[idx];
	}
	
	return obj;
}

// command 0x1a 0x06 set/read data mode
function data_mode_decoder(buffer, action) {
	const data_modes = ['off', 'on'];
	const data_filter = [null, 'filter-1', 'filter-2', 'filter-3'];

	const obj = {}
	if (buffer && buffer.length) {
		const mode = buffer.readUint8(0);
		obj['data_mode'] = data_modes[mode];

		if (mode) {
			const filter = buffer.readUint8(1);
			obj['filter'] = data_filter[filter];
		}
	}
	
	return obj;
}

function rit_frequency_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const frequency = bcd_reverse2int(buffer.slice(0, 2));
		const sign = buffer.readUint8(2);
		const field = action[2] ? action[2] : 'frequency';
		obj[field] = sign ? -frequency : frequency;
	}

	return obj;
}

function tone_frequency_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const frequency = bcd2int(buffer);
		const field = action[2] ? action[2] : 'frequency';
		obj[field] = frequency / 10.0;
	}

	return obj;
}
 
function empty_decoder(buffer, action) {
	if (!buffer || buffer.length == 0) {
		return {};
	}

	return { payload: buffer };
}

const civ_command_tree = {
//	0x00: ['send-frequency', (b) => ({'frequency': bcd_decoder(b)})],
	0x00: ['send-frequency', frequency_decoder],
	0x01: ['send-mode-data'],
	0x02: ['read-band-edge'],
	0x03: ['read-operating-frequency', frequency_decoder],
	0x04: ['read-operating-mode'],
	0x05: ['set-operating-frequency'],
	0x06: ['set-operating-mode'],
	0x07: ['select-vfo-mode', {
		0x00: ['select-vfo-a'],
		0x01: ['select-vfo-b'],
		0xa0: ['equalize-vfo-a-b'],
		0xb0: ['echange-vfo-a-b']
		}],
	0x08: ['select-memory-mode', {
		0xa0: ['select-memory-group']
	}],
	0x09: ['memory-write'],
	0x0a: ['memory-copy-to-vfo'],
	0x0b: ['memory-clear'],
	0x0c: ['read-frequency-offset'],
	0x0d: ['send-frequency-offset'],
	0x0e: ['scan', {
		0x00: ['cancel-scan'],
		0x01: ['start-programmed-memory-scan'],
		0x02: ['start-programmed-scan'],
		0x03: ['start-delta-frequency-scan'],
		0x12: ['start-fine-programmed-scan'],
		0x13: ['start-fine-delta-frequency-scan'],
		0x22: ['start-memory-scan'],
		0x23: ['start-select-memory-scan'],
		0x24: ['start-mode-select-scan'],
		//0xan: ['start delta-frequency-scan'],
		0xb0: ['clear-select-channel'],
		0xb1: ['set-select-channel'],
		0xb2: ['set-select-memory-channel'],
		0xd0: ['set-scan-resume-off'],
		0xd3: ['set-scan-resume-on'],
	}],
	0x0f: ['split'],
	// {
	// 	0x00: ['split-off'],
	// 	0x01: ['split-function'],
	// 	0x10: ['simplex'],
	// 	0x11: ['duplex-minus'],
	// 	0x12: ['duplex-plus'],
	// }],	
	0x10: ['tuning-step'],
	0x11: ['attenuator'],
	0x13: ['speech', {
		0x00: ['speech-all-data'],
		0x01: ['speech-all-frequency'],
		0x02: ['specch-all-mode'],
	}],
	0x14: ['levels-TBD'],
	0x15: ['read_0x15', {
		0x01: ['read-s-meter-squelch'],
		0x02: ['read-s-meter-level', bcd_decoder, 'level'],
		0x05: ['read-various-squelch'],
		0x07: ['read-overflow-status'],
		0x11: ['read-po-level'],
		0x12: ['read-swr-level'],
		0x13: ['read-alc-level'],
		0x14: ['read-comp-level'],
		0x15: ['read-vd-level'],
		0x16: ['read-id-level'],
	}],
	0x16: ['0x16', {
		0x02: ['preamp', table_decoder, 'status', ['off', 'p.amp1', 'p.amp2']],
		0x12: ['agc-time', (b) => ({'status': table_decoder(b, [null, 'fast', 'mid', 'slow'])})],
		0x22: ['noise-blanker', bool_decoder],
		0x40: ['noise-reduction', bool_decoder],
		0x41: ['auto-notch', bool_decoder],
		0x42: ['repeater-tone', bool_decoder],
		0x43: ['tone-squelch', bool_decoder],
		0x44: ['speech-compressor', bool_decoder],
		0x45: ['monitor', bool_decoder],
		0x46: ['vox', bool_decoder],
		0x47: ['break-in', table_decoder, 'status', ['off', 'semi', 'full']],
		0x48: ['manual-notch', bool_decoder],
		0x4b: ['dtcs', bool_decoder],
		0x4f: ['twin-peak-filter', bool_decoder],
		0x50: ['dial-lock', bool_decoder],
		0x56: ['dsp-if-filter', table_decoder, 'status', ['sharp', 'soft']],
		0x57: ['manual-notch-width', table_decoder, 'status', ['wide', 'mid', 'narrow']],
		0x58: ['ssb_transmit_bandwidth', table_decoder, 'status', ['wide', 'mid', 'narrow']],
		0x5b: ['dsql-squelch', table_decoder, 'status', ['off', 'dqsl', 'cqsl']],
		0x5c: ['gps_transmit-mode', table_decoder, 'status', ['off', 'd-prs', 'nmea']],
		0x5d: ['tone-squelch', table_decoder, 'status', ['off', 'tone', 'tqsl', 'dtcs']],
	}],
	0x17: ['send-cw-message'],
	0x18: ['power', {
		0x00: ['power-off'],
		0x01: ['power-on']
	}],
	0x19: ['read-transceiver-id'],
	0x1a: ['read_0x1a', {
		0x00: ['memory'],
		0x01: ['stacking-register'],
		0x02: ['memory-keyer'],
		0x03: ['if-filter-width'],
		0x04: ['agc-time-constant'],
		0x05: ['set', {
			0x00: ['set', {
				0x46: ['set-function-split'],
			}],
			0x01: ['connectors', {
				0x19: ['mod-input', bool_decoder]
			}]
		}],
		0x06: ['data-mode', data_mode_decoder],
		0x07: ['ntp-access', table_decoder, 'status', ['terminate', 'initiate']],
		0x08: ['ntp-access-status', table_decoder, 'status', ['accessing', 'success', 'failed']],
		0x09: ['ovf-indicator', bool_decoder],
		0x0a: ['share-pictures', table_decoder, 'status', ['off', 'on', 'on-repeat']],
		0x0b: ['power-supply', table_decoder, 'type', ['external', 'battery']],
	}],
	0x1b: ['0x1b', {
		0x00: ['repeater-tone-frequency', tone_frequency_decoder, 'frequency'],
		0x01: ['tqsl-tone-frequency', tone_frequency_decoder, 'frequency'],
		0x02: ['dtcs-code'],
		0x07: ['csql-code'],
	}],
	0x1c: ['read_status', {
		0x00: ['transceiver-status', table_decoder, 'status', ['rx', 'tx']],
		0x01: ['antenna-tuner-status', table_decoder, 'status', ['off', 'on', 'tune']],
		0x02: ['transmit-frequency-monitor', bool_decoder],
		0x03: ['transmit-frequency', frequency_decoder],
	}],
	0x21: ['', {
		0x00: ['rit-frequency', rit_frequency_decoder],
		0x01: ['rit-setting', bool_decoder],
		0x02: ['delta-tx-setting', bool_decoder],
	}],
	0x27: ['scope-waveform'],
	0xfa: ['fail'],
	0xfb: ['ok']
};

function command_decoder(buffer) {
	let decoded = {};
	let command_tree = civ_command_tree;
	let command_code = 0;
	let command_index = 0;

	let local_command_code = buffer.readUint8(command_index++);
	while (local_command_code in command_tree) {
		command_code = command_code << 8 | local_command_code & 0xff;

		[command_name, action] = command_tree[local_command_code];
		if (!action) {
			// no decoder for this command, use empty_decoder
			decoded = empty_decoder(buffer.slice(command_index));
			decoded.command = command_name;
			break;
		}

		if (typeof(action) == 'function') {
			// use found decoder
			decoded = action(buffer.slice(command_index), command_tree[local_command_code]);
			decoded.command = command_name;
			break;
		}

		// action was another dictionary/object, keep looking for 
		// a decoder function down the parse tree
		command_tree = action;
		local_command_code = buffer.readUint8(command_index++);
	}

	// if we did not find a decoder, use default empty_decoder
	if (!decoded.command) {
		decoded = empty_decoder(buffer.slice(command_index));
	}

	decoded.command_code = command_code;
	return decoded;
}

function decode(buffer) {
	if (!buffer || buffer.length < 6) {
		// must have at least: header, destination, source, command, trailer
		return decoded;
	}

	if (buffer.readUint16LE(0, true) != 0xfefe) {
		// invalid header
		return {};
	}

	if (buffer.readUint8((buffer.length - 1), true) != 0xfd) {
		// invalid trailer
		return {};
	}

	const decoded = command_decoder(buffer.slice(4, (buffer.length - 1)));
	decoded.source = buffer.readUint8(3);
	decoded.destination = buffer.readUint8(2);

	if (!decoded.command) {
		decoded.command = 'command-0x' + decoded.command_code.toString(16).padStart(2, 0);
	}

	return decoded;
}

function encode(msg) {
	console.log('Encoding not implemented.');
	return null;
}

module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	// decode: (buffer) => new ICOMCIVParser().decode(buffer),
	decode: decode,
	
	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: encode,
};