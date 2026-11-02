# NEXUS KAF-AI Free Real-World Connect v1

This branch enriches the existing chat route with public, no-key data sources when a message matches a supported intent.

- **Weather:** Open-Meteo geocoding and forecast APIs provide live city weather.
- **News:** GDELT DOC API returns recent article metadata and publisher URLs for news queries.
- **Science:** Crossref works API returns scholarly publication metadata for research-paper queries; it does not search full text.
- **Education and geography/reference:** Wikipedia public search and summary APIs provide encyclopedia reference summaries.
- **Source metadata:** the chat response includes a `realWorld` object with connector status and source URLs.

## User requirements

- No application-level rate limiter is added.
- No paid API key or new paid service dependency is introduced.
- Public providers may still enforce their own quotas, acceptable-use rules, and availability limits.
- Existing chat, memory, and problems routes are preserved.

## Scope and limitations

- This is a free multi-source connector, not unrestricted crawling or search of every website.
- GDELT article metadata is not independent verification of publisher claims; users should open the source article.
- Crossref returns bibliographic metadata, not guaranteed full text or validated scientific conclusions.
- Wikipedia is reference material and may be incomplete or outdated.
- Weather lookup requires a recognizable city.
- No external write actions (messages, purchases, account changes) are exposed.
- Production Worker deployment is separate from merging this PR.

## Sources

- Open-Meteo: https://open-meteo.com/
- GDELT DOC API: https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/
- Crossref REST API: https://api.crossref.org/
- MediaWiki Search API: https://www.mediawiki.org/wiki/API:Search
- Wikipedia REST API: https://en.wikipedia.org/api/rest_v1/
