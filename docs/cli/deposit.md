---
_key: da4fc47f-d5a1-421f-8ed8-299343f4a0e2
order: 3
---

### Deposit

The `deposit` command iterates over files and directories to build the structure of a rakosh mine in ArangoDB.

The files and directories are required to be in a particular layout. The layout is versioned to allow for later changes. See [FS Layout](./8e03a31c-4624-4c1c-bf7c-fb6d9ddbcbae).

#### Help Text

```text
rakosh deposit <directory> [options]

Deposit content from the filesystem into a mine

Positionals:
  directory  Directory containing a rakosh mine layout     [string] [required]

Options:
      --help     Show help                                 [boolean]
      --version  Show version number                       [boolean]
  -v, --verbose  Run with verbose output                   [boolean]
  -r, --replace  Replace the existing mine if it exists    [boolean] [default: false]
```

#### Example

Deposit from a directory called `examples/my-mine` with verbose output and replacing any existing version of `my-mine`:

```sh
rakosh deposit examples/my-mine -r -v
```
