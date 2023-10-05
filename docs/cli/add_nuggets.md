---
order: 6
_key: 00e30e0e-2c2b-4f08-900b-e3d047dc6d25
---

### Adding Nuggets

The `fs` command can be used to add nuggets and passages to the filesystem.

#### Help Text

```text
main.js fs <action> <path> [<title>]

Commands for operating on a rakosh filesystem layout

Positionals:
  action                                     [required] [choices: "add", "lint"]
  path    path to the entity to act on                       [string] [required]
  title   the title of the new nugget                                   [string]

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -v, --verbose  Run with verbose output                               [boolean]
```

#### Examples

To add a new nugget:

```sh
rakosh fs examples/my-mine/my-first-lode/wibble.md "Wibble Wobble"
```

To add a new passage:

```sh
rakosh fs examples/my-mine/my-first-lode/floop "Floop"
```

This with create the directory `examples/my-mine/my-first-lode/floop` and it's associated data in `examples/my-mine/my-first-lode/floop.md`

To check that the FS Layout can be parsed:

```sh
$ rakosh fs -v lint examples/my-mine
found 169 nuggets
```
