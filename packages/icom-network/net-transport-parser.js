const binaryParser = require('binary-parser').Parser;
const binaryEncoder = require('binary-parser-encoder').Parser;

// Utility function to print out objects.
// safely handles circular references
JSON.safeStringify = (obj, indent = 2) => {
	let cache = [];
	const retVal = JSON.stringify(
		obj,
		(key, value) =>
			typeof value === "object" && value !== null
				? cache.includes(value)
					? undefined // Duplicate reference found, discard key
					: cache.push(value) && value // Store value in our collection
				: value,
		indent
	);
	cache = null;
	return retVal;
};


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

// a parser that parses nothing
const nullParser = new binaryParser();


// "network" layer, maintains connection
//

/*
 * This layer of the protocol maintains a network among peers
 * on the network. The protocol uses connectionless UDP/IP
 * and maintains its own notion of a "connection". To do so
 * the datagrams include sequence codes. The protocol also includes
 * periodic probes to check that the peers and connection are 
 * still active.
 *
 * The protocol contains control messages and data identified
 * by the "type" field at this layer.
 * 
 *  Byte
 *  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
 * +---------------+-------+-------+-------+-------+-------------
 * | length        │ type  │ seq   │ src   │ dst   │ data...
 * +---------------+-------+-------+-------+-------+-------------
 *
 * Data is stored in little-endian format.
 * - length (uint32) is the length of the datagram including header
 * - type (uint16) is the type of datagram
 * 	- 0x00 = data
 *  - 0x01 = retransmission / negative ack
 *  - 0x02 = unknown
 *  - 0x03 = probe / are you there?
 *  - 0x04 = probe-response / I am here
 *  - 0x05 = disconnect
 *  - 0x06 = ready
 *  - 0x07 = ping
 * 
 */
class IcomNetParser {
	constructor() {
	}

	messageType = {
		data: 			0x00,
		retransmit:		0x01,	// retransmit request
		unknown_2: 		0x02,
		syn: 			0x03,	// are you there
		syn_ack: 		0x04,	// I am here
		disconnect: 	0x05,
		ready: 			0x06,	// are you ready, I am ready
		ping: 			0x07,
	};

    idParser = new binaryParser()
        .endianess('little')
        .uint16('port')
        .uint16('id')

	baseParser = new binaryParser()
		.endianess('little')
		.uint32('length')
		.uint16('type_code')
		.uint16('sequence')
        .nest('sender', {type: this.idParser })
        .nest('receiver', {type: this.idParser })
		;

	dataParser = new binaryParser()
		.buffer('data', { readUntil: 'eof' })
		;

	retransmitParser = new binaryParser()
		.array('datagrams', { type: new binaryParser().uint16(null), readUntil: 'eof' })
		;

	probeParser = new binaryParser()
		;

	probeResponseParser = new binaryParser()
		;

	disconnectParser = new binaryParser()
		;

	idleParser = new binaryParser()
		;

	pingParser = new binaryParser()
		// TODO: revisit ping fields
		.uint8('reply')
		.uint32('ping_id')
		;

    parser = new binaryParser()
        .nest(null, { type: this.baseParser })
        .choice(null, {
			tag: 'type_code',
			defaultChoice: nullParser,
			choices: {
				0x00: this.dataParser,
				0x01: this.retransmitParser,
				0x03: this.probeParser,
				0x04: this.probeResponseParser,
				0x05:  this.disconnectParser,
				0x06: this.idleParser,
				0x07: this.pingParser,
			}        
        })
        ;
    encode(msg) {
    }

    decode(buffer) {
        if (!buffer) {
			throw new Error('No buffer given to decode');
		}

		return this.parser.parse(buffer);
    }
}

// Public: Decode a Buffer of data (from a UDP datagram) into an object
// with keys and values representing the parsed data.
function decode(buffer) {
	const parser = new IcomNetParser();
	const decoded = parser.decode(buffer);
    decoded.type = keyForValue(parser.messageType, decoded.type_code);
	return decoded;
}

// Public: Enocde object to a UDP-ready buffer
// Returns a Buffer on success or a string error message.
// Check the return type!
function encode(msg) {
	const encoder = new IcomNetParser();
	const encoded = encoder.encode(msg);
	return encoded;
}

module.exports = {
	decode: decode,
	encode: encode
};