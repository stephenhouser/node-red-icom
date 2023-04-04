/* ci-v-parser.js -- ICOM CI-V Protocol Parser/Encoder
 *
 * 2023/04/02 Stephen Houser, MIT License
 */

const hexy = require("hexy");


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

function bcd_decoder_reverse(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const field = action[2];
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
		const field = action[2];
		obj[field] = buffer.readUint8(0) == 0x01 ? 'on' : 'off';
	}
	
	return obj;
}

function table_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const idx = buffer.readUint8(0);
		const field = action[2];
		const table = action[3];
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

function rit_frequency(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const frequency = bcd_reverse2int(buffer.slice(0, 2));
		const sign = buffer.readUint8(2);
		const field = action[2];
		obj[field] = (sign ? '-' : '') + frequency.toString();
	}

	return obj;
}

function tone_frequency_decoder(buffer, action) {
	const obj = {}
	if (buffer && buffer.length) {
		const frequency = bcd2int(buffer);
		const field = action[2];
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

const command_tree = {
//	0x00: ['send-frequency', (b) => ({'frequency': bcd_decoder(b)})],
	0x00: ['send-frequency', bcd_decoder_reverse, 'frequency'],
	0x01: ['send-mode-data', empty_decoder],
	0x02: ['read-band-edge', empty_decoder],
	0x03: ['read-operating-frequency', bcd_decoder_reverse, 'frequency'],
	0x04: ['read-operating-mode', empty_decoder],
	0x05: ['set-operating-frequency', empty_decoder],
	0x06: ['set-operating-mode', empty_decoder],
	0x07: ['select-vfo-mode', {
		0x00: ['select-vfo-a', empty_decoder],
		0x01: ['select-vfo-b', empty_decoder],
		0xa0: ['equalize-vfo-a-b', empty_decoder],
		0xb0: ['echange-vfo-a-b', empty_decoder]
		}],
	0x08: ['select-memory-mode', {
		0xa0: ['select-memory-group', empty_decoder]
	}],
	0x09: ['memory-write', empty_decoder],
	0x0a: ['memory-copy-to-vfo', empty_decoder],
	0x0b: ['memory-clear', empty_decoder],
	0x0c: ['read-frequency-offset', empty_decoder],
	0x0d: ['send-frequency-offset', empty_decoder],
	0x0e: ['scan', {
		0x00: ['cancel-scan', empty_decoder],
		0x01: ['start-programmed-memory-scan', empty_decoder],
		0x02: ['start-programmed-scan', empty_decoder],
		0x03: ['start-delta-frequency-scan', empty_decoder],
		0x12: ['start-fine-programmed-scan', empty_decoder],
		0x13: ['start-fine-delta-frequency-scan', empty_decoder],
		0x22: ['start-memory-scan', empty_decoder],
		0x23: ['start-select-memory-scan', empty_decoder],
		0x24: ['start-mode-select-scan', empty_decoder],
		//0xan: ['start delta-frequency-scan', empty_decoder],
		0xb0: ['clear-select-channel', empty_decoder],
		0xb1: ['set-select-channel', empty_decoder],
		0xb2: ['set-select-memory-channel', empty_decoder],
		0xd0: ['set-scan-resume-off', empty_decoder],
		0xd3: ['set-scan-resume-on', empty_decoder],
	}],
	0x0f: ['split', empty_decoder],
	// {
	// 	0x00: ['split-off', empty_decoder],
	// 	0x01: ['split-function', empty_decoder],
	// 	0x10: ['simplex', empty_decoder],
	// 	0x11: ['duplex-minus', empty_decoder],
	// 	0x12: ['duplex-plus', empty_decoder],
	// }],	
	0x10: ['tuning-step', empty_decoder],
	0x11: ['attenuator', empty_decoder],
	0x13: ['speech', {
		0x00: ['speech-all-data', empty_decoder],
		0x01: ['speech-all-frequency', empty_decoder],
		0x02: ['specch-all-mode', empty_decoder],
	}],
	0x14: ['levels-TBD', empty_decoder],
	0x15: ['read_0x15', {
		0x01: ['read-s-meter-squelch', empty_decoder],
		0x02: ['read-s-meter-level', bcd_decoder, 'level'],
		0x05: ['read-various-squelch', empty_decoder],
		0x07: ['read-overflow-status', empty_decoder],
		0x11: ['read-po-level', empty_decoder],
		0x12: ['read-swr-level', empty_decoder],
		0x13: ['read-alc-level', empty_decoder],
		0x14: ['read-comp-level', empty_decoder],
		0x15: ['read-vd-level', empty_decoder],
		0x16: ['read-id-level', empty_decoder],
	}],
	0x16: ['0x16', {
		0x02: ['preamp', table_decoder, 'status', ['off', 'p.amp1', 'p.amp2']],
		0x12: ['agc-time', (b) => ({'status': table_decoder(b, [null, 'fast', 'mid', 'slow'])})],
		0x22: ['noise-blanker', bool_decoder, 'status'],
		0x40: ['noise-reduction', bool_decoder, 'status'],
		0x41: ['auto-notch', bool_decoder, 'status'],
		0x42: ['repeater-tone', bool_decoder, 'status'],
		0x43: ['tone-squelch', bool_decoder, 'status'],
		0x44: ['speech-compressor', bool_decoder, 'status'],
		0x45: ['monitor', bool_decoder, 'status'],
		0x46: ['vox', bool_decoder, 'status'],
		0x47: ['break-in', table_decoder, 'status', ['off', 'semi', 'full']],
		0x48: ['manual-notch', bool_decoder, 'status'],
		0x4b: ['dtcs', bool_decoder, 'status'],
		0x4f: ['twin-peak-filter', bool_decoder, 'status'],
		0x50: ['dial-lock', bool_decoder, 'status'],
		0x56: ['dsp-if-filter', table_decoder, 'status', ['sharp', 'soft']],
		0x57: ['manual-notch-width', table_decoder, 'status', ['wide', 'mid', 'narrow']],
		0x58: ['ssb_transmit_bandwidth', table_decoder, 'status', ['wide', 'mid', 'narrow']],
		0x5b: ['dsql-squelch', table_decoder, 'status', ['off', 'dqsl', 'cqsl']],
		0x5c: ['gps_transmit-mode', table_decoder, 'status', ['off', 'd-prs', 'nmea']],
		0x5d: ['tone-squelch', table_decoder, 'status', ['off', 'tone', 'tqsl', 'dtcs']],
	}],
	0x17: ['send-cw-message', empty_decoder],
	0x18: ['power', {
		0x00: ['power-off', empty_decoder],
		0x01: ['power-on', empty_decoder]
	}],
	0x19: ['read-transceiver-id', empty_decoder],
	0x1a: ['read_0x1a', {
		0x00: ['memory', empty_decoder],
		0x01: ['stacking-register', empty_decoder],
		0x02: ['memory-keyer', empty_decoder],
		0x03: ['if-filter-width', empty_decoder],
		0x04: ['agc-time-constant', empty_decoder],
		0x05: ['set', {
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
		0x02: ['dtcs-code', empty_decoder],
		0x07: ['csql-code', empty_decoder],
	}],
	0x1c: ['read_status', {
		0x00: ['transceiver-status', table_decoder, 'status', ['rx', 'tx']],
		0x01: ['antenna-tuner-status', table_decoder, 'status', ['off', 'on', 'tune']],
		0x02: ['transmit-frequency-monitor', bool_decoder, 'status'],
		0x03: ['transmit-frequency', bcd_decoder_reverse, 'frequency'],
	}],
	0x21: ['', {
		0x00: ['rit-frequency', rit_frequency, 'frequency'],
		0x01: ['rit-setting', bool_decoder, 'status'],
		0x02: ['delta-tx-setting', bool_decoder, 'status'],
	}],
	0x27: ['scope-waveform', empty_decoder],
	0xfa: ['fail', empty_decoder],
	0xfb: ['ok', empty_decoder]
};

function merge_keys(dest, other) {
	for (let key in other) {
		if (key == 'command_code' && 'command_code' in dest) {
			command_code = dest['command_code'] << 8 | other['command_code'] & 0xff;
			dest['command_code'] = command_code;
		} else {
			dest[key] = other[key];
		}
	}

	return dest;
}

function command_decoder(buffer, command_tree) {
	const decoded = {};

	decoded.command_code = buffer.readUint8(0);
	console.log(`CODE 0x${decoded.command_code.toString(16)}`);
	const payload = buffer.slice(1);
	if (decoded.command_code in command_tree) {
		let [command, action] = command_tree[decoded.command_code];

		if (typeof(action) === 'function') {
			decoded.command = command;
			merge_keys(decoded, action(payload, command_tree[decoded.command_code]));
		} else {
			merge_keys(decoded, command_decoder(payload, action));
		}
	} else {
		decoded.command = 'unknown';
	}

	return decoded;
}

function brute_decoder(buffer) {
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

	const decoded = {};
	decoded.destination = buffer.readUint8(2);
	decoded.source = buffer.readUint8(3);
	const payload = buffer.slice(4, (buffer.length - 1));
	merge_keys(decoded, command_decoder(payload, command_tree));

	if (decoded.command == 'unknown') {
		decoded.command = '0x' + decoded.command_code.toString(16).padStart(2, 0);
	}
	return decoded;
}


module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	// decode: (buffer) => new ICOMCIVParser().decode(buffer),
	decode: brute_decoder,
	
	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: (msg) => new ICOMCIVParser().encode(msg),
};