---
passage: .
fs_layout: '0.1'
---

# rakosh

rakosh is a place to store nuggets of information. Like a knowledge base, but based on small "nuggets" rather than pages.

---

## README

rakosh is a place to store nuggets of information. Like a knowledge base, yet built with small "nuggets" rather than pages.

raskosh is offline-first -- for now -- this is a prototype. Data are stored in an [ArangoDB](https://github.com/arangodb/arangodb) database. In future there may be a server and a frontend. For now, there is a tool for depositing data into ArangoDB, and one for extracting it as a [Gatsby](https://www.gatsbyjs.com) site.

One aim of this prototype is to develop an [ontology](https://en.wikipedia.org/wiki/Ontology_%28computer_science%29) for these "nuggets" of information and the relationships between them.

### Usage

In this first iteration, the use of ArangoDB is a sledgehammer to crack a site-generation nut. In future, it will be nice to see additional extraction targets and an online mode with an API; and even a frontend. For now, ArangoDB is acting as a schema validation tool.

ArangoDB can be installed in [various ways](https://www.arangodb.com/download-major/). Since the ArangoDB instance need not be long lived, using a Docker container is probably the simplest. To run a container, use this command:

    docker run -e ARANGO_NO_AUTH=1 -p 8529:8529 --rm \
        arangodb/arangodb arangod --server.endpoint tcp://0.0.0.0:8529

Include a `--volume` to persist the data if required.

Once the server is up, content laid out in a specific directory structure can be deposited like so:

    rakosh deposit ../my/content/dir

### Terminology

| Term | ArangoDB Objects | Description |
|-|-|-|
| mine | Database | the content store |
| nugget | Document, Vertex | a small piece of useful information |
| lode | Vertex | a top-level content category |
| seam | Vertices | a set of nuggets that exist at the same level in the mine |
| passage | Vertex | non-content verticies used to link content together |
| vein | Vertices, Edges | a route through the mine that defines a nugget's location |
| primary | Graph | internal - defines the relationship between all other objects |
| edges | Edges | internal - name of the collection use for all edges |

### TODO

* nugget content scroll bar
* keyboard navigation plus gatsby build warnings
* embedded images
* CLI command to simplify creation of new FS vertices
* search box usage hints
* define passages using symbolic links to directories in the filesystem deposit
* write some more docs
* "tags" for search (plus author)
* dark mode
* support `<link>` links in markdown

### Writing Markdown

Note that writing a link with angle brackets does not work. E.g. `some text then a <http://link.to.example.com>`
