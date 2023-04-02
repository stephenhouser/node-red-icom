# ICOM CI-V on the Network (UDP)

- Spectrum Lab [Controlling Icom Radios with LAN or WLAN]
(https://www.qsl.net/dl4yhf/speclab/Icom_radios_with_LAN_or_WLAN.htm)

- kappanhang, [Audio Connection (in go)](https://github.com/nonoo/kappanhang)

- [wfview](https://gitlab.com/eliggett/wfview) specifically the [udpcivdata.cpp](https://gitlab.com/eliggett/wfview/-/blob/master/udpcivdata.cpp) file. To install wfview on Arch `sudo pacman -S rtaudio qcustomplot qt5`

- [NetworkIcom](https://github.com/peterbmarks/NetworkIcom) repo from Peter Banks, in swift. The Background Information of dissecting the protocol is really helpful.

- Working over [Bluetooth, ok1cdj](https://github.com/ok1cdj/IC705-BT-CIV)

- [ICOM CI-V Document v3.2 (2002)](http://www.w4cll.com/info/ICOM/CI-V/CI-V%20manual.pdf)


## Problems

Invalid CI-V commands from host (wfview) to radio in `ic-705-20230323.pcapng`
```
# Datagram #26:10.1.10.186 -> 10.1.10.71 flags [d] UDP UDP 41504->50002 len 30 (0x16) Serial Channel payload len=6 (0x6)
{
  length: 22,
  type_code: 0,
  sequence: 1,
  sender: { port: 41504, id: 2746 },
  receiver: { port: 46327, id: 6648 },
  payload: { id: 192, length: 1, sequence: 0, payload: <Buffer 04> },
  type: 'data'
}

# Datagram #14475:10.1.10.186 -> 10.1.10.71 flags [d] UDP UDP 41504->50002 len 30 (0x16) Serial Channel payload len=6 (0x6)
{
  length: 22,
  type_code: 0,
  sequence: 852,
  sender: { port: 41504, id: 2746 },
  receiver: { port: 46327, id: 6648 },
  payload: { id: 192, length: 1, sequence: 21251, payload: <Buffer 00> },
  type: 'data'
}

```
## Notes




```
WiFI:
User: ic-705
Password: ******
Control Port: 50001
Serial Port: 50002
Audio Port: 50003
CI-V Address A4h


myId = (addr >> 8 & 0xff) << 24 | (addr & 0xff) << 16 | (localPort & 0xffff);

sendControl(false, 0x03, 0x00); // First connect packet
const initial = Buffer.from([
  0x10, 0x00, 0x00, 0x00,   // len
  0x03, 0x00, 0x00, 0x00, 
  0xb1, 0xe2, 0xba, 0x0a,   // sent id
  0x00, 0x00, 0x00, 0x00    // recvd id
  ]);

recv
10 00 00 00 
04 00 00 00 
94 58 f9 31     7a 63 3 70
b1 e2 ba 0a

sendControl(false, 0x06, 0x01); // Send Are you ready - untracked.
send
10 00 00 00   //len
06 00 01 00   // type, seq
b1 e2 ba 0a   // sentid 58033, 10.186
94 58 f9 31   // recvid

recv
10 00 00 00 
06 00 01 00 
94 58 f9 31 
b1 e2 ba 0a



10.1.10.71

0x00
0x01 packet retransmit NACK
0x03 -> first connect (seq 0) recv id empty -- SYN
0x04 <- I am here (seq 0) send and recv id filled -- ACK
0x06 -> Are you ready (seq 1) - ready
0x06 <- Are you ready (seq 1) - ready

0x07 ping
```