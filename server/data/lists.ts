/**
 * Curated reference data used by the heuristic checks. Keep entries lowercase.
 * Brand keys are matched against domain labels / email local parts to catch
 * impersonation; `domains` are the registrable domains the brand really uses.
 */
export interface Brand {
    key: string;
    name: string;
    domains: string[];
    /** Extra tokens that indicate this brand (e.g. "mpesa" for Safaricom). */
    aliases?: string[];
}

export const BRANDS: Brand[] = [
    { key: "paypal", name: "PayPal", domains: ["paypal.com", "paypal.me", "paypalobjects.com"] },
    { key: "apple", name: "Apple", domains: ["apple.com", "icloud.com", "me.com", "mac.com"], aliases: ["icloud", "appleid", "itunes"] },
    { key: "microsoft", name: "Microsoft", domains: ["microsoft.com", "live.com", "outlook.com", "office.com", "office365.com", "microsoftonline.com", "hotmail.com", "msn.com", "azure.com", "sharepoint.com", "onedrive.com"], aliases: ["office365", "outlook", "onedrive", "sharepoint", "hotmail"] },
    { key: "google", name: "Google", domains: ["google.com", "gmail.com", "youtube.com", "googlemail.com", "goo.gl", "g.co", "withgoogle.com"], aliases: ["gmail"] },
    { key: "amazon", name: "Amazon", domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.in", "amazon.ca", "amazon.fr", "amazon.co.jp", "amazonaws.com", "aws.amazon.com", "amazon.jobs"], aliases: ["aws"] },
    { key: "netflix", name: "Netflix", domains: ["netflix.com", "nflxext.com"] },
    { key: "facebook", name: "Meta / Facebook", domains: ["facebook.com", "fb.com", "meta.com", "facebookmail.com", "messenger.com"], },
    { key: "instagram", name: "Instagram", domains: ["instagram.com"] },
    { key: "whatsapp", name: "WhatsApp", domains: ["whatsapp.com", "whatsapp.net", "wa.me"] },
    { key: "linkedin", name: "LinkedIn", domains: ["linkedin.com", "lnkd.in"] },
    { key: "twitter", name: "X / Twitter", domains: ["twitter.com", "x.com", "t.co"] },
    { key: "tiktok", name: "TikTok", domains: ["tiktok.com"] },
    { key: "telegram", name: "Telegram", domains: ["telegram.org", "t.me"] },
    { key: "dropbox", name: "Dropbox", domains: ["dropbox.com"] },
    { key: "docusign", name: "DocuSign", domains: ["docusign.com", "docusign.net"] },
    { key: "adobe", name: "Adobe", domains: ["adobe.com", "adobesign.com"] },
    { key: "coinbase", name: "Coinbase", domains: ["coinbase.com"] },
    { key: "binance", name: "Binance", domains: ["binance.com", "binance.us"] },
    { key: "metamask", name: "MetaMask", domains: ["metamask.io"] },
    { key: "kraken", name: "Kraken", domains: ["kraken.com"] },
    { key: "blockchain", name: "Blockchain.com", domains: ["blockchain.com"] },
    { key: "chase", name: "Chase", domains: ["chase.com", "jpmorganchase.com"] },
    { key: "bankofamerica", name: "Bank of America", domains: ["bankofamerica.com", "bofa.com"] },
    { key: "wellsfargo", name: "Wells Fargo", domains: ["wellsfargo.com"] },
    { key: "citibank", name: "Citi", domains: ["citi.com", "citibank.com"] },
    { key: "hsbc", name: "HSBC", domains: ["hsbc.com", "hsbc.co.uk"] },
    { key: "barclays", name: "Barclays", domains: ["barclays.co.uk", "barclays.com"] },
    { key: "americanexpress", name: "American Express", domains: ["americanexpress.com", "aexp.com"], aliases: ["amex"] },
    { key: "visa", name: "Visa", domains: ["visa.com"] },
    { key: "mastercard", name: "Mastercard", domains: ["mastercard.com"] },
    { key: "dhl", name: "DHL", domains: ["dhl.com", "dhl.de"] },
    { key: "fedex", name: "FedEx", domains: ["fedex.com"] },
    { key: "ups", name: "UPS", domains: ["ups.com"] },
    { key: "usps", name: "USPS", domains: ["usps.com"] },
    { key: "royalmail", name: "Royal Mail", domains: ["royalmail.com"] },
    { key: "irs", name: "IRS", domains: ["irs.gov"] },
    { key: "hmrc", name: "HMRC", domains: ["gov.uk"] },
    { key: "steam", name: "Steam", domains: ["steampowered.com", "steamcommunity.com"], aliases: ["steamcommunity"] },
    { key: "roblox", name: "Roblox", domains: ["roblox.com"] },
    { key: "ebay", name: "eBay", domains: ["ebay.com", "ebay.co.uk"] },
    { key: "walmart", name: "Walmart", domains: ["walmart.com"] },
    { key: "costco", name: "Costco", domains: ["costco.com"] },
    { key: "spotify", name: "Spotify", domains: ["spotify.com"] },
    { key: "zoom", name: "Zoom", domains: ["zoom.us", "zoom.com"] },
    { key: "yahoo", name: "Yahoo", domains: ["yahoo.com", "yahoo.co.uk"] },
    { key: "wetransfer", name: "WeTransfer", domains: ["wetransfer.com", "we.tl"] },
    { key: "safaricom", name: "Safaricom / M-PESA", domains: ["safaricom.co.ke", "safaricom.com"], aliases: ["mpesa", "m-pesa"] },
    { key: "equitybank", name: "Equity Bank", domains: ["equitybankgroup.com", "equitygroupholdings.com"], },
    { key: "kcb", name: "KCB Bank", domains: ["kcbgroup.com"] },
    { key: "kra", name: "Kenya Revenue Authority", domains: ["kra.go.ke"] },
    { key: "mtn", name: "MTN", domains: ["mtn.com", "mtn.co.za", "mtnonline.com"], aliases: ["momo"] },
];

/** Tokens common in phishing hostnames. Individually weak; strong combined with a brand. */
export const PHISHING_KEYWORDS = [
    "login", "signin", "sign-in", "logon", "verify", "verification", "secure", "security", "account",
    "update", "confirm", "billing", "invoice", "payment", "wallet", "recover", "recovery", "unlock",
    "support", "helpdesk", "authenticate", "auth", "validate", "suspended", "refund", "claim", "bonus",
    "airdrop", "giveaway", "reward", "prize", "customs", "delivery", "parcel", "tracking",
];

/**
 * TLDs over-represented in abuse feeds (Spamhaus / Interisle phishing reports).
 * Not proof of anything — a weak signal only.
 */
export const HIGH_ABUSE_TLDS = new Set([
    "zip", "mov", "top", "xyz", "click", "country", "gq", "tk", "ml", "cf", "ga", "work", "support",
    "rest", "cam", "icu", "buzz", "monster", "cyou", "sbs", "cfd", "bond", "lol", "quest", "live",
    "shop", "online", "site", "fun", "space", "website", "store", "vip", "loan", "win", "bid", "men",
]);

export const URL_SHORTENERS = new Set([
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
    "shorturl.at", "rb.gy", "t.ly", "s.id", "tiny.cc", "bl.ink", "v.gd", "qr.co", "lnkd.in", "shorte.st",
    "adf.ly", "bitly.com", "short.io", "tr.ee", "linktr.ee", "urlz.fr", "clck.ru", "u.to",
]);

export const FREE_EMAIL_PROVIDERS = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com", "hotmail.com",
    "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
    "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "web.de", "mail.com",
    "zoho.com", "yandex.com", "yandex.ru", "mail.ru", "inbox.ru", "bk.ru", "list.ru", "qq.com", "163.com",
    "126.com", "sina.com", "naver.com", "daum.net", "tutanota.com", "tuta.io", "fastmail.com", "hey.com",
    "rediffmail.com", "libero.it", "orange.fr", "laposte.net", "free.fr", "t-online.de", "seznam.cz",
    "wp.pl", "o2.pl", "interia.pl", "rambler.ru", "cox.net", "comcast.net", "verizon.net", "att.net",
    "sbcglobal.net", "bellsouth.net", "optonline.net", "earthlink.net", "juno.com", "btinternet.com",
    "sky.com", "virginmedia.com", "bigpond.com", "shaw.ca", "rogers.com", "sympatico.ca", "uol.com.br",
    "bol.com.br", "terra.com.br", "yahoo.co.jp", "yahoo.fr", "yahoo.de", "yahoo.in", "hotmail.fr",
    "outlook.fr", "hotmail.de", "hotmail.it", "hushmail.com", "mailfence.com", "posteo.de", "disroot.org",
]);

/** Local parts that identify a function/role rather than a person. */
export const ROLE_ACCOUNTS = new Set([
    "admin", "administrator", "info", "support", "help", "helpdesk", "contact", "sales", "billing",
    "accounts", "accounting", "finance", "hr", "jobs", "careers", "noreply", "no-reply", "donotreply",
    "do-not-reply", "notifications", "notification", "alerts", "alert", "security", "abuse", "postmaster",
    "hostmaster", "webmaster", "marketing", "news", "newsletter", "office", "team", "service", "services",
    "customerservice", "customer.service", "payments", "invoice", "invoices", "verify", "verification",
    "hello", "mail", "root",
]);

/** International numbering ranges that are not tied to a country (satellite / global services). */
export const INTERNATIONAL_NETWORK_PREFIXES = ["+881", "+882", "+883", "+979", "+870", "+808"];
