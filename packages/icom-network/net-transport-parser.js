/* net-transport-parser.js - ICOM Network Layer Parser/Encoder
 *
 * This layer of the protocol maintains a network among peers
 * on the network. The protocol uses connectionless UDP/IP
 * and maintains its own notion of a "connection". To do so
 * the datagrams include sequence codes. The protocol also includes
 * periodic keepalive probes and ready messages to check that the peers
 * and connection are still active.
 *
 * The protocol contains control messages and data identified
 * by the "type" field at this layer.
 * 
 *  Byte
 *  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
 * +---------------+-------+-------+-------+-------+-------------
 * | length        │ type  │ seq   │ src   │ dst   │ payload...
 * +---------------+-------+-------+-------+-------+-------------
 *
 * The fields for this layer are stored in *little-endian* format.
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
 * 2023/04/02 Stephen Houser, MIT License
 *
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

class ICOMNetParser {
	constructor() {
	}

	messageType = {
		data: 			0x00,	// encapsulated data packet for higher layer
		retransmit:		0x01,	// retransmit request
		unknown_2: 		0x02,	// don't know what this message type does
		syn: 			0x03,	// are you there
		syn_ack: 		0x04,	// I am here
		disconnect: 	0x05,	// disconnect the channel
		ready: 			0x06,	// are you ready, I am ready
		ping: 			0x07,	// ping request and response
	};

	// parses the peer id which (from a client) should include the UDP
	// port the client is listening on. The radio does not seem to have 
	// this restriction!?!
    idParser = new binaryParser()
        .endianess('little')
        .uint16('port')
        .uint16('id')

	// parses data from current point to end of datagram
	dataParser = new binaryParser()
		.buffer('payload', { readUntil: 'eof' })
		;

	// array of datagrams to retransmit
	retransmitParser = new binaryParser()
		.array('datagrams', { type: new binaryParser().uint16(null), readUntil: 'eof' })
		;

	synParser = new binaryParser()
		;

	synAckParser = new binaryParser()
		;

	disconnectParser = new binaryParser()
		;

	readyParser = new binaryParser()
		;

	pingParser = new binaryParser()
		// TODO: revisit ping fields, are they different for request/response?
		.uint8('reply')
		.uint32('ping_id')
		;

	// header for each datagram
	baseParser = new binaryParser()
		.endianess('little')
		.uint32('length')
		.uint16('type_code')
		.uint16('sequence')
        .nest('sender', { type: this.idParser })
        .nest('receiver', { type: this.idParser })
		;

	// the main parser for decoding datagrams
    parser = new binaryParser()
        .nest(null, { type: this.baseParser })
        .choice(null, {
			tag: 'type_code',
			defaultChoice: new binaryParser(),
			choices: {
				0x00: this.dataParser,
				0x01: this.retransmitParser,
				0x03: this.synParser,
				0x04: this.synAckParser,
				0x05: this.disconnectParser,
				0x06: this.readyParser,
				0x07: this.pingParser,
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
		decoded.type = keyForValue(this.messageType, decoded.type_code);

		return decoded;
    }
}

module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	decode: (buffer) => new ICOMNetParser().decode(buffer),
	
	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: (msg) => new ICOMNetParser().encode(msg),
};