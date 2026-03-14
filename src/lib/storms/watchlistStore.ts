import type { CreateWatchlistInput, TerritoryWatchlist, UpdateWatchlistInput } from "@/types/storms";

const globalKey = "__stormclose_watchlists_store__";

type WatchlistStoreState = {
	byUser: Record<string, TerritoryWatchlist[]>;
};

function getState(): WatchlistStoreState {
	const scope = globalThis as typeof globalThis & { [globalKey]?: WatchlistStoreState };
	if (!scope[globalKey]) {
		scope[globalKey] = { byUser: {} };
	}
	return scope[globalKey] as WatchlistStoreState;
}

export function listWatchlists(userId: string): TerritoryWatchlist[] {
	return getState().byUser[userId] ?? [];
}

export function createWatchlist(userId: string, input: CreateWatchlistInput): TerritoryWatchlist {
	const state = getState();
	const current = state.byUser[userId] ?? [];
	const created: TerritoryWatchlist = {
		id: `watch-${Math.random().toString(36).slice(2, 10)}`,
		userId,
		name: input.name,
		boundsWkt: input.boundsWkt,
		alertThreshold: input.alertThreshold ?? 70,
		active: input.active ?? true,
		createdAt: new Date().toISOString(),
	};
	state.byUser[userId] = [created, ...current];
	return created;
}

export function updateWatchlist(userId: string, watchlistId: string, patch: UpdateWatchlistInput): TerritoryWatchlist | null {
	const state = getState();
	const current = state.byUser[userId] ?? [];
	let found: TerritoryWatchlist | null = null;
	state.byUser[userId] = current.map((watchlist) => {
		if (watchlist.id !== watchlistId) {
			return watchlist;
		}
		found = {
			...watchlist,
			name: patch.name ?? watchlist.name,
			boundsWkt: patch.boundsWkt ?? watchlist.boundsWkt,
			alertThreshold: patch.alertThreshold ?? watchlist.alertThreshold,
			active: patch.active ?? watchlist.active,
		};
		return found;
	});
	return found;
}
