/* net-control-parser.js -- ICOM Network Control Channel Parser
 *
 * This layer of the protocol maintains a connection/session with
 * peers on the network. The protocol uses the underlying network
 * transport layer (net-transport-parser.js) to maintain psuedo connections
 * to the network.
 * 
 * This layer includes sequence codes and authentication for
 *
 * The protocol contains control messages and data identified
 * by the "type" field at this layer.
 * 
 *  Byte
 *  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
 * +---------------+-------+-------+-------+-------+-------------
 * | code | res | seq | token | cap | mac         │ type  │ seq   │ src   │ dst   │ payload...
 * +---------------+-------+-------+-------+-------+-------------
 *
 * Data is stored in little-endian format.
 * 
 * 2023/04/02 Stephen Houser, MIT License
 */

const binaryParser = require('binary-parser').Parser;
// TODO: Implement encoding of net-transport
// const binaryEncoder = require('binary-parser-encoder').Parser;

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

// encryption function for encoding username and password
function encrypt(cleartext) {
	const encryptKey = [
		0x47, 0x5d, 0x4c, 0x42, 0x66, 0x20, 0x23, 0x46,
		0x4e, 0x57, 0x45, 0x3d, 0x67, 0x76, 0x60, 0x41,
		0x62, 0x39, 0x59, 0x2d, 0x68, 0x7e, 0x7c, 0x65,
		0x7d, 0x49, 0x29, 0x72, 0x73, 0x78, 0x21, 0x6e,
		0x5a, 0x5e, 0x4a, 0x3e, 0x71, 0x2c, 0x2a, 0x54,
		0x3c, 0x3a, 0x63, 0x4f, 0x43, 0x75, 0x27, 0x79,
		0x5b, 0x35, 0x70, 0x48, 0x6b, 0x56, 0x6f, 0x34,
		0x32, 0x6c, 0x30, 0x61, 0x6d, 0x7b, 0x2f, 0x4b,
		0x64, 0x38, 0x2b, 0x2e, 0x50, 0x40, 0x3f, 0x55,
		0x33, 0x37, 0x25, 0x77, 0x24, 0x26, 0x74, 0x6a,
		0x28, 0x53, 0x4d, 0x69, 0x22, 0x5c, 0x44, 0x31,
		0x36, 0x58, 0x3b, 0x7a, 0x51, 0x5f, 0x52 ];

	const crypt = [...cleartext].map(function(e, idx) {
		const p = e.charCodeAt() + idx;
		return String.fromCharCode(encryptKey[(p > 126 ? 32 + p % 127 : p) - 32]);
	});

	return crypt.join('');
}

// decryption function for decoding username and password
function decrypt(ciphertext) {
	const decryptKey = [
		0x25, 0x3e, 0x74, 0x26, 0x6c, 0x6a, 0x6d, 0x4e,
		0x70, 0x3a, 0x46, 0x62, 0x45, 0x33, 0x63, 0x5e, 
		0x5a, 0x77, 0x58, 0x68, 0x57, 0x51, 0x78, 0x69,
		0x61, 0x31, 0x49, 0x7a, 0x48, 0x2b, 0x43, 0x66,
		0x65, 0x2f, 0x23, 0x4c, 0x76, 0x2a, 0x27, 0x20,
		0x53, 0x39, 0x42, 0x5f, 0x22, 0x72, 0x28, 0x4b,
		0x64, 0x7c, 0x7e, 0x71, 0x47, 0x67, 0x55, 0x29,
		0x79, 0x32, 0x40, 0x50, 0x75, 0x21, 0x41, 0x7d,
		0x2e, 0x5b, 0x30, 0x4a, 0x60, 0x37, 0x24, 0x2c,
		0x34, 0x73, 0x6f, 0x54, 0x59, 0x5c, 0x3f, 0x56,
		0x52, 0x44, 0x3b, 0x3c, 0x6e, 0x4d, 0x2d, 0x6b,
		0x3d, 0x4f, 0x7b, 0x5d, 0x36, 0x38, 0x35 ];
	
	const clear = [...ciphertext].map(function(e, idx) {
		const k = decryptKey[e.charCodeAt() - 32] - idx;
		return String.fromCharCode(k < 32 ? k + 127 - 32 : k);
	});

	return clear.join('');
}

// stringify a uint32 into dotted decimal; 'a.b.c.d'
function ipAddressFormatter(ip) {
	return [ip >> 24 & 0xFF, ip >> 16 & 0xFF, ip >> 8 & 0x0ff, ip & 0xff].join('.')

}

// format guid array for easy reading, standard format
function guidFormatter(guid) {
	const gstr = guid.map(e => e.toString(16).padStart(2, '0')).join('')
	return gstr.slice(0, 8) + '-' + 
			gstr.slice(8, 12) + '-' + gstr.slice(12, 16) + '-' + gstr.slice(16, 20) + '-' +
			gstr.slice(20)
}

class ICOMNetControlParser {
	constructor() {
	}

	// control channel command types
	commandType = {
		request: 		0x01,
		response:		0x02,
		status:			0x03
	};

	// control channel requests
	requestType = {
		login:			0x00,
		logout:			0x01,
		capabilities:	0x02,
		connection:		0x03,
	};

	loginRequestParser = new binaryParser()		// -> 0x80 bytes
		.array('_unknown_lr1', { type: 'uint8', length: 32 })
		.string('username', { length: 16, stripNull: true, formatter: decrypt })
		.string('password', { length: 16, stripNull: true, formatter: decrypt })
		.string('program', { length: 16, stripNull: true })
		.array('_unknown_lr1', { type: 'uint8', length: 16 })
		;

	loginResponseParser = new binaryParser()	// <- 0x60 bytes
		.uint16('authid')
		.array('_unknown_logins1', { type: 'uint8', length: 14 })
		.uint32('error')
		.array('_unknown_logins2', { type: 'uint8', length: 12 })
		.string('connection', { length: 16, stripNull: true })
		.array('_reserved_logins3', { type: 'uint8', length: 16 })
		;

	logoutRequestParser = new binaryParser()
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.uint32('response')
		.array('_unknown_login1', { type: 'uint8', length: 12 })
		;

	logoutResponseParser = new binaryParser()
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.uint32('response')
		.array('_unknown_login1', { type: 'uint8', length: 12 })
		;

	capabilitiesRequestParser = new binaryParser()	// -> 0x40
		.array('_unknown_cap1', { type: 'uint8', readUntil: 'eof' })
		;

	capabilitiesRadioParser = new binaryParser()
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.string('name', { length: 32, stripNull: true })
		.string('audio', { length: 32, stripNull: true })
		.uint16('connection_type')
		.uint8('civ')
		.uint16('rx_sample')
		.uint16('tx_sample')
		.uint8('enable_a')
		.uint8('enable_b')
		.uint8('enable_c')
		.uint32('bitrate')
		.uint16('cap_f')
		.uint8('_unknown_cap1')
		.uint16('cap_g')
		.array('_unknown_cap2', { type: 'uint8', length: 3 })
		;

	capabilitiesResponseParser = new binaryParser()		// <- 0xa8 (varies based on #radios)
		.array('_unknown_caps1', { type: 'uint8', length: 32 })
		.uint16('numradios')
		.array('radios', { type: this.capabilitiesRadioParser, length: 'numradios' } )
		;

	connectionRequestParser = new binaryParser()		// -> 0x90
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.array('_unknown_conre1', { type: 'uint8', length: 16 })
		.string('name', { length: 32, stripNull: true })
		.string('username', { length: 16, stripNull: true, formatter: decrypt })
		.uint8('rx_enable')
		.uint8('tx_enable')
		.uint8('rx_codec')
		.uint8('tx_codec')
		.uint32('rx_sample')
		.uint32('tx_sample')
		.uint32('civ_port')
		.uint32('audio_port')
		.uint32('tx_buffer')
		.uint8('convert')
		.array('_unknown_conre2', { type: 'uint8', length: 7 })
		;

	connectionResponseParser = new binaryParser()		// <- 0x50
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.uint32('error')
		.array('_unknown_status1', { type: 'uint8', length: 12 })
		.uint8('disc')
		.array('_unknown_status2', { type: 'uint8', length: 1 })
		.uint16('civ_port')
		.array('_unknown_status3', { type: 'uint8', length: 2 })
		.uint16('audio_port')
		.array('_unknown_status4', { type: 'uint8', length: 7 })
		;

	requestParser = new binaryParser()
		.choice(null, {
			tag: 'request_code',
			defaultChoice: new binaryParser(),
			choices: {
				0x00: this.loginRequestParser,
				0x01: this.logoutRequestParser,
				0x02: this.capabilitiesRequestParser,
				0x03: this.connectionRequestParser
			}
		})
		;

	responseParser = new binaryParser()
		.choice(null, {
			tag: 'request_code',
			defaultChoice: new binaryParser(),
			choices: {
				0x00: this.loginResponseParser,
				0x01: this.logoutResponseParser,
				0x02: this.capabilitiesResponseParser,
				0x03: this.connectionResponseParser
			}
		})
		;

	statusParser = new binaryParser()	// <-> 0x90
		.array('guid', { type: 'uint8', length: 16, formatter: guidFormatter })
		.array('_unknown_status1', { type: 'uint8', length: 16 })
		.string('name', { length: 32, stripNull: true })
		.uint32('busy')
		.string('program', { length: 16, stripNull: true })
		.array('_unknown_status2', { type: 'uint8', length: 16 })
		.uint32('ip', { formatter: ipAddressFormatter })
		.array('_unknown_status3', { type: 'uint8', length: 8 })
		;

	// the main parser for control channel messages
	parser = new binaryParser()
		.endianess('big')
		.array('_unknown_b1', { type: 'uint8', length: 2 })
		.uint16('length')
		.uint8('type_code')
		.uint8('request_code')
		.uint16('sequence')
		.array('_unknwon_b2', { type: 'uint8', length: 2 })
		.uint16('token_request')
		.uint32('token')
		.choice(null, {
			tag: 'type_code',
			defaultChoice: new binaryParser(),
			choices: {
				0x01: this.requestParser,
				0x02: this.responseParser,
				0x03: this.statusParser
			}
		})
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

		// add stringified version of the datagram type to the returned message
		decoded.type = keyForValue(this.commandType, decoded.type_code);

		if (decoded.type != 'status') {
			// add stringified version of the datagram request to the returned message
			decoded.request = keyForValue(this.requestType, decoded.request_code);
		} else {
			// fix up as status messages do not have a valid 'request'
			delete decoded.request;
		}
		
		// Clean up the '_' properties, they are unknown or temporary
		const remove_keys = Object.keys(decoded).filter(function(key) {
			return key.startsWith('_');
		});
		
		for (let k = 0; k < remove_keys.length; k++) {			
			delete decoded[remove_keys[k]];
		};

		return decoded;
    }
}

module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	decode: (buffer) => new ICOMNetControlParser().decode(buffer),

	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: (msg) => new ICOMNetControlParser().encode(msg),
};