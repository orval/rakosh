---
_key: 206be892-0bd4-44c4-9e9e-19c6798b68ad
---

## Code

Code syntax highlighting.

```java
class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!"); 
    }
}
```

### UUID

`cli/uuid.js` from rakosh:

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

End.
