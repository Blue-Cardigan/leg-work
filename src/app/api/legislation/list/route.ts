import { NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

// Define types and years to fetch
const DRAFT_TYPES = ['ukdsi', 'sdsi', 'nidsr'];
const YEARS_TO_FETCH = 1; // Current year + previous 2 years

interface RawLegislationItem {
  title: string;
  href?: string | null;
  // We derive identifier, type, year later
}

interface ParsedLegislationItem {
  title: string;
  href: string; // Full URL
  identifier: string;
  type: string;
  year: string;
}

async function fetchAndParse(url: string, type: string, year: string): Promise<ParsedLegislationItem[]> {
  try {
    console.log(`Fetching legislation list from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      // Cache each individual fetch result aggressively (e.g., 1 hour)
      // The overall result will be revalidated when the API route is called
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      // Don't throw an error for a single failed fetch, just return empty
      return []; 
    }

    const html = await response.text();
    const root = parse(html);

    const items: ParsedLegislationItem[] = root.querySelectorAll('#content tbody tr td:first-child a')
      .map((link): Partial<ParsedLegislationItem> => {
        const title = link.textContent.trim();
        const relativeHref = link.getAttribute('href');
        const idMatch = relativeHref?.match(/\/(\d+|[a-zA-Z0-9]+)\/contents$/);
        const identifier = idMatch ? idMatch[1] : null;
        const fullHref = relativeHref ? `https://www.legislation.gov.uk${relativeHref}` : null;

        return {
          title,
          href: fullHref ?? undefined,
          identifier: identifier ?? undefined,
          type,
          year,
        };
      })
      // Type assertion after filtering ensures all properties are present
      .filter((item): item is ParsedLegislationItem => 
          !!item.title && !!item.href && !!item.identifier
      );
    
    console.log(`Parsed ${items.length} items for ${type}/${year}`);
    return items;
  } catch (error) {
    console.error(`Error fetching or parsing ${url}:`, error);
    return []; // Return empty on error to avoid breaking the whole aggregation
  }
}

// This is the Route Handler for GET requests
// It fetches all draft legislation for recent years and returns an aggregated list.
// Uses revalidation to cache the aggregated result.
export async function GET() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_TO_FETCH }, (_, i) => (currentYear - i).toString());
  const allFetchPromises: Promise<ParsedLegislationItem[]>[] = [];

  for (const type of DRAFT_TYPES) {
    for (const year of years) {
      const url = `https://www.legislation.gov.uk/${type}/${year}`;
      allFetchPromises.push(fetchAndParse(url, type, year));
    }
  }

  try {
    const results = await Promise.all(allFetchPromises);
    const allItems = results.flat(); // Combine results from all fetches

    // Sort by year (descending) and then title (ascending) for consistent initial display
    allItems.sort((a, b) => {
        if (b.year !== a.year) {
            return parseInt(b.year) - parseInt(a.year); 
        }
        return a.title.localeCompare(b.title);
    });

    console.log(`Total draft legislation items fetched: ${allItems.length}`);
    // The NextResponse itself is cached based on the route segment config or default behavior.
    // The individual fetch calls inside have their own revalidate settings.
    return NextResponse.json(allItems);
  } catch (error) {
    console.error('Error aggregating legislation lists:', error);
    return NextResponse.json({ error: 'Internal server error aggregating legislation lists' }, { status: 500 });
  }
}

// Optional: Set revalidation time for the entire API route if needed
// export const revalidate = 3600; // Revalidate the aggregated result every hour 