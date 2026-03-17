"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { RequestDemoModal } from "./RequestDemoModal";

const DemoContext = createContext<{
	openDemoModal: () => void;
	closeDemoModal: () => void;
} | null>(null);

export function useDemoModal() {
	const ctx = useContext(DemoContext);
	if (!ctx) throw new Error("useDemoModal must be used within DemoProvider");
	return ctx;
}

export function DemoProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const openDemoModal = useCallback(() => setIsOpen(true), []);
	const closeDemoModal = useCallback(() => setIsOpen(false), []);

	return (
		<DemoContext.Provider value={{ openDemoModal, closeDemoModal }}>
			{children}
			<RequestDemoModal isOpen={isOpen} onClose={closeDemoModal} />
		</DemoContext.Provider>
	);
}
