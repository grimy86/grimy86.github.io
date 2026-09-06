export const baseUrl = "https://lowlevelnotes.com";
export const googleSearchConsoleVerification = "ef9KpIV_Ll2l0ggil98ixxCXyg_3_mNMf0KT61fvR2o";

const creator = {
    name: "lowlevelnotes",
}

const authors = [
    {
        name: "lowlevelnotes",
    },
];

const openGraph = {
  title: "lowlevelnotes",
  description: "Organized knowledge for mastering software development.",
  url: baseUrl,
  siteName: "0xLLN",

  images: [
    {
      url: "/opengraph-image.png",
      /* standard 1.91:1 aspect ratio for social media sharing */
      width: 1200,
      height: 630,
      alt: "open graph image",
    },
  ],

  locale: "en-US",
  type: "website" as const,
};

const alternates = {
  canonical: baseUrl,

  languages: {
    "en-US": baseUrl,
    "en-GB": baseUrl,
    "en-CA": baseUrl,
    "en-AU": baseUrl,
    "en-NZ": baseUrl,
    "en-IE": baseUrl,
    "en-ZA": baseUrl,
    "en-IN": baseUrl,
    "en-PH": baseUrl,
    "en-SG": baseUrl,
    "en-HK": baseUrl,
    "en-MY": baseUrl,
    "en-TH": baseUrl,
    "en-VN": baseUrl,
    "en-ID": baseUrl,
    "en-KR": baseUrl,
    "en-JP": baseUrl,
    "en-CN": baseUrl,
    "en-TW": baseUrl,
    en: baseUrl,
  },
};

const keywords = [
  // Core keywords
  "0xLLN",
  "lowlevelnotes",
  "resources",
  "programming",
  "coding",
  "software development",
  "organized knowledge",

  // Topics
  "c++",
  "c",
  "c#",
  ".net",
  "assembly",
  "x86",
  "x64",
  "x86-64",
  "reverse engineering",
  "windows internals",
  "game hacking",

  // Broader topics or categories
  "computer science",
  "data structures",
  "algorithms",
  "design patterns",
  "operating systems",
  "networking",
  "cybersecurity",

  // Typos and variations
  "low level notes",
  "low-level-notes",
  "lowlevel-notes",
  "lowlevelnotes.com",
  "lowlevelnotes.org",
  "lowlevelnotes.net",
  "lowlevelnotes.io",
];

export const siteConfig = {
    viewport: {
        themeColor: "#171717",
        colorScheme: "dark" as const,
        width: "device-width" as const,
        initialScale: 1,
        minimumScale: 1,
        maximumScale: 5,
        userScalable: true,
        viewportFit: "cover" as const,
        },

    metaData: {
        // template applies to every page that sets its own `title` (the
        // browser tab reads e.g. "Log In — 0xLLN" instead of a bare
        // "lowlevelnotes" repeated on every single page); `default` is
        // what a page with no title of its own falls back to — the
        // homepage itself, and anything not yet given real metadata.
        title: {
            default: "lowlevelnotes",
            template: "%s — 0xLLN",
        },
        name: "lowlevelnotes",

        description: 
            "Organized knowledge for mastering software development.",

        creator: creator.name,
        publisher: "lowlevelnotes",

        url: baseUrl,
        locale: "en-US",
        category: "technology",

        metadataBase: new URL(baseUrl),
        manifest: "/manifest.webmanifest",

        icons: {
            icon: "/favicon.ico",
            shortcut: "/favicon.ico",
            apple: "/favicon.ico",
        },

        appLinks: {
            /* Android app links require additional information like the package name and the app's SHA256 fingerprint. */
            web: {
                url: baseUrl,
            },
            desktop: {
                url: baseUrl,
            },
            ios: {
                url: baseUrl,
            },
        },

        /* Detects phone numbers, email addresses, and physical addresses in the content and automatically converts them into clickable links. */
        formatDetection: {
            email: false,
            address: false,
            telephone: false,
        },

        robots: {
            /* Allow search engines to index the page and follow links. */
            index: true,
            /* Allow search engines to follow links on the page. */
            follow: true,
            /* Allow search engines to cache a copy of the page. */
            nocache: true,
        },

        verification: {
            /* Verify ownership of the site with Google Search Console. */
            google: googleSearchConsoleVerification,
        },

        authors: authors,
        openGraph: openGraph,
        alternates: alternates,
        keywords: keywords,
    },
}