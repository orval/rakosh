---
_key: 0179441b-3aea-4753-9671-76bcd2f107a7
order: 5
---

### Extract

The extraction command use the data in ArangoDB to generate content various formats.

#### Gatsby

Currently the only supported extraction format is a Gatsby.js site:

```text
rakosh gatsby <mine> <sitecustom> <directory>

Extract the data from a mine into a Gatsby.js site layout

Positionals:
  mine        The name of the mine to extract                         [required]
  sitecustom  A JSON file for site customizations            [string] [required]
  directory   Target directory into which to extract the data[string] [required]

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -v, --verbose  Run with verbose output                               [boolean]
      --build    Run the build (use --no-build to not) [boolean] [default: true]
```

##### Example

Extract from the `docs` mine, using customizations from `docs/cust-dev.json`, into a directory called `heap`. Run with verbose output and do not run `npm build` for gatsby:

```sh
rakosh gatsby docs docs/cust-dev.json heap --no-build -v
```
