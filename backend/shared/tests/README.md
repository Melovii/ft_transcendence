# Shared tests

All tests live here: `unit` covers response formatting, logging, pagination and
pool configuration; `integration` covers connection failures and real PostgreSQL
connectivity. The timeout test starts a local TCP listener.

Run from `backend/shared`:

```sh
go test ./...
go test ./tests/unit
go test ./tests/integration
go test -coverpkg=./httpresponse,./logging,./pagination,./postgres ./tests/...
```

Real PostgreSQL connectivity requires `POSTGRES_TEST_DATABASE_URL`. That test is
skipped when the variable is unset.
