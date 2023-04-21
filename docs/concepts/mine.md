---
_key: b9dbb59f-cebb-481b-aa2e-3632c614067a
---

### Mine

Since a gold nugget might be found in a gold mine, the terminology used in the design of rakosh is related to mines.

In the ArangoDB graph database system used to store rakosh mines, one [Database](https://www.arangodb.com/docs/3.10/data-modeling-databases.html) maps to one rakosh mine.

To model a rakosh mine there are three [Collections](https://www.arangodb.com/docs/3.10/data-modeling-collections.html):

* [Nugget](/1f36fe64-eef9-4226-b837-0f9c35814405)
* [Passage](/055dc260-16c0-4d6b-9b84-4b4e6be23ef0)
* Edges

The Edges collection links the other vertex types together. The root of the graph is a vertex called "adit" in the Passage collection. From here lead the various passages that make up the mine, and in any passage you might find a nugget.

[This](https://orval.github.io/rakosh-example/) rakosh-generated site has an example mine that will eventually include all possible mine structures.
