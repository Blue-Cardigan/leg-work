import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Collaborative Legislation Editor",
  description: "Edit UK legislation collaboratively with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.className} h-full bg-background`}>
      <body className="h-full flex flex-col">
        {/* You could add a header here if needed */}
        <main className="flex-grow overflow-hidden">
          {children}
        </main>
        {/* You could add a footer here if needed */}
      </body>
    </html>
  );
}
