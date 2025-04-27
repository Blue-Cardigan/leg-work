// Type definitions for Next.js route handlers

import { NextRequest, NextResponse } from 'next/server';

// Define the base type for route handler parameters
export type RouteHandlerParams = {
  params: Record<string, string | string[]>;
};

// Define the base type for route handlers
export type RouteHandler = (
  request: NextRequest,
  context: RouteHandlerParams
) => Promise<NextResponse>;

// Define specific types for our routes
export type LegislationIdentifierParams = {
  params: {
    identifier: string[];
  };
}; 