# Architecture Decision Records (ADRs)

This folder contains individual Architecture Decision Records for the Estate Commission
Flow system. Each ADR captures one non-trivial architectural choice, the context in
which it was made, and the consequences of choosing it.

## Format

We follow a lightweight ADR template:

```
# ADR-00N: <Short decision title>

## Status
Proposed | Accepted | Superseded by ADR-XXX

## Context
What is the problem or the forces at play?

## Decision
What did we decide to do?

## Consequences
What becomes easier? What becomes harder? What are the trade-offs?
```

## Index

| #       | Title                                                                                           | Status   |
|---------|-------------------------------------------------------------------------------------------------|----------|
| ADR-001 | [Use Mongoose over the native driver](./ADR-001-mongoose-over-native-driver.md)                 | Accepted |
| ADR-002 | [Immutable, versioned commission snapshots](./ADR-002-immutable-commission-snapshots.md)        | Accepted |
| ADR-003 | [Monetary values in integer minor units](./ADR-003-monetary-minor-units.md)                     | Accepted |
| ADR-004 | [Transaction reference code format `TRX-YYYY-XXXXXX`](./ADR-004-reference-code-format.md)       | Accepted |
| ADR-005 | [OpenAPI / Swagger for the HTTP surface](./ADR-005-openapi-swagger.md)                           | Accepted |
