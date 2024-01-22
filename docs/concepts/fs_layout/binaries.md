---
order: 4
_key: ba0a483c-3b7c-46c8-b204-68bb2009c9c2
---

### Binary Files

The long term goal in rakosh is for binaries to be first-class entities in the ArangoDB database. As such, any future live webapp that uses ArangoDB on the back-end will be able to serve images and other binary files from the database.

In the short term, to support binary files, the paradigm of "everything in the DB" will be broken. A deposit to the mine will refer to filesystem paths to binary files. At extraction time, those local paths will be used to find the binary.

#### Binary Nugget

Each binary file will have an associated nugget. The nugget metadata will include information about the local binary path and the media-type.
