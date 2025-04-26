# Retrieving Draft Legislation from legislation.gov.uk

This document explains how to use the `legislation.gov.uk` website structure (acting as a form of API) to find and retrieve draft legislation documents.

## 1. Finding Draft Legislation

You can list draft legislation for a specific type and year using structured URLs. The main types for draft legislation are:

*   `ukdsi`: UK Draft Statutory Instruments
*   `sdsi`: Scottish Draft Statutory Instruments
*   `nidsr`: Northern Ireland Draft Statutory Rules

The URL pattern is: `https://www.legislation.gov.uk/{type}/{year}`

**Example:** To list UK Draft Statutory Instruments for 2024:

```bash
curl -L 'https://www.legislation.gov.uk/ukdsi/2024'
```

This command returns an HTML page containing a list of draft documents for that type and year. You will need to parse this HTML to find the specific URI for the draft document you need. The links within the HTML are typically found within the first `<td>` element of each row (`<tr>`) in the `<tbody>` of the table with the ID `content`. The links themselves usually follow a pattern like `/ukdsi/{year}/{identifier}/contents`.

## 2. Retrieving a Specific Draft Document

Once you have identified the specific URI path for a draft document (e.g., `/ukdsi/2024/9780348267273/contents`), you can download it directly.

**Example:** To download the draft document identified above:

```bash
curl -L -o draft_document.html 'https://www.legislation.gov.uk/ukdsi/2024/9780348267273/contents'
```

This command downloads the HTML content of the draft legislation and saves it to `draft_document.html`.

Refer to the [official developer documentation](https://www.legislation.gov.uk/developer/searching) for more advanced search options and details. 