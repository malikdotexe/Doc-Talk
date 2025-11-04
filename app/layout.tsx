import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Talk to Your Documents – Gemini Live + LangChain",
  description: "Upload PDFs. Ask questions. Get instant answers with Gemini Live + LangChain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Icons&display=swap"
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
