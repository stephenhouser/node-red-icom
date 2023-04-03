/* ci-v-parser.js -- ICOM CI-V Protocol Parser/Encoder
 *
 * 2023/04/02 Stephen Houser, MIT License
 */

const binaryParser = require('binary-parser').Parser;
// TODO: Implement encoding of net-transport
// const binaryEncoder = require('binary-parser-encoder').Parser;
const hexy = require("hexy");

// returns key for enum value
function keyForValue(enumType, value) {
	for (const key in enumType) {
		if (typeof (enumType[key]) == 'number' && enumType[key] == value) {
			const key_dash = key.replace(/_/g, '-');
			return key_dash;
		}
	}
	return '';
}

// returns code for key
function valueForKey(enumType, key) {
	const under_key = key.replace(/-/g, '_');
	return enumType.hasOwnProperty(under_key) ? enumType[under_key] : null;
}

// extracts BCD encoded digits from a buffer
// each digit is encoded in 4 bits, two digits per byte,
// most significant digit first in each byte
// least significant byte first in each sequence
function bcdFormatter(buffer) {
	if (!buffer || buffer.length == 0) {
		return null;
	}

	let freq_str = '';

	// map to string of hex digits then reorganize digits into string
	// hex digits are the same as the BCD encoding (nicely)
	[...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.forEach(dp => freq_str = dp[0] + dp[1] + freq_str);

	return freq_str;
}

function optionalUint8Formatter(buffer) {
	if (!buffer || buffer.length == 0) {
		return null;
	}

	return parseInt(buffer[0]);
}


class ICOMCIVParser {
	constructor() {
	}

	civPreamble	= 0xfefe;
	civTrailer	= 0x00fd;

	commandType = {
		send_frequency:			0x00,
		send_mode_data:			0x01,
		read_band_edge:			0x02,
		read_frequency: 		0x03,
		read_mode:				0x04,
		set_frequency: 			0x05,
		set_mode:				0x06,
		set_vfo_mode:			0x07,
		set_memory_mode:		0x08,
		memory_write:			0x09,
		memory_reacll:			0x0a,
		memory_clear:			0x0b,
		read_frequency_offset:	0x0c,
		send_frequency_offset:	0x0d,
		scan:					0x0e,
		split:					0x0f,
		tuning_step:			0x10,
		attenutator:			0x11,
		_omitted_0x12_:			0x12,
		voice_synth:			0x13,
		settings_0x14:			0x14,
		read_0x15:				0x15,
		settings_0x16:			0x16,
		send_cw:				0x17,
		power:					0x18,
		read_transceiver_id: 	0x19,
		settings_0x1a:			0x1a,
		settings_0x1b:			0x1b,
		settings_0x1c:			0x1c,
		_omitted_0x1d_:			0x1d,
		settings_0x1e:			0x1e,
		station_settings:		0x1f,
		settings_0x20:			0x20,
		rit:					0x21,
		dv:						0x22,
		gps:					0x23,
		tx_power:				0x24,
		vfo_frequency:			0x25,
		vfo_mode:				0x26,
		scope_waveform:			0x27,
		transmit_voice_memory:	0x28,
		ng_command:				0xfa,
		ok_command:				0xfb,
	};

	subCommandType = {
		login:			0x00,
		logout:			0x01,
		capabilities:	0x02,
		connection:		0x03
	};

	emptyCommandParser = new binaryParser()
		.buffer('payload', { readUntil: function(x) { return x == 0xfd; }})
		;

	// 0x00
	sendFrequencyParser = new binaryParser()
		.array('frequency', { type: 'uint8', length: 5, formatter: bcdFormatter })
		;

	// 0x00, 0x03
	frequencyParser = new binaryParser()
		.buffer('frequency', { 
			readUntil: function(x) { return x == 0xfd; },
			formatter: bcdFormatter })
		;

	// 0x19
	readTransceiverIdParser = new binaryParser()
		.uint8('subcommand_code')
		.buffer('transceiver_id', { 
			readUntil: function(x) { return x == 0xfd; },
			formatter: optionalUint8Formatter
			})
		;

	scopeWaveformParser = new binaryParser()
		.uint8('subcommand_code')
		.buffer('payload', { readUntil: function(x) { return x == 0xfd; }})
		;

	okCommandParser = new binaryParser()
		;

	ngCommandParser = new binaryParser()
		;

	read_0x15Parser = new binaryParser()
		.uint8('subcommand')
		.buffer('payload', { readUntil: function(x) { return x == 0xfd; }})
		;

	parser = new binaryParser()
		.endianess('little')
		.uint16('_civ_header', { assert: 0xfefe })
		.uint8('destination')
		.uint8('source')
		.uint8('command_code')
		.choice(null, {
			tag: 'command_code',
			defaultChoice: this.emptyCommandParser,
			choices: {
				0x00: this.frequencyParser,
				0x03: this.frequencyParser,
				0x05: this.frequencyParser,
				0x15: this.read_0x15Parser,
				0x19: this.readTransceiverIdParser,
				0x27: this.scopeWaveformParser,
				0xfa: this.okCommandParser,
				0xfb: this.ngCommandParser,
			}
		})
		.uint8('_civ_eof', { assert: 0xfd })
		;

    encode(msg) {
		console.log('ERROR: Encoding not implemented.');
    }

    decode(buffer) {
		if (!buffer || buffer.length == 0) {
			return {};
			// throw new Error('No buffer given to decode');
		}
	
		const decoded = this.parser.parse(buffer);
		decoded.command = keyForValue(this.commandType, decoded.command_code);
	
		// Clean up the '_' properties, they are temporary
		const remove_keys = Object.keys(decoded).filter(function(key) {
			return key.startsWith('_');
		});

		for (let k = 0; k < remove_keys.length; k++) {			
			delete decoded[remove_keys[k]];
		};
	
		return decoded;
    }
}

function empty_decoder(buffer) {
	if (!buffer || buffer.length == 0) {
		return {};
	}

	return { payload: buffer };
}

const command_tree = {
	0x00: ['send-frequency', empty_decoder],
	0x01: ['send-mode-data', empty_decoder],
	0x02: ['read-band-edge', empty_decoder],
	0x03: ['read-operating-frequency', empty_decoder],
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
	0x15: ['read_0x15', {
		0x01: ['read-s-meter-squelch', empty_decoder],
		0x02: ['read-s-meter-level', empty_decoder],
		0x05: ['read-various-squelch', empty_decoder],
		0x07: ['read-overflow-status', empty_decoder],
		0x11: ['read-po-level', empty_decoder],
		0x12: ['read-swr-level', empty_decoder],
		0x13: ['read-alc-level', empty_decoder],
		0x14: ['read-comp-level', empty_decoder],
		0x15: ['read-vd-level', empty_decoder],
		0x16: ['read-id-level', empty_decoder],
	}],
	0x18: ['power', {
		0x00: ['power-off', empty_decoder],
		0x01: ['power-on', empty_decoder]
	}],
	0x19: ['read-transceiver-id', empty_decoder],
	0x1a: ['read_0x1a', {
		0x00: ['send-read-memory', empty_decoder],
		0x01: ['send-read-memory', empty_decoder],
		0x02: ['send-read-memory', empty_decoder],
		0x03: ['send-read-memory', empty_decoder],
		0x04: ['send-read-memory', empty_decoder],
		0x05: ['send-read-memory', empty_decoder],
	}],
	0x27: ['scope-waveform', empty_decoder]
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

/* Earlier version
function command_decoder1(buffer) {
	const decoded = {};

	decoded.command_code = buffer.readUint8(0);
	if (decoded.command_code in command_map) {
		let [command, command_action] = command_map[decoded.command_code];
		if (typeof(command_action) != 'function') {
			const subcommand_map = command_action;
			
			decoded.subcommand_code = buffer.readUint8(1);
			if (decoded.subcommand_code in subcommand_map) {
				[command, command_action] = subcommand_map[decoded.subcommand_code];
			}
		}

		decoded.command = command;
		merge_keys(decoded, command_action(buffer.slice(2)));
	}

	return decoded;
}
*/

// TODO: how to keep subcommand code with recursive
function command_decoder(buffer, command_tree) {
	const decoded = {};

	decoded.command_code = buffer.readUint8(0);
	const payload = buffer.slice(1);
	if (decoded.command_code in command_tree) {
		let [command, action] = command_tree[decoded.command_code];

		if (typeof(action) === 'function') {
			decoded.command = command;
			merge_keys(decoded, action(payload));
		} else {
			merge_keys(decoded, command_decoder(payload, action));
		}
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
	return decoded;
}


module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	// decode: (buffer) => new ICOMCIVParser().decode(buffer),
	decode: brute_decoder,
	
	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: (msg) => new ICOMCIVParser().encode(msg),
};