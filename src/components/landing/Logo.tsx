"use client";

interface LogoProps {
	className?: string;
	showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<svg
				width="40"
				height="40"
				viewBox="0 0 40 40"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="flex-shrink-0"
			>
				{/* Roof outline */}
				<path
					d="M4 22L20 6L36 22"
					stroke="#F9FAFB"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M8 18V34H32V18"
					stroke="#F9FAFB"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				{/* Lightning bolt */}
				<path
					d="M22 12L17 20H23L18 30"
					stroke="url(#lightning-gradient)"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<defs>
					<linearGradient
						id="lightning-gradient"
						x1="20"
						y1="12"
						x2="20"
						y2="30"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#A78BFA" />
						<stop offset="1" stopColor="#6D5CFF" />
					</linearGradient>
				</defs>
			</svg>
			{showText && (
				<span className="text-xl font-bold text-white">
					Storm<span className="text-[#A78BFA]">Close</span>
				</span>
			)}
		</div>
	);
}
