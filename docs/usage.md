---
_key: eebf595c-9062-4a50-a6a0-b06351c547ea
order: 3
---

### Usage

In this first iteration, the use of ArangoDB is a sledgehammer to crack a site-generation nut. In future, it will be nice to see additional extraction targets and an online mode with an API; and even a frontend. For now, ArangoDB is acting as a schema validation tool effectively.

ArangoDB can be installed in [various ways](https://www.arangodb.com/download-major/). Since the ArangoDB instance need not be long lived, using a Docker container is probably the simplest. To run a container, use this command:

```sh
    docker run -e ARANGO_NO_AUTH=1 -p 8529:8529 --rm \
        arangodb/arangodb arangod --server.endpoint tcp://0.0.0.0:8529
```

Include a `--volume` to persist the data if required.

Once the server is up, content laid out in a specific* directory structure can be deposited like so:

```sh
    rakosh deposit ../my/content/dir
```
