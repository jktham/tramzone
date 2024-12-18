# Tramzone
FWE2024 final project

[Deployment Link](https://fp-p33.fwe24.ivia.ch/)

## Getting Started
To start the server:
```sh
pnpm install
pnpm run dev
```
It will automatically begin parsing the most recent GTFS data upon receiving a request, this may take a minute.
Alternatively, trigger parsing manually with:
```sh
pnpm run parse
```

## Documentation
.env contains the neccessary keys, remove KEY_RT to use default public key.
Requires more than 512mb of memory, deploy with modified local helm chart.

## Contributors
- Alec Franco: UI design, frontend
- Alexis Elisseeff: frontend
- Jonas Tham: backend, deployment
- Martin Shen: backend
