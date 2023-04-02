# Node Red ICOM Radio Control

This repository provides JavaScript libraries and [Node-RED](https://nodered.org/) nodes to interact with [ICOM](https://www.icomamerica.com/) radios. Including decoding and encoding the [CI-V](https://www.icomjapan.com/support/manual/3064/) protocol and ICOM's network protocol for recent radios (IC-705 in particular).

**This is a work in progress**.

See the [NOTES.md](NOTES.md) file for a bunch of random musings as I figure out how ICOM communicates over the network. While the [CI-V](https://www.icomjapan.com/support/manual/3064/) protocol is well documented, how that protocol is sent over IP or Bluetooth is not. A number of other folks have been working on the same thing and their work has been very helpful. Unfortunately,their code is not enough to *easily* write code based on it, so a lot of packet capturing and investigation is needed to understand and document the protocol enough to be usable for my purposes.

This README will be updated when things are far enough along to be working and stable for release.