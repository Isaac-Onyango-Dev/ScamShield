/** One-click example lookups shown under the search field. */
export const EXAMPLES = [
    { label: "Phishing domain", q: "paypal-secure-login.xyz" },
    { label: "Email", q: "support.paypal@gmail.com" },
    { label: "Short link", q: "https://bit.ly/3xYz" },
    { label: "Phone", q: "+1 888 123 4567" },
    { label: "IP", q: "185.220.101.1" },
    {
        label: "SMS",
        q: "URGENT: Your account has been suspended. Verify your identity within 24 hours at http://amaz0n-verify.top/login or it will be closed.",
    },
] as const;
