import { NextRequest, NextResponse } from 'next/server';
import { parse, HTMLElement } from 'node-html-parser';

interface TocItem {
  title: string;
  fullHref: string;
  level: number; // Indentation level
}

// Helper function to extract TOC items recursively
function extractTocItems(element: HTMLElement, baseUrl: string, level: number): TocItem[] {
  let items: TocItem[] = [];
  element.childNodes.forEach(node => {
    if (node instanceof HTMLElement && node.tagName === 'LI') {
      const linkElement = node.querySelector('a');
      const titleElement = node.querySelector('.LegContentsTitle a') ?? node.querySelector('.LegContentsNo a') ?? linkElement;
      
      if (titleElement && linkElement) {
        const relativeHref = linkElement.getAttribute('href');
        const title = titleElement.textContent.trim();
        if (relativeHref && title) {
            // Construct full URL relative to the base domain
            const fullHref = relativeHref.startsWith('http') ? relativeHref : `${baseUrl}${relativeHref}`;
            items.push({ title, fullHref, level });

            // Recursively find nested lists (sub-items)
            const nestedOl = node.querySelector('ol');
            if (nestedOl) {
              items = items.concat(extractTocItems(nestedOl, baseUrl, level + 1));
            }
        }
      }
    }
  });
  return items;
}

async function fetchContent(url: string): Promise<string | null> {
    try {
        console.log(`[API /legislation/content] Attempting to fetch content from: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          next: { revalidate: 3600 } // Cache for 1 hour
        });
    
        if (!response.ok) {
          console.warn(`[API /legislation/content] Failed to fetch content from ${url}: ${response.status} ${response.statusText}`);
          return null;
        }
        const text = await response.text();
        console.log(`[API /legislation/content] Successfully fetched content from: ${url} (Length: ${text.length})`);
        return text;
    } catch (error) {
        console.error(`[API /legislation/content] Error during fetchContent for ${url}:`, error);
        return null;
    }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contentUrl = searchParams.get('href'); // This is the URL for the 'contents' page
  console.log(`[API /legislation/content] Received request for href: ${contentUrl}`);

  if (!contentUrl) {
    console.error('[API /legislation/content] Error: Missing href parameter');
    return NextResponse.json({ error: 'Missing href parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(contentUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    console.log(`[API /legislation/content] Base URL determined: ${baseUrl}`);

    // 1. Fetch the main 'contents' page HTML
    console.log(`[API /legislation/content] Step 1: Fetching main contents page: ${contentUrl}`);
    const contentsHtml = await fetchContent(contentUrl);
    if (!contentsHtml) {
      console.error(`[API /legislation/content] Step 1 Failed: Could not fetch contents page HTML from ${contentUrl}`);
      return NextResponse.json({ error: 'Failed to fetch legislation contents page' }, { status: 500 });
    }
    console.log(`[API /legislation/content] Step 1 Success: Fetched contents page HTML.`);

    // 2. Parse the Table of Contents (TOC) from the contents page
    console.log(`[API /legislation/content] Step 2: Parsing TOC from contents page HTML.`);
    const root = parse(contentsHtml);
    const tocSelector = '#viewLegContents .LegContents.LegClearFix > ol';
    const tocContainer = root.querySelector(tocSelector);
    let tocItems: TocItem[] = [];
    let introLink: string | null = null;

    if (tocContainer) {
        console.log(`[API /legislation/content] Step 2a: Found TOC container using selector "${tocSelector}". Extracting items.`);
        tocItems = extractTocItems(tocContainer, baseUrl, 0);
        console.log(`[API /legislation/content] Step 2b: Extracted ${tocItems.length} TOC items.`);
        // Find the intro link specifically
        const introItem = tocItems.find(item => item.fullHref && item.fullHref.endsWith('/introduction'));
        if (introItem) {
            introLink = introItem.fullHref;
            console.log(`[API /legislation/content] Step 2c: Found introduction link: ${introLink}`);
        } else {
             console.log(`[API /legislation/content] Step 2c: No link ending with '/introduction' found in TOC items.`);
        }
    } else {
        console.warn(`[API /legislation/content] Step 2a Failed: Could not find TOC container in ${contentUrl} using selector "${tocSelector}".`);
    }


    // 3. Fetch and parse the Introductory Text if found
    console.log(`[API /legislation/content] Step 3: Attempting to fetch and parse introductory text.`);
    let introHtmlContent: string | null = null;
    if (introLink) {
      console.log(`[API /legislation/content] Step 3a: Fetching intro page HTML from: ${introLink}`);
      const introPageHtml = await fetchContent(introLink);
      if (introPageHtml) {
         console.log(`[API /legislation/content] Step 3b: Successfully fetched intro page HTML. Parsing body content.`);
        const introRoot = parse(introPageHtml);
        // Attempt to find the main content body - selectors might need refinement
        const introBodySelectors = ['#viewLegContents .LegSnippet', '#legislation-body', '.LegP1Container'];
        let introBody: HTMLElement | null = null;
        for (const selector of introBodySelectors) {
            introBody = introRoot.querySelector(selector);
            if (introBody) {
                console.log(`[API /legislation/content] Step 3c: Found intro body using selector: "${selector}"`);
                break;
            }
        }
        
        if (introBody) {
          introHtmlContent = introBody.innerHTML; // Get inner HTML to preserve formatting
          console.log(`[API /legislation/content] Step 3d: Extracted intro HTML content (Length: ${introHtmlContent.length}).`);
        } else {
             console.warn(`[API /legislation/content] Step 3c Failed: Could not find introductory text body in ${introLink} using selectors: ${introBodySelectors.join(', ')}`);
        }
      } else {
          console.warn(`[API /legislation/content] Step 3b Failed: Did not receive HTML content from intro link: ${introLink}`);
      }
    } else {
         console.log(`[API /legislation/content] Step 3 Skipped: No introductory text link was found in Step 2.`);
    }

    // 4. Return TOC and Intro HTML
    console.log(`[API /legislation/content] Step 4: Returning response. Intro HTML is ${introHtmlContent ? 'present' : 'null'}. TOC items: ${tocItems.length}.`);
    return NextResponse.json({ 
        toc: tocItems, 
        introHtml: introHtmlContent 
    });

  } catch (error: any) {
    console.error(`[API /legislation/content] Critical Error processing ${contentUrl}:`, error);
    // Check if the error is due to an invalid URL
     if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        console.error(`[API /legislation/content] Invalid URL error: ${contentUrl}`);
        return NextResponse.json({ error: `Invalid URL provided: ${contentUrl}` }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error processing legislation content' }, { status: 500 });
  }
} 