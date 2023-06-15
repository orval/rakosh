---
_key: ed5171f1-6b90-4a26-bdd3-6427dd435ead
---

## Code In Directives

:::note

```java
class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!"); 
    }
}
```

:::

---

:::warning[whoa]

```javascript
'use strict'
const { v4: uuidv4 } = require('uuid')

exports.command = 'uuid'

exports.describe = 'Generate a UUID'

exports.builder = (yargs) => {
  return yargs
}

exports.handler = function (argv) {
  console.log(uuidv4())
}
```

:::
