/* net-serial-parser.js -- ICOM Network Serial Channel Parser
 *
 * This layer of the protocol transmits virtual serial port data
 * to and from peers on the network.
 * 
 * This layer includes sequence codes and the length of the message
 *
 *  Byte
 *  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
 * +---------------+-------+-------+-------+-------+-------------
 * | id | length | seq | payload...
 * +---------------+-------+-------+-------+-------+-------------
 *
 * Data is stored in little-endian format.
 * 
 * 2023/04/02 Stephen Houser, MIT License
 */

const binaryParser = require('binary-parser').Parser;
// TODO: Implement encoding of net-transport
// const binaryEncoder = require('binary-parser-encoder').Parser;

class ICOMNetSerialParser {
	constructor() {
	}

	parser = new binaryParser()
		.endianess('little')
		.uint8('id')
		.uint16('length')
		.uint16('sequence')
		.buffer('payload', { readUntil: 'eof' })
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
		return decoded;
    }
}

module.exports = {
	// Decode a Buffer of data into an object with keys and values representing the parsed data.
	decode: (buffer) => new ICOMNetSerialParser().decode(buffer),
	
	// Encode an object to a Buffer, returns a Buffer on success or a string error message.
	encode: (msg) => new ICOMNetSerialParser().encode(msg),
};