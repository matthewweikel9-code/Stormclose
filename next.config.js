/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
							"font-src 'self' https://fonts.gstatic.com",
							"img-src 'self' data: blob: https:",
							"connect-src 'self' https://*.supabase.co https://*.stripe.com wss://*.supabase.co https://api.mapbox.com https://api.xweather.com https://data.api.xweather.com https://*.googleapis.com",
							"frame-src 'self' https://*.stripe.com https://*.supabase.co",
							"object-src 'none'",
							"base-uri 'self'",
							"form-action 'self'",
						].join("; "),
					},
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "SAMEORIGIN" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				],
			},
		];
	},
};

module.exports = nextConfig;
