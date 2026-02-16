# list_hosts.js — File

- Name: list_hosts.js
- Path: ./list_hosts.js
- Type: JavaScript (Node.js)

## Purpose & Responsibility
Fetches Nagios status CGI page and extracts unique host names, printing a sorted list.

## Internal Structure
- Uses Basic auth from `NAGIOS_USER/PASS` env vars; GETs `status.cgi?host=all&limit=0` and scrapes with `cheerio` (lines ~5–39)

## Dependency Mapping
- Outbound: `http`, `cheerio`, `dotenv`

## Bug & Risk Notes
- HTML parsing may break if Nagios theme changes; refine selectors as needed

## Deletion & Cleanup Suggestions
- Retain as maintenance utility; safe to remove if replaced by API calls.