import { NextRequest, NextResponse } from 'next/server';
import { parse, HTMLElement } from 'node-html-parser';

interface TocItem {
  title: string;
  fullHref: string;
  level: number; // Indentation level
}

// Helper function to extract TOC items recursively
function extractTocItems(element: HTMLElement, baseUrl: string, contentUrl: string, level: number): TocItem[] {
  let items: TocItem[] = [];
  // Iterate through direct child nodes that are LIs
  element.childNodes.forEach(node => {
    if (node instanceof HTMLElement && node.tagName === 'LI') {
      let titleText: string | null = null;
      let linkElement: HTMLElement | null = null;
      let relativeHref: string | null = null;
      let isHeading = false;

      // --- Strategy 1: Structure like criminal_justice/tied_pubs ---
      // Look for <p class="LegContentsItem"> which contains spans for number/title
      const itemParagraph = node.querySelector('p.LegContentsItem');
      if (itemParagraph) {
        const titleSpan = itemParagraph.querySelector('span.LegContentsTitle');
        const numberSpan = itemParagraph.querySelector('span.LegContentsNo');
        
        linkElement = titleSpan?.querySelector('a') ?? numberSpan?.querySelector('a') ?? itemParagraph.querySelector('a'); // Find link within spans or direct child of p
        titleText = titleSpan?.textContent.trim() ?? numberSpan?.textContent.trim() ?? null; // Prefer title span text, fallback to number, ensure null

        if (linkElement) {
            relativeHref = linkElement.getAttribute('href') ?? null; // Ensure null
        }
      }

      // --- Strategy 2: Fallback/Original logic (approx) ---
      // If Strategy 1 didn't find basics, try finding link/title more directly under LI
      if (!titleText && !linkElement) {
          linkElement = node.querySelector('a'); // Link directly under LI?
          // Try finding the title element more broadly within the LI
          const titleParagraph = node.querySelector('p.LegContentsTitle, p.LegContentsNo, p.LegContentsPart, p.LegContentsChapter, p.LegScheduleFirst, p.LegP1GroupTitle'); // Added Schedule/GroupTitle
          titleText = titleParagraph?.textContent.trim() ?? null; // Ensure null
          if (linkElement) {
               relativeHref = linkElement.getAttribute('href') ?? null; // Ensure null
          }
          // If we found a title paragraph but no link, treat as heading
          if(titleParagraph && !linkElement) {
              isHeading = true;
          }
      }
      
      // --- Process based on findings ---
      if (titleText && relativeHref && linkElement) {
        // Found a linked item
        const fullHref = relativeHref.startsWith('http') ? relativeHref : `${baseUrl}${relativeHref}`;
        // Basic check to avoid adding self-links or redundant links
        if (fullHref !== contentUrl && !fullHref.endsWith('/contents')) { 
            items.push({ title: titleText, fullHref, level });
        }
         // Recurse into nested lists WITHIN the current LI
         const nestedOl = node.querySelector('ol'); // Look for OL directly under LI
         if (nestedOl) {
           items = items.concat(extractTocItems(nestedOl, baseUrl, contentUrl, level + 1));
         }

      } else if (titleText && (isHeading || !linkElement)) {
        // Found a title but no link, or explicitly marked as heading. Treat as non-linked heading.
        // Use a marker href, incorporating title for better uniqueness
        const marker = '#heading-' + titleText.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').toLowerCase();
        items.push({ title: titleText, fullHref: contentUrl + marker , level }); // Add marker to href
        
        // Recurse into nested lists WITHIN the current LI
        const nestedOl = node.querySelector('ol'); // Look for OL directly under LI
        if (nestedOl) {
          items = items.concat(extractTocItems(nestedOl, baseUrl, contentUrl, level + 1));
        }
      } else if (node.structuredText.trim() && !itemParagraph && !linkElement && !titleText) {
         // Handle cases where LI might just contain text (unlikely in TOC but possible)
         console.log(`[API /legislation/content] TOC LI contains only text: ${node.structuredText.trim()}`);
      }
      // else: LI was empty or structured in an unexpected way - ignore/log if needed.
    }
     // Recurse into OL/UL elements found directly under the current element (if not handled by LI recursion)
     // This helps if the structure is ol > ol > li instead of ol > li > ol
     else if (node instanceof HTMLElement && (node.tagName === 'OL' || node.tagName === 'UL')) {
         items = items.concat(extractTocItems(node, baseUrl, contentUrl, level)); // Keep same level for sibling lists
     }
  });
  return items;
}

async function fetchContent(url: string): Promise<string | null> {
    try {
        console.log(`[API /legislation/content] Attempting to fetch content from: ${url}`);
        const response = await fetch(url, {
          headers: {
            // Using a more common user agent
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          next: { revalidate: 3600 } // Cache for 1 hour
        });
    
        if (!response.ok) {
          console.warn(`[API /legislation/content] Failed to fetch content from ${url}: ${response.status} ${response.statusText}`);
          // Log response headers if available on failure
           try {
              console.warn(`[API /legislation/content] Response Headers for ${url}:`, JSON.stringify(Object.fromEntries(response.headers.entries())));
           } catch {}
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
  const contentUrl = searchParams.get('url');
  console.log(`[API /legislation/content] Received request for url: ${contentUrl}`);

  if (!contentUrl) {
    console.error('[API /legislation/content] Error: Missing url parameter');
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let baseUrl = '';
   try {
       const parsedUrl = new URL(contentUrl);
       baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
       console.log(`[API /legislation/content] Base URL determined: ${baseUrl}`);
   } catch (e) {
        console.error(`[API /legislation/content] Invalid contentUrl provided: ${contentUrl}`, e);
        return NextResponse.json({ error: `Invalid URL provided: ${contentUrl}` }, { status: 400 });
   }


  try {
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
    // More robust selector for TOC container - checking common IDs/Classes
    const tocSelectors = [
        '#viewLegContents .LegContents.LegClearFix > ol', // Original
        '#tocControlsAdded .LegContents.LegClearFix > ol', // As seen in tied_pubs/criminal_justice
        '.LegContents > ol', // Simpler structure?
        '#legContents > ol', // Alternative ID?
    ];
    let tocContainer: HTMLElement | null = null;
    for(const selector of tocSelectors) {
        tocContainer = root.querySelector(selector);
        if (tocContainer) {
             console.log(`[API /legislation/content] Step 2a: Found TOC container using selector: "${selector}".`);
            break;
        }
    }

    let tocItems: TocItem[] = [];
    let introLink: string | null = null;

    if (tocContainer) {
        console.log(`[API /legislation/content] Step 2b: Extracting items from TOC container.`);
        tocItems = extractTocItems(tocContainer, baseUrl, contentUrl!, 0); 
        console.log(`[API /legislation/content] Step 2c: Extracted ${tocItems.length} TOC items (including headings).`);
        // Find the intro link specifically (check fullHref validity and common patterns)
        const introItem = tocItems.find(item => 
            item.fullHref && 
            !item.fullHref.includes('#heading-') && 
            (item.fullHref.endsWith('/introduction') || item.title?.toLowerCase().includes('introduction')) // Also check title
        );
        if (introItem) {
            introLink = introItem.fullHref;
            console.log(`[API /legislation/content] Step 2d: Found introduction link: ${introLink}`);
            // Remove intro item from main TOC list if we process it separately
            tocItems = tocItems.filter(item => item.fullHref !== introLink);
        } else {
             console.log(`[API /legislation/content] Step 2d: No specific introduction link found.`);
        }
    } else {
        console.warn(`[API /legislation/content] Step 2 Failed: Could not find TOC container using selectors: ${tocSelectors.join(', ')}.`);
        // Attempt to find *any* OL/UL list as a last resort?
        const fallbackToc = root.querySelector('#viewLegContents ol, #viewLegContents ul');
         if (fallbackToc) {
            console.log(`[API /legislation/content] Step 2 Fallback: Trying generic list.`);
             tocItems = extractTocItems(fallbackToc, baseUrl, contentUrl!, 0);
             console.log(`[API /legislation/content] Step 2 Fallback: Extracted ${tocItems.length} items from generic list.`);
             // Repeat intro link finding logic if needed
         } else {
             console.warn(`[API /legislation/content] Step 2 Fallback Failed: No generic list found either.`);
         }
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
        // More robust selectors for the main content body
        const introBodySelectors = [
            '#viewLegSnippet', // Common pattern
            '#viewLegContents .LegSnippet', // Original pattern
            '.LegP1Container', // Another pattern
            '#legislation-body', // Generic
            '#content', // Broad fallback
            'article', // Semantic fallback
            'main' // Semantic fallback
        ];
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
          console.log(`[API /legislation/content] Step 3d: Extracted intro HTML content (Length: ${introHtmlContent?.length ?? 0}).`);
        } else {
             console.warn(`[API /legislation/content] Step 3c Failed: Could not find introductory text body in ${introLink} using selectors: ${introBodySelectors.join(', ')}`);
        }
      } else {
          console.warn(`[API /legislation/content] Step 3b Failed: Did not receive HTML content from intro link: ${introLink}`);
      }
    } else {
         console.log(`[API /legislation/content] Step 3 Skipped: No introductory text link was found or applicable.`);
    }

    // 4. Fetch content for each TOC item (excluding placeholders)
    console.log(`[API /legislation/content] Step 4: Fetching content for actual section links.`);
    const sectionsHtml: { [href: string]: string | null } = {};
    // Filter out placeholder headings before fetching
    const itemsToFetch = tocItems.filter(item => !item.fullHref.includes('#heading-'));
    console.log(`[API /legislation/content] Step 4a: Identified ${itemsToFetch.length} potential section links to fetch (out of ${tocItems.length} total TOC items).`);

    const fetchPromises = itemsToFetch.map(async (item) => {
      // Skip invalid URLs just in case
       try {
          new URL(item.fullHref);
       } catch (e) {
           console.warn(`[API /legislation/content] Step 4b: Skipping invalid URL found in TOC: ${item.fullHref}`);
           return;
       }

      console.log(`[API /legislation/content] Step 4c: Fetching section content from: ${item.fullHref}`);
      const sectionPageHtml = await fetchContent(item.fullHref);
      if (sectionPageHtml) {
        console.log(`[API /legislation/content] Step 4d: Successfully fetched section HTML for ${item.fullHref}. Parsing.`);
        const sectionRoot = parse(sectionPageHtml);
        // Use broader selectors, similar to intro
        const sectionBodySelectors = [
            '#viewLegSnippet', 
            '#viewLegContents .LegSnippet', 
            '.LegPartContainer', 
            '.LegScheduleContainer', 
            '.LegP1Container', 
            '.LegArticle', // For articles
            '.LegSection', // For sections
            '#legislation-body', 
            '#content',
            'article',
            'main'
            ];
        let sectionBody: HTMLElement | null = null;
         for (const selector of sectionBodySelectors) {
            sectionBody = sectionRoot.querySelector(selector);
            if (sectionBody) {
                console.log(`[API /legislation/content] Step 4e: Found section body for ${item.fullHref} using selector: "${selector}"`);
                break;
            }
        }
        
        if (sectionBody) {
          sectionsHtml[item.fullHref] = sectionBody.innerHTML;
          console.log(`[API /legislation/content] Step 4f: Extracted section HTML for ${item.fullHref} (Length: ${sectionBody.innerHTML.length}).`);
        } else {
          console.warn(`[API /legislation/content] Step 4e Failed: Could not find section body in ${item.fullHref} using selectors: ${sectionBodySelectors.join(', ')}`);
          sectionsHtml[item.fullHref] = '<div>Content not found</div>'; // Indicate failure to find content within the fetched page
        }
      } else {
        console.warn(`[API /legislation/content] Step 4d Failed: Did not receive HTML content for section link: ${item.fullHref}`);
        sectionsHtml[item.fullHref] = '<div>Failed to fetch</div>'; // Indicate failure to fetch the page
      }
    });

    // Wait for all fetches to complete
    await Promise.all(fetchPromises);
     console.log(`[API /legislation/content] Step 4 Complete: Finished fetching/parsing sections. Attempted: ${itemsToFetch.length}. Successfully extracted content for ${Object.values(sectionsHtml).filter(v => v !== null && !v.startsWith('<div>')).length} sections.`);

    // 5. Return TOC (non-heading items), Intro HTML, and Sections HTML
    console.log(`[API /legislation/content] Step 5: Returning response. Intro: ${introHtmlContent ? 'present' : 'null'}, TOC items (incl headings): ${tocItems.length}, Sections fetched: ${Object.keys(sectionsHtml).length}.`);
    return NextResponse.json({ 
        toc: tocItems, // Return all items, including headings for structure
        introHtml: introHtmlContent,
        sectionsHtml: sectionsHtml
    });

  } catch (error: any) {
    console.error(`[API /legislation/content] Critical Error processing ${contentUrl}:`, error);
    // Log the error stack trace if available
    if (error.stack) {
        console.error(error.stack);
    }
    // Check if the error is due to an invalid URL (might happen deeper)
     if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        console.error(`[API /legislation/content] Invalid URL error encountered during processing: ${error.message}`);
        return NextResponse.json({ error: `Invalid URL encountered during processing: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error processing legislation content', details: error.message || 'Unknown error' }, { status: 500 });
  }
} 