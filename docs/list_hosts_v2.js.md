# list_hosts_v2.js — File

- Name: list_hosts_v2.js
- Path: ./list_hosts_v2.js
- Type: JavaScript (Node.js)

## Purpose & Responsibility
Improved Nagios host listing that saves output to `nagios_hosts_new.txt`.

## Internal Structure
- Uses `NAGIOS_URL` base, Basic auth, fetches `status.cgi?hostgroup=all&style=hostdetail&limit=0`, extracts host names, writes file (lines ~10–35)

## Dependency Mapping
- Outbound: `http`, `cheerio`, `fs`, `dotenv`

## Bug & Risk Notes
- Same HTML fragility risks as v1

## Deletion & Cleanup Suggestions
- Retain if useful; otherwise consolidate with `list_hosts.js`.