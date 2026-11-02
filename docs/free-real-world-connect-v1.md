# NEXUS KAF-AI Free Real-World Connect v1

This branch adds free public data connectors to the existing chat route.

- Open-Meteo provides live city weather after a weather-intent query.
- Wikipedia public APIs provide reference summaries when the user explicitly asks to search online.
- No paid API key or new paid service is required.
- No application-level rate limiter was added.
- Public providers may still enforce their own usage quotas and availability limits.
- This is an initial connector, not unrestricted search of every website or current-news search.
- Changes are not deployed until merged and separately deployed.

Sources: https://open-meteo.com/ ; https://www.mediawiki.org/wiki/API:Search ; https://en.wikipedia.org/api/rest_v1/