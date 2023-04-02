const binaryParser = require('binary-parser').Parser;
const binaryEncoder = require('binary-parser-encoder').Parser;

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
	let freq_str = '';

	// map to string of hex digits then reorganize digits into string
	// hex digits are the same as the BCD encoding (nicely)
	[...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.forEach(dp => freq_str = dp[0] + dp[1] + freq_str);

	return freq_str;
}

class IcomCIVParser {
	constructor() {
	}

	civPreamble	= 0xfefe;
	civTrailer	= 0x00fd;

	commandType = {
		send_frequency:			0x00,
		read_frequency: 		0x03,
		set_frequency: 			0x05,
		read_transceiver_id: 	0x19,
		scope_waveform:			0x27,
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
		.buffer('data', { readUntil: function(x) { return x == 0xfd; }})
		;

	frequencyParser = new binaryParser()
		.array('frequency', { type: 'uint8', length: 5, formatter: bcdFormatter })
		;

	readTransceiverIdParser = new binaryParser()
		.uint8('subcommand_code')
		;

	scopeWaveformParser = new binaryParser()
		.uint8('subcommand_code')
		.buffer('data', { readUntil: function(x) { return x == 0xfd; }})
		;

	okCommandParser = new binaryParser()
		;

	ngCommandParser = new binaryParser()
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
        if (!buffer) {
			throw new Error('No buffer given to decode');
		}

		return this.parser.parse(buffer);
    }
}

// Public: Decode a Buffer of data into an object
// with keys and values representing the parsed data.
function decode(buffer) {
	if (buffer.length == 0) {
		return {'command': 'idle'};
	}

	const parser = new IcomCIVParser();
	const decoded = parser.decode(buffer);
    decoded.command = keyForValue(parser.commandType, decoded.command_code);

	// Clean up the '_' properties, they are temporary
	const remove_keys = Object.keys(decoded).filter(function(key) {
		return key.startsWith('_');
	});
	for (let k = 0; k < remove_keys.length; k++) {			
		delete decoded[remove_keys[k]];
	};

	return decoded;
}

// Public: Enocde object to a buffer
// Returns a Buffer on success or a string error message.
// Check the return type!
function encode(msg) {
	const encoder = new IcomCIVParser();
	const encoded = encoder.encode(msg);
	return encoded;
}

module.exports = {
	decode: decode,
	encode: encode
};