/** UI-facing shapes exposed by CrApiClient — keep backend domain types behind the client. */

export interface CrTimelineEntryView {
	action: string;
	byUserId: string;
	at: string;
	note?: string;
}

export interface CrDetailView {
	id: string;
	title: string;
	status: string;
	totals: { baselineTotal: number; newTotal: number; delta: number };
	timeline: CrTimelineEntryView[];
}
