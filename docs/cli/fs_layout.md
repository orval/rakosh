---
_key: 8e03a31c-4624-4c1c-bf7c-fb6d9ddbcbae
order: 4
---

#### FS Layout

##### Adit

The root node of the graph is called the "adit" -- an entrance to a mine.

The directory pointed to by the `rakosh deposit` command must contain a markdown file with the following front matter:

```yaml
---
_key: adit
fs_layout: '1.2'
---
```

`fs_layout` is a version identifier that indicates the layout of these files and directories. The `rakosh` tool checks that it can interpret the given layout.

##### Passages And Nuggets

Directories become Passages and markdown files become Nuggets. If there is a markdown file with front matter `passage: <directory-name>` then its content will be added to the Passage rather than become a Nugget. This file must be in the same directory as the passage directory.
