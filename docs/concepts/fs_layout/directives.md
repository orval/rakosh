---
_key: ee2edeab-85a6-49ec-849c-57b6eb1d77bd
order: 3
---

### Directives

Rakosh supports markdown [directives](https://github.com/micromark/micromark-extension-directive#syntax), specifically container directives.

The directives are converted to [React Admonitions](https://github.com/nebrelbug/react-admonitions) when the Gatsby extraction is run.

The following types are supported:

* `warning`
* `tip`
* `caution`
* `note`
* `important`
* `question`

#### Examples

The following admonition is generated using this markdown:

```markdown
:::note
This is a note
:::
```

:::note
This is a note
:::

A different title can be used:

```markdown
:::note[Title]
This is a note
:::
```

:::note[Title]
This is a note
:::

The other types look like this:

:::warning
This is a warning
:::

:::tip
This is a tip
:::

:::caution
This is a caution
:::

:::important
This is important
:::

:::question
This is a question
:::
